import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

/**
 * v3.20 T9 (C3): CSP connect-src dead allowance 정리 회귀 가드.
 *
 * v3.19 carry-forward — 다음 호스트는 SDK 미사용으로 dead allowance 였음.
 * 본 사이클 (v3.20) 에서 제거 확정. 향후 SDK 도입 시 명시적 추가 강제.
 *
 * - *.firebaseio.com — Firebase Realtime Database SDK 미사용 (grep 0건)
 * - *.sentry.io — Sentry SDK 미설치 (grep 0건)
 *
 * *.googleapis.com wildcard 는 Firebase Hosting 내부 SDK indirect risk 회피 위해 유지 (P1-6).
 */
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');

const FORBIDDEN_HOSTS = [
  'firebaseio.com', // dead — Realtime DB 미사용
  'sentry.io',      // dead — Sentry SDK 미설치
];

function extractConnectSrc(csp: string): string {
  const match = csp.match(/connect-src\s+([^;]+)/);
  if (!match) throw new Error('connect-src directive not found');
  return match[1]!.trim();
}

describe('v3.20 T9: CSP connect-src dead allowance 회귀 가드', () => {
  it('index.html connect-src does not include firebaseio/sentry', () => {
    const html = readFileSync(resolve(ROOT, 'index.html'), 'utf8');
    const meta = html.match(/http-equiv="Content-Security-Policy"\s+content="([^"]+)"/);
    expect(meta).not.toBeNull();
    const connectSrc = extractConnectSrc(meta![1]!);
    for (const host of FORBIDDEN_HOSTS) {
      expect(connectSrc, `index.html connect-src must NOT include ${host}`).not.toContain(host);
    }
  });

  it('firebase.json connect-src does not include firebaseio/sentry', () => {
    const raw = readFileSync(resolve(ROOT, 'firebase.json'), 'utf8');
    const config = JSON.parse(raw) as {
      hosting?: { headers?: Array<{ headers?: Array<{ key?: string; value?: string }> }> };
    };
    const headers = config.hosting?.headers?.flatMap((h) => h.headers ?? []) ?? [];
    const csp = headers.find((h) => h.key === 'Content-Security-Policy');
    expect(csp).toBeDefined();
    const connectSrc = extractConnectSrc(csp!.value ?? '');
    for (const host of FORBIDDEN_HOSTS) {
      expect(connectSrc, `firebase.json connect-src must NOT include ${host}`).not.toContain(host);
    }
  });

  it('index.html and firebase.json connect-src tokens match (sync 회귀 가드)', () => {
    const html = readFileSync(resolve(ROOT, 'index.html'), 'utf8');
    const meta = html.match(/http-equiv="Content-Security-Policy"\s+content="([^"]+)"/);
    const htmlConnectSrc = extractConnectSrc(meta![1]!);

    const raw = readFileSync(resolve(ROOT, 'firebase.json'), 'utf8');
    const config = JSON.parse(raw) as {
      hosting?: { headers?: Array<{ headers?: Array<{ key?: string; value?: string }> }> };
    };
    const headers = config.hosting?.headers?.flatMap((h) => h.headers ?? []) ?? [];
    const csp = headers.find((h) => h.key === 'Content-Security-Policy');
    const jsonConnectSrc = extractConnectSrc(csp!.value ?? '');

    const htmlTokens = new Set(htmlConnectSrc.split(/\s+/));
    const jsonTokens = new Set(jsonConnectSrc.split(/\s+/));
    expect(htmlTokens, 'index.html and firebase.json connect-src tokens must match').toEqual(jsonTokens);
  });

  it('googleapis.com wildcard is preserved (P1-6 — Firebase Hosting indirect SDK)', () => {
    const html = readFileSync(resolve(ROOT, 'index.html'), 'utf8');
    const meta = html.match(/http-equiv="Content-Security-Policy"\s+content="([^"]+)"/);
    const connectSrc = extractConnectSrc(meta![1]!);
    expect(connectSrc).toContain('https://*.googleapis.com');
  });
});
