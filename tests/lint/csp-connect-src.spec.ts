import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

/**
 * CSP connect-src must contain every external host fetched at runtime.
 * Missing a host causes the browser to block the fetch with a
 * securitypolicyviolation event; production UX breaks silently because
 * services/rss.ts catches the error and returns an empty array.
 *
 * This regression test exists because v3.2a shipped with api.rss2json.com
 * missing from connect-src while services/rss.ts still targeted it — the
 * briefings feature went dark in prod without any failing test.
 */
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');

const REQUIRED_CONNECT_SRC_HOSTS = [
  'https://generativelanguage.googleapis.com', // Gemini
  'https://hooks.slack.com',                   // Slack Incoming Webhook
  'https://api.rss2json.com',                  // RSS fetching (briefings)
];

function extractConnectSrc(csp: string): string {
  const match = csp.match(/connect-src\s+([^;]+)/);
  if (!match) throw new Error('connect-src directive not found');
  return match[1]!.trim();
}

describe('CSP connect-src contains every runtime-fetched host', () => {
  it('index.html <meta http-equiv="Content-Security-Policy"> includes required hosts', () => {
    const html = readFileSync(resolve(ROOT, 'index.html'), 'utf8');
    const metaMatch = html.match(/http-equiv="Content-Security-Policy"\s+content="([^"]+)"/);
    expect(metaMatch, 'index.html must declare a CSP meta tag').not.toBeNull();
    const connectSrc = extractConnectSrc(metaMatch![1]!);
    for (const host of REQUIRED_CONNECT_SRC_HOSTS) {
      expect(connectSrc, `index.html connect-src must include ${host}`).toContain(host);
    }
  });

  it('firebase.json Content-Security-Policy response header includes required hosts', () => {
    const raw = readFileSync(resolve(ROOT, 'firebase.json'), 'utf8');
    const config = JSON.parse(raw) as {
      hosting?: { headers?: Array<{ headers?: Array<{ key?: string; value?: string }> }> };
    };
    const headerEntries = config.hosting?.headers?.flatMap((h) => h.headers ?? []) ?? [];
    const cspHeader = headerEntries.find((h) => h.key === 'Content-Security-Policy');
    expect(cspHeader, 'firebase.json must declare a Content-Security-Policy header').toBeDefined();
    const connectSrc = extractConnectSrc(cspHeader!.value ?? '');
    for (const host of REQUIRED_CONNECT_SRC_HOSTS) {
      expect(connectSrc, `firebase.json connect-src must include ${host}`).toContain(host);
    }
  });
});
