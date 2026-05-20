import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

/**
 * v3.41 T1 (Codex 최종 review P1-A — REJECT catch): App Check + reCAPTCHA v3
 * CSP allowlist 회귀 가드.
 *
 * Phase A monitor 시 ReCaptchaV3Provider가 `https://www.google.com/recaptcha/api.js`
 * 를 동적 주입한다. `script-src 'self'`만 허용하면 production에서 token 발급이
 * silently 차단되어 Phase A monitor 데이터가 무효화됨 (Phase B enforce 판단
 * 근거 깨짐).
 *
 * 본 spec은 index.html meta CSP + firebase.json header CSP 둘 다에서:
 *   - script-src: www.google.com/recaptcha + www.gstatic.com/recaptcha 허용
 *   - frame-src: www.google.com/recaptcha 허용 (reCAPTCHA challenge iframe)
 * 잔존 여부를 정적으로 검증한다.
 */
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');

const REQUIRED_SCRIPT_SRC_HOSTS = [
  'https://www.google.com/recaptcha/',
  'https://www.gstatic.com/recaptcha/',
];

const REQUIRED_FRAME_SRC_HOSTS = [
  'https://www.google.com/recaptcha/',
];

function extractDirective(csp: string, name: string): string {
  const match = csp.match(new RegExp(`${name}\\s+([^;]+)`));
  if (!match) throw new Error(`${name} directive not found`);
  return match[1]!.trim();
}

function loadIndexHtmlCsp(): string {
  const html = readFileSync(resolve(ROOT, 'index.html'), 'utf-8');
  const match = html.match(/<meta\s+http-equiv="Content-Security-Policy"\s+content="([^"]+)"/);
  if (!match) throw new Error('meta CSP not found in index.html');
  return match[1]!;
}

function loadFirebaseHeaderCsp(): string {
  const cfg = JSON.parse(readFileSync(resolve(ROOT, 'firebase.json'), 'utf-8'));
  type FirebaseHeader = { key: string; value: string };
  type FirebaseRoute = { headers?: FirebaseHeader[] };
  const headers = (cfg.hosting?.headers as FirebaseRoute[] | undefined) ?? [];
  for (const route of headers) {
    for (const h of route.headers ?? []) {
      if (h.key === 'Content-Security-Policy') return h.value;
    }
  }
  throw new Error('Content-Security-Policy header not found in firebase.json');
}

describe('CSP allows Firebase App Check (reCAPTCHA v3) — v3.41 T1', () => {
  const indexCsp = loadIndexHtmlCsp();
  const firebaseCsp = loadFirebaseHeaderCsp();

  describe('index.html meta CSP', () => {
    const scriptSrc = extractDirective(indexCsp, 'script-src');
    const frameSrc = extractDirective(indexCsp, 'frame-src');

    it.each(REQUIRED_SCRIPT_SRC_HOSTS)('script-src allows %s', (host) => {
      expect(scriptSrc, `script-src: "${scriptSrc}"`).toContain(host);
    });

    it.each(REQUIRED_FRAME_SRC_HOSTS)('frame-src allows %s', (host) => {
      expect(frameSrc, `frame-src: "${frameSrc}"`).toContain(host);
    });
  });

  describe('firebase.json header CSP', () => {
    const scriptSrc = extractDirective(firebaseCsp, 'script-src');
    const frameSrc = extractDirective(firebaseCsp, 'frame-src');

    it.each(REQUIRED_SCRIPT_SRC_HOSTS)('script-src allows %s', (host) => {
      expect(scriptSrc, `script-src: "${scriptSrc}"`).toContain(host);
    });

    it.each(REQUIRED_FRAME_SRC_HOSTS)('frame-src allows %s', (host) => {
      expect(frameSrc, `frame-src: "${frameSrc}"`).toContain(host);
    });
  });

  it('index.html meta CSP and firebase.json header CSP are consistent for script-src/frame-src App Check hosts', () => {
    // 두 CSP가 동일 host 집합을 가져야 함 (drift 차단).
    const indexScript = extractDirective(indexCsp, 'script-src');
    const firebaseScript = extractDirective(firebaseCsp, 'script-src');
    const indexFrame = extractDirective(indexCsp, 'frame-src');
    const firebaseFrame = extractDirective(firebaseCsp, 'frame-src');
    for (const host of REQUIRED_SCRIPT_SRC_HOSTS) {
      expect(indexScript.includes(host)).toBe(true);
      expect(firebaseScript.includes(host)).toBe(true);
    }
    for (const host of REQUIRED_FRAME_SRC_HOSTS) {
      expect(indexFrame.includes(host)).toBe(true);
      expect(firebaseFrame.includes(host)).toBe(true);
    }
  });
});
