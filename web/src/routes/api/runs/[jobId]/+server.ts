import { error, json } from '@sveltejs/kit';
import { readFile } from 'node:fs/promises';
import { jobFile } from '$lib/server/paths';
import { readResult } from '$lib/server/jobs';
import { parseJsonlLine, type AnsibleEvent } from '$lib/server/ansibleParser';

export async function GET({ params }) {
  const r = await readResult(params.jobId);
  if (!r) throw error(404, 'job not found');
  let events: AnsibleEvent[] = [];
  try {
    const text = await readFile(jobFile(params.jobId, 'events.jsonl'), 'utf8');
    for (const line of text.split('\n')) {
      const evt = parseJsonlLine(line);
      if (evt) events.push(evt);
    }
  } catch {
    /* none yet */
  }
  return json({ ...r, events });
}
