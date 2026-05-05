export type AnsibleEvent =
  | { type: 'job_started'; jobId: string; pid: number; cmd: string[]; ts: number }
  | { type: 'play_start'; play: string; ts: number }
  | { type: 'task_start'; task: string; ts: number }
  | { type: 'task_ok'; task: string; host: string; changed: boolean; ts: number }
  | { type: 'task_skipped'; task: string; host: string; ts: number }
  | { type: 'task_failed'; task: string; host: string; msg: string; ts: number }
  | {
      type: 'play_recap';
      host: string;
      ok: number;
      changed: number;
      failed: number;
      unreachable: number;
      ts: number;
    }
  | {
      type: 'result';
      vmid: number;
      ip: string;
      name: string;
      sshConfigSnippet: string;
      sshCommand: string;
      ts: number;
    }
  | { type: 'done'; status: 'succeeded' | 'failed'; exitCode: number; ts: number }
  | { type: 'error'; message: string; ts: number }
  | { type: 'stdout_line'; line: string; ts: number }
  | { type: 'stderr_line'; line: string; ts: number };

export const NEXT_STEPS_RE =
  /VM (\d+) \(([^)]+)\) provisioned\.[\s\S]*?IP:\s*(\S+)/;

export function parseNextStepsMsg(msg: string):
  | { vmid: number; name: string; ip: string }
  | null {
  const m = NEXT_STEPS_RE.exec(msg);
  if (!m) return null;
  return { vmid: Number.parseInt(m[1], 10), name: m[2], ip: m[3] };
}

export function renderSshConfig(name: string, ip: string, user = 'dillon'): string {
  return [
    `Host ${name}`,
    `    HostName ${ip}`,
    `    User ${user}`,
    `    IdentityFile ~/.ssh/id_ed25519_pve`,
    `    ProxyJump argonpi`,
    ''
  ].join('\n');
}

export function parseJsonlLine(line: string): AnsibleEvent | null {
  const trimmed = line.trim();
  if (!trimmed) return null;
  try {
    const obj = JSON.parse(trimmed) as AnsibleEvent;
    if (obj && typeof obj === 'object' && typeof obj.type === 'string') return obj;
  } catch {
    /* fall through */
  }
  return null;
}
