import type { Handle } from '@sveltejs/kit';
import { isSetupComplete } from './config';

// Paths that bypass the gate even when setup is incomplete:
// - /setup/**       wizard pages
// - /api/setup/**   wizard API endpoints (probe, keygen, save)
// - /_app/**        SvelteKit asset bundles
// - /favicon.*      browser favicon requests
// - /robots.txt     crawler hint
// - /health         liveness probe
const ALLOWLIST = [
  /^\/setup(\/|$)/,
  /^\/api\/setup(\/|$)/,
  /^\/_app\//,
  /^\/favicon\./,
  /^\/robots\.txt$/,
  /^\/health$/
];

function isAllowlisted(pathname: string): boolean {
  return ALLOWLIST.some((re) => re.test(pathname));
}

export const setupGate: Handle = async ({ event, resolve }) => {
  const pathname = event.url.pathname;

  if (isAllowlisted(pathname)) {
    return resolve(event);
  }

  if (await isSetupComplete()) {
    return resolve(event);
  }

  return new Response(null, {
    status: 302,
    headers: { Location: '/setup' }
  });
};
