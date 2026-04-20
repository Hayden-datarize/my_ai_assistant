import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

/**
 * Service Worker MUST NOT intercept Google Fonts requests.
 *
 * When sw.js calls fetch() against fonts.gstatic.com inside the worker
 * context, the resulting request is evaluated against the page's
 * connect-src directive (not font-src), which blocks it. The worker's
 * .catch() then returns undefined to event.respondWith(), producing
 * "TypeError: Failed to convert value to 'Response'" on every page load
 * after the worker activates.
 *
 * This regression test exists because v3.2a-hotfix shipped with sw.js
 * intercepting all GETs — fonts started failing in prod once the worker
 * activated on the second visit.
 */
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');

const REQUIRED_PASSTHROUGH_HOSTS = ['fonts.googleapis.com', 'fonts.gstatic.com'];

describe('sw.js fetch handler passes through font hosts', () => {
  const sw = readFileSync(resolve(ROOT, 'public/sw.js'), 'utf8');

  it.each(REQUIRED_PASSTHROUGH_HOSTS)('passes %s through to the browser', (host) => {
    // Worker must reference the host AND immediately bail (no event.respondWith).
    // Look for both: a string literal of the host, and a "return;" inside the
    // same conditional block before any respondWith call mentioning that host.
    expect(sw, `sw.js must reference ${host}`).toContain(host);

    // Heuristic: a passthrough block contains the host literal followed by
    // `return;` within ~5 lines, ahead of any respondWith for that host.
    const hostIdx = sw.indexOf(host);
    const window = sw.slice(hostIdx, hostIdx + 300);
    expect(
      /\breturn\s*;/.test(window),
      `sw.js must early-return after matching ${host} (found block: ${window.slice(0, 200)}...)`,
    ).toBe(true);
  });

  it('uses Response.error() fallback to avoid TypeError when fetch is blocked', () => {
    // catch handlers must never resolve to undefined — Response.error() is the
    // documented opaque-failure response that satisfies event.respondWith().
    expect(
      sw.includes('Response.error()'),
      'sw.js .catch() handlers must fall back to Response.error() (or a real Response) — never undefined',
    ).toBe(true);
  });
});
