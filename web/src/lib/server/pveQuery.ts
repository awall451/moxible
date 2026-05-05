import { spawn } from 'node:child_process';
import { getCriticalVmids } from './criticalVmids';

const PVE_HOST = process.env.PVE_HOST ?? '10.1.10.150';
const PVE_BASTION = process.env.PVE_BASTION ?? 'argonpi';
const PVE_USER = process.env.PVE_USER ?? 'root';
const SSH_KEY_PATH = process.env.SSH_KEY_PATH ?? '/root/.ssh/id_ed25519_pve';

export type VmidRow = { vmid: number; name: string; status: string };

export type VmidReport = {
  range: [number, number];
  free: number[];
  taken: { vmid: number; name: string; critical: boolean }[];
  next: number | null;
  lastUpdated: string;
  stale: boolean;
  error?: string;
};

let cache: { value: VmidReport; loadedAt: number } | null = null;
const TTL_MS = 30_000;

function runQmList(): Promise<string> {
  return new Promise((resolve, reject) => {
    const args = [
      '-i',
      SSH_KEY_PATH,
      '-o',
      'BatchMode=yes',
      '-o',
      'StrictHostKeyChecking=accept-new',
      '-o',
      `ProxyJump=${PVE_BASTION}`,
      `${PVE_USER}@${PVE_HOST}`,
      'qm list'
    ];
    const child = spawn('ssh', args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (b) => (stdout += b.toString()));
    child.stderr.on('data', (b) => (stderr += b.toString()));
    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) resolve(stdout);
      else reject(new Error(`ssh qm list exited ${code}: ${stderr.trim()}`));
    });
  });
}

function parseQmList(output: string): VmidRow[] {
  const rows: VmidRow[] = [];
  const lines = output.split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('VMID')) continue;
    const parts = trimmed.split(/\s+/);
    const vmid = Number.parseInt(parts[0], 10);
    if (!Number.isInteger(vmid)) continue;
    rows.push({ vmid, name: parts[1] ?? '', status: parts[2] ?? '' });
  }
  return rows;
}

export async function getVmidReport(force = false): Promise<VmidReport> {
  const now = Date.now();
  if (!force && cache && now - cache.loadedAt < TTL_MS) {
    return { ...cache.value, stale: false };
  }

  const range: [number, number] = [200, 254];
  const critical = new Set(await getCriticalVmids());

  try {
    const output = await runQmList();
    const rows = parseQmList(output);
    const inRange = rows.filter((r) => r.vmid >= range[0] && r.vmid <= range[1]);
    const takenIds = new Set(inRange.map((r) => r.vmid));
    const free: number[] = [];
    for (let i = range[0]; i <= range[1]; i++) if (!takenIds.has(i)) free.push(i);
    const taken = inRange
      .map((r) => ({ vmid: r.vmid, name: r.name, critical: critical.has(r.vmid) }))
      .sort((a, b) => a.vmid - b.vmid);
    const report: VmidReport = {
      range,
      free,
      taken,
      next: free[0] ?? null,
      lastUpdated: new Date().toISOString(),
      stale: false
    };
    cache = { value: report, loadedAt: now };
    return report;
  } catch (err) {
    const fallback: VmidReport = {
      range,
      free: [],
      taken: [],
      next: null,
      lastUpdated: new Date().toISOString(),
      stale: true,
      error: err instanceof Error ? err.message : String(err)
    };
    return fallback;
  }
}
