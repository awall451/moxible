import { spawn, type ChildProcess } from 'node:child_process';
import { createWriteStream } from 'node:fs';
import { readFile, writeFile } from 'node:fs/promises';
import { ANSIBLE_DIR, CALLBACK_PLUGINS_DIR, jobFile } from './paths';
import { writeResult, readResult, type JobResult } from './jobs';
import {
  parseJsonlLine,
  parseNextStepsMsg,
  renderSshConfig,
  type AnsibleEvent
} from './ansibleParser';
import type { DeployInput } from '$lib/schemas/deploy';

// Phase 1.5: env-var fallback. The wizard (Phase 2+) loads these from
// /data/config.yml and renders them through the same env vars to the spawn.
const SUBNET_PREFIX = process.env.SUBNET_PREFIX ?? '192.0.2';
const CLOUD_USER = process.env.CLOUD_USER ?? 'admin';

let activeJobId: string | null = null;

export class ConcurrencyError extends Error {
  constructor(public readonly busyJobId: string) {
    super(`another deploy in progress: ${busyJobId}`);
  }
}

export function isBusy(): string | null {
  return activeJobId;
}

function buildVarsJson(input: DeployInput, jobId: string): unknown {
  const memMb = input.memoryGb * 1024;
  const vm: Record<string, unknown> = {
    name: input.name,
    cores: input.cores,
    memory_mb: memMb,
    disk_size_gb: input.diskGb,
    full_clone: true
  };
  if (input.advanced.vmidOverride != null) vm.vmid = input.advanced.vmidOverride;
  const vars: Record<string, unknown> = {
    ssh_pubkey_local_path: jobFile(jobId, 'pubkey.pub'),
    template_vmid: input.templateVmid,
    vms_to_clone: [vm]
  };
  if (input.advanced.dnsOverride) vars.nameservers = input.advanced.dnsOverride;
  if (input.advanced.gatewayOverride) vars.network_gateway = input.advanced.gatewayOverride;
  if (input.advanced.dotfilesUrl) vars.dotfiles_url = input.advanced.dotfilesUrl;
  return vars;
}

const liveJobs = new Set<string>();

export function isJobLive(jobId: string): boolean {
  return liveJobs.has(jobId);
}

async function appendEvent(path: string, evt: AnsibleEvent): Promise<void> {
  await writeFile(path, JSON.stringify(evt) + '\n', { flag: 'a' });
}

async function readAllEvents(path: string): Promise<AnsibleEvent[]> {
  try {
    const text = await readFile(path, 'utf8');
    const out: AnsibleEvent[] = [];
    for (const line of text.split('\n')) {
      const evt = parseJsonlLine(line);
      if (evt) out.push(evt);
    }
    return out;
  } catch {
    return [];
  }
}

export async function startDeploy(input: DeployInput, jobId: string): Promise<{ pid: number }> {
  if (activeJobId) throw new ConcurrencyError(activeJobId);
  activeJobId = jobId;
  liveJobs.add(jobId);

  const varsPath = jobFile(jobId, 'vars.json');
  const eventsPath = jobFile(jobId, 'events.jsonl');
  const stdoutPath = jobFile(jobId, 'stdout.log');
  const stderrPath = jobFile(jobId, 'stderr.log');

  await writeFile(varsPath, JSON.stringify(buildVarsJson(input, jobId), null, 2));
  await writeFile(eventsPath, '');

  const args = ['playbooks/create-vm-from-template.yml', '--extra-vars', `@${varsPath}`];
  if (input.advanced.dryRun) args.push('--check');

  const env: NodeJS.ProcessEnv = {
    ...process.env,
    HOME: '/root',
    ANSIBLE_CONFIG: process.env.ANSIBLE_CONFIG ?? `${ANSIBLE_DIR}/ansible.cfg`,
    ANSIBLE_CALLBACK_PLUGINS: CALLBACK_PLUGINS_DIR,
    ANSIBLE_STDOUT_CALLBACK: 'jsonl_events',
    JSONL_EVENTS_PATH: eventsPath,
    ANSIBLE_FORCE_COLOR: 'false',
    PYTHONUNBUFFERED: '1'
  };

  const child: ChildProcess = spawn('ansible-playbook', args, {
    cwd: ANSIBLE_DIR,
    env,
    stdio: ['ignore', 'pipe', 'pipe']
  });

  const pid = child.pid ?? -1;

  await appendEvent(eventsPath, {
    type: 'job_started',
    jobId,
    pid,
    cmd: ['ansible-playbook', ...args],
    ts: Date.now()
  });

  child.stdout?.pipe(createWriteStream(stdoutPath, { flags: 'a' }));
  const stderrStream = createWriteStream(stderrPath, { flags: 'a' });
  child.stderr?.pipe(stderrStream);

  let stderrBuf = '';
  child.stderr?.on('data', async (b: Buffer) => {
    stderrBuf += b.toString();
    const lines = stderrBuf.split('\n');
    stderrBuf = lines.pop() ?? '';
    for (const line of lines) {
      if (!line.trim()) continue;
      await appendEvent(eventsPath, { type: 'stderr_line', line, ts: Date.now() });
    }
  });

  const initial = await readResult(jobId);
  if (initial) {
    initial.status = 'running';
    await writeResult(jobId, initial);
  }

  child.on('close', async (code) => {
    try {
      await finalize(jobId, input, code ?? -1, eventsPath);
    } finally {
      liveJobs.delete(jobId);
      activeJobId = null;
    }
  });

  return { pid };
}

async function finalize(
  jobId: string,
  input: DeployInput,
  exitCode: number,
  eventsPath: string
): Promise<void> {
  const events = await readAllEvents(eventsPath);
  const success = exitCode === 0;

  let result = events.find(
    (e): e is Extract<AnsibleEvent, { type: 'result' }> => e.type === 'result'
  );

  if (!result) {
    const debugTask = events.find(
      (e) =>
        e.type === 'task_ok' &&
        (e as unknown as { task?: string }).task === 'Show next steps' &&
        typeof (e as unknown as { msg?: string }).msg === 'string'
    ) as (AnsibleEvent & { msg?: string; task?: string }) | undefined;
    if (debugTask?.msg) {
      const parsed = parseNextStepsMsg(debugTask.msg);
      if (parsed) {
        result = {
          type: 'result',
          vmid: parsed.vmid,
          ip: parsed.ip,
          name: parsed.name,
          sshConfigSnippet: renderSshConfig(parsed.name, parsed.ip, CLOUD_USER),
          sshCommand: `ssh ${CLOUD_USER}@${parsed.ip}`,
          ts: Date.now()
        };
        await appendEvent(eventsPath, result);
      }
    }
  }

  const failedTask = events.find(
    (e): e is Extract<AnsibleEvent, { type: 'task_failed' }> => e.type === 'task_failed'
  );

  const stored: JobResult | null = await readResult(jobId);
  if (stored) {
    stored.endedAt = new Date().toISOString();
    stored.exitCode = exitCode;
    if (success) {
      if (result) {
        stored.status = 'succeeded';
        stored.result = {
          vmid: result.vmid,
          ip: result.ip,
          name: result.name,
          sshConfigSnippet: result.sshConfigSnippet,
          sshCommand: result.sshCommand
        };
      } else if (input.advanced.vmidOverride != null) {
        const vmid = input.advanced.vmidOverride;
        const ip = input.advanced.ipOverride ?? `${SUBNET_PREFIX}.${vmid}`;
        stored.status = 'succeeded';
        stored.result = {
          vmid,
          ip,
          name: input.name,
          sshConfigSnippet: renderSshConfig(input.name, ip, CLOUD_USER),
          sshCommand: `ssh ${CLOUD_USER}@${ip}`
        };
      } else {
        stored.status = 'succeeded_unparsed';
      }
    } else {
      stored.status = 'failed';
      stored.error = {
        message: failedTask?.msg ?? `ansible-playbook exited ${exitCode}`,
        lastTask: failedTask?.task
      };
    }
    await writeResult(jobId, stored);
  }

  await appendEvent(eventsPath, {
    type: 'done',
    status: success ? 'succeeded' : 'failed',
    exitCode,
    ts: Date.now()
  });
}
