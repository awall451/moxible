import { error, json } from '@sveltejs/kit';
import { readResult } from '$lib/server/jobs';

export async function GET({ params }) {
  const r = await readResult(params.jobId);
  if (!r) throw error(404, 'job not found');
  return json(r);
}
