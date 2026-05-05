import { error, json } from '@sveltejs/kit';
import sshpk from 'sshpk';
import { deploySchema } from '$lib/schemas/deploy';
import { ensureArtifactsRoot } from '$lib/server/paths';
import { createJob } from '$lib/server/jobs';
import { startDeploy, ConcurrencyError } from '$lib/server/runner';
import { getVmidReport } from '$lib/server/pveQuery';
import { getCriticalVmids } from '$lib/server/criticalVmids';

export async function POST({ request }) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    throw error(400, 'invalid JSON body');
  }
  const parsed = deploySchema.safeParse(body);
  if (!parsed.success) {
    return json({ error: 'validation', issues: parsed.error.issues }, { status: 400 });
  }
  const input = parsed.data;

  try {
    sshpk.parseKey(input.sshPubkey, 'ssh');
  } catch (err) {
    return json(
      { error: 'pubkey', message: err instanceof Error ? err.message : 'invalid pubkey' },
      { status: 422 }
    );
  }

  if (input.advanced.vmidOverride != null) {
    const critical = new Set(await getCriticalVmids());
    if (critical.has(input.advanced.vmidOverride)) {
      return json(
        { error: 'vmid_critical', vmid: input.advanced.vmidOverride },
        { status: 409 }
      );
    }
    const report = await getVmidReport();
    if (report.taken.some((t) => t.vmid === input.advanced.vmidOverride)) {
      return json({ error: 'vmid_taken', vmid: input.advanced.vmidOverride }, { status: 409 });
    }
  }

  await ensureArtifactsRoot();
  const { jobId } = await createJob(input);

  try {
    await startDeploy(input, jobId);
  } catch (err) {
    if (err instanceof ConcurrencyError) {
      return json({ error: 'busy', activeJobId: err.busyJobId, jobId }, { status: 409 });
    }
    throw err;
  }

  return json(
    { jobId, streamUrl: `/api/deploy/${jobId}/stream`, statusUrl: `/api/deploy/${jobId}` },
    { status: 202 }
  );
}
