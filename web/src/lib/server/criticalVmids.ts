import { readFile } from 'node:fs/promises';
import { CRITICAL_VMID_FILE } from './paths';

let cache: { vmids: number[]; loadedAt: number } | null = null;
const TTL_MS = 60_000;

export async function getCriticalVmids(): Promise<number[]> {
  const now = Date.now();
  if (cache && now - cache.loadedAt < TTL_MS) return cache.vmids;
  try {
    const text = await readFile(CRITICAL_VMID_FILE, 'utf8');
    const vmids = text
      .split('\n')
      .map((l) => l.split('#')[0].trim())
      .filter(Boolean)
      .map((s) => Number.parseInt(s, 10))
      .filter((n) => Number.isInteger(n));
    cache = { vmids, loadedAt: now };
    return vmids;
  } catch {
    cache = { vmids: [], loadedAt: now };
    return [];
  }
}
