import { json } from '@sveltejs/kit';
import { getVmidReport } from '$lib/server/pveQuery';

export async function GET({ url }) {
  const force = url.searchParams.get('force') === '1';
  return json(await getVmidReport(force));
}
