// Phase 1.5: critical VMIDs come from the CRITICAL_VMIDS env var
// (comma-separated, e.g. "202,210"). Phase 2+ replaces this with a read
// from /data/config.yml's `protection.critical_vmids` list.
//
// Refusing to destroy a critical VMID is enforced both here (UI display)
// and in ansible/playbooks/destroy-vm.yml (hard failure on the play side).

let cache: { vmids: number[]; loadedAt: number } | null = null;
const TTL_MS = 60_000;

export async function getCriticalVmids(): Promise<number[]> {
  const now = Date.now();
  if (cache && now - cache.loadedAt < TTL_MS) return cache.vmids;
  const raw = process.env.CRITICAL_VMIDS ?? '';
  const vmids = raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => Number.parseInt(s, 10))
    .filter((n) => Number.isInteger(n));
  cache = { vmids, loadedAt: now };
  return vmids;
}
