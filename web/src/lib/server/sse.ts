import { open } from 'node:fs/promises';
import { jobFile } from './paths';
import { isJobLive } from './runner';
import { parseJsonlLine, type AnsibleEvent } from './ansibleParser';

const HEARTBEAT_MS = 15_000;
const POLL_MS = 250;
const STALE_TAIL_MS = 5_000;

export function sseStream(jobId: string): Response {
  const eventsPath = jobFile(jobId, 'events.jsonl');

  let closed = false;
  let cleanup: () => void = () => {
    closed = true;
  };

  const stream = new ReadableStream({
    async start(controller) {
      const enc = new TextEncoder();
      let pos = 0;
      let buf = '';
      let lastTailEndedAt: number | null = null;

      const safeEnqueue = (chunk: Uint8Array) => {
        if (closed) return;
        try {
          controller.enqueue(chunk);
        } catch {
          closed = true;
        }
      };

      const send = (evt: AnsibleEvent) => {
        safeEnqueue(enc.encode(`event: ${evt.type}\ndata: ${JSON.stringify(evt)}\n\n`));
      };

      const heartbeat = setInterval(() => {
        safeEnqueue(enc.encode(`: ping ${Date.now()}\n\n`));
      }, HEARTBEAT_MS);

      cleanup = () => {
        if (closed) return;
        closed = true;
        clearInterval(heartbeat);
        clearInterval(tick);
        try {
          controller.close();
        } catch {
          /* already closed */
        }
      };

      const drain = async () => {
        try {
          const fd = await open(eventsPath, 'r');
          try {
            const stat = await fd.stat();
            if (stat.size > pos) {
              const chunk = Buffer.alloc(stat.size - pos);
              await fd.read(chunk, 0, chunk.length, pos);
              pos = stat.size;
              buf += chunk.toString('utf8');
              const lines = buf.split('\n');
              buf = lines.pop() ?? '';
              for (const line of lines) {
                const evt = parseJsonlLine(line);
                if (evt) send(evt);
                if (evt && evt.type === 'done') {
                  cleanup();
                  return;
                }
              }
            }
          } finally {
            await fd.close();
          }
          if (!isJobLive(jobId)) {
            if (lastTailEndedAt === null) lastTailEndedAt = Date.now();
            else if (Date.now() - lastTailEndedAt > STALE_TAIL_MS) cleanup();
          } else {
            lastTailEndedAt = null;
          }
        } catch {
          if (!isJobLive(jobId)) {
            if (lastTailEndedAt === null) lastTailEndedAt = Date.now();
            else if (Date.now() - lastTailEndedAt > STALE_TAIL_MS) cleanup();
          }
        }
      };

      const tick = setInterval(() => {
        if (closed) return;
        void drain();
      }, POLL_MS);

      void drain();
    },
    cancel() {
      cleanup();
    }
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no'
    }
  });
}
