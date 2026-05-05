import { json } from '@sveltejs/kit';
import { listRuns } from '$lib/server/jobs';

export async function GET({ url }) {
  const limit = Number.parseInt(url.searchParams.get('limit') ?? '50', 10);
  return json(await listRuns(Number.isFinite(limit) ? limit : 50));
}
