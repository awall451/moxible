import { json } from '@sveltejs/kit';
import { listTemplates } from '$lib/server/templates';

export async function GET() {
  return json(await listTemplates());
}
