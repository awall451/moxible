import type { Handle } from '@sveltejs/kit';
import { sequence } from '@sveltejs/kit/hooks';
import { setupGate } from '$lib/server/setupGate';

const ALLOWED = (process.env.ALLOWED_ORIGINS ?? '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

const LOCALHOST_RE = /^https?:\/\/[a-z0-9-]+\.localhost(:\d+)?$/;

function isAllowed(origin: string | null): origin is string {
  if (!origin) return false;
  return ALLOWED.includes(origin) || LOCALHOST_RE.test(origin);
}

function corsHeaders(origin: string): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': origin,
    Vary: 'Origin',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Expose-Headers': 'Content-Type'
  };
}

const corsHandle: Handle = async ({ event, resolve }) => {
  const origin = event.request.headers.get('origin');
  const allowed = isAllowed(origin);

  if (event.request.method === 'OPTIONS' && allowed) {
    return new Response(null, { status: 204, headers: corsHeaders(origin!) });
  }

  const res = await resolve(event);
  if (allowed) {
    for (const [k, v] of Object.entries(corsHeaders(origin!))) res.headers.set(k, v);
  }
  return res;
};

// Phase 5 will insert authHandle between setupGate and corsHandle.
export const handle = sequence(setupGate, corsHandle);
