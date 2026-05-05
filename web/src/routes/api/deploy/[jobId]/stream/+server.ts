import { sseStream } from '$lib/server/sse';

export async function GET({ params }) {
  return sseStream(params.jobId);
}
