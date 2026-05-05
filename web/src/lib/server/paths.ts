import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';

// The repo's ansible/ tree is baked into the image at /repo/ansible by the
// Dockerfile. ANSIBLE_DIR can override for dev (e.g. point at the host repo).
export const ANSIBLE_DIR = process.env.ANSIBLE_DIR ?? '/repo/ansible';
export const PLAYBOOKS_DIR = join(ANSIBLE_DIR, 'playbooks');

// Wizard artifacts live under DATA_DIR (bind-mounted to ./data on host).
export const DATA_DIR = process.env.DATA_DIR ?? '/data';
export const KEYS_DIR = process.env.KEYS_DIR ?? join(DATA_DIR, 'keys');
export const CONFIG_PATH = process.env.CONFIG_PATH ?? join(DATA_DIR, 'config.yml');

export const ARTIFACTS_DIR = process.env.ARTIFACTS_DIR ?? join(DATA_DIR, 'runs');

export const CALLBACK_PLUGINS_DIR =
  process.env.ANSIBLE_CALLBACK_PLUGINS ?? '/app/ansible-callbacks';

export function jobDir(jobId: string): string {
  return join(ARTIFACTS_DIR, jobId);
}

export function jobFile(jobId: string, name: string): string {
  return join(jobDir(jobId), name);
}

export async function ensureJobDir(jobId: string): Promise<string> {
  const dir = jobDir(jobId);
  await mkdir(dir, { recursive: true });
  return dir;
}

export async function ensureArtifactsRoot(): Promise<void> {
  await mkdir(ARTIFACTS_DIR, { recursive: true });
}
