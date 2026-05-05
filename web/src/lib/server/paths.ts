import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';

export const REPO_ROOT = process.env.REPO_ROOT ?? '/repo';
export const ARTIFACTS_DIR = process.env.ARTIFACTS_DIR ?? '/data/runs';
export const ANSIBLE_DIR = join(REPO_ROOT, 'ansible');
export const PLAYBOOKS_DIR = join(ANSIBLE_DIR, 'playbooks');
export const CRITICAL_VMID_FILE = join(REPO_ROOT, '.claude', '.critical-vmid');
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
