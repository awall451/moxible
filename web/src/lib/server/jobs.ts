import { createHash } from 'node:crypto';
import { readFile, readdir, stat, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { customAlphabet } from 'nanoid';
import { ARTIFACTS_DIR, ensureJobDir, jobFile } from './paths';
import type { DeployInput } from '$lib/schemas/deploy';

const newId = customAlphabet('123456789abcdefghjkmnpqrstuvwxyz', 12);

export type JobStatus = 'pending' | 'running' | 'succeeded' | 'failed' | 'succeeded_unparsed';

export type JobResult = {
  jobId: string;
  status: JobStatus;
  startedAt: string;
  endedAt?: string;
  exitCode?: number;
  request: DeployInput & { sshPubkey: string };
  result?: {
    vmid: number;
    ip: string;
    name: string;
    sshConfigSnippet: string;
    sshCommand: string;
  };
  error?: { message: string; lastTask?: string };
};

function fingerprint(pubkey: string): string {
  const trimmed = pubkey.trim().split(/\s+/);
  const blob = trimmed[1] ?? '';
  const sha = createHash('sha256').update(Buffer.from(blob, 'base64')).digest('base64');
  return `SHA256:${sha.replace(/=+$/, '')}`;
}

function redactRequest(input: DeployInput): JobResult['request'] {
  return {
    ...input,
    sshPubkey: fingerprint(input.sshPubkey)
  };
}

export function newJobId(): string {
  return `v1${newId()}`;
}

export async function createJob(input: DeployInput): Promise<{ jobId: string; dir: string }> {
  const jobId = newJobId();
  const dir = await ensureJobDir(jobId);
  await writeFile(jobFile(jobId, 'pubkey.pub'), input.sshPubkey.trim() + '\n', { mode: 0o644 });
  await writeFile(jobFile(jobId, 'request.json'), JSON.stringify(redactRequest(input), null, 2));
  const initial: JobResult = {
    jobId,
    status: 'pending',
    startedAt: new Date().toISOString(),
    request: redactRequest(input)
  };
  await writeResult(jobId, initial);
  return { jobId, dir };
}

export async function writeResult(jobId: string, result: JobResult): Promise<void> {
  const path = jobFile(jobId, 'result.json');
  const tmp = `${path}.tmp`;
  await writeFile(tmp, JSON.stringify(result, null, 2));
  const { rename } = await import('node:fs/promises');
  await rename(tmp, path);
}

export async function readResult(jobId: string): Promise<JobResult | null> {
  try {
    const text = await readFile(jobFile(jobId, 'result.json'), 'utf8');
    return JSON.parse(text) as JobResult;
  } catch {
    return null;
  }
}

export type RunSummary = {
  jobId: string;
  name: string;
  vmid: number | null;
  status: JobStatus;
  startedAt: string;
  durationSec: number | null;
};

export async function listRuns(limit = 50): Promise<RunSummary[]> {
  let entries: string[];
  try {
    entries = await readdir(ARTIFACTS_DIR);
  } catch {
    return [];
  }
  const stats = await Promise.all(
    entries.map(async (id) => {
      try {
        const s = await stat(join(ARTIFACTS_DIR, id));
        return s.isDirectory() ? { id, mtime: s.mtimeMs } : null;
      } catch {
        return null;
      }
    })
  );
  const sorted = stats
    .filter((s): s is { id: string; mtime: number } => s !== null)
    .sort((a, b) => b.mtime - a.mtime)
    .slice(0, limit);
  const summaries: RunSummary[] = [];
  for (const { id } of sorted) {
    const r = await readResult(id);
    if (!r) continue;
    const started = Date.parse(r.startedAt);
    const ended = r.endedAt ? Date.parse(r.endedAt) : null;
    summaries.push({
      jobId: id,
      name: r.request.name,
      vmid: r.result?.vmid ?? null,
      status: r.status,
      startedAt: r.startedAt,
      durationSec:
        ended !== null && Number.isFinite(started) ? Math.round((ended - started) / 1000) : null
    });
  }
  return summaries;
}
