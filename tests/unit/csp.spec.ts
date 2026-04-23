import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';

describe('CSP img-src policy (v3.3.3)', () => {
  it('firebase.json allows https: img', () => {
    const json = JSON.parse(readFileSync('firebase.json', 'utf8'));
    const headers = json.hosting.headers[0].headers;
    const csp = headers.find(
      (h: { key: string; value: string }) => h.key === 'Content-Security-Policy',
    ).value;
    expect(csp).toMatch(/img-src[^;]*\bhttps:/);
  });

  it('index.html meta tag allows https: img', () => {
    const html = readFileSync('index.html', 'utf8');
    const meta = html.match(/<meta http-equiv="Content-Security-Policy"[^>]*content="([^"]+)"/);
    expect(meta?.[1]).toMatch(/img-src[^;]*\bhttps:/);
  });

  it('firebase.json and index.html img-src remain synchronized', () => {
    const json = JSON.parse(readFileSync('firebase.json', 'utf8'));
    const fbCsp = json.hosting.headers[0].headers.find(
      (h: { key: string; value: string }) => h.key === 'Content-Security-Policy',
    ).value;
    const html = readFileSync('index.html', 'utf8');
    const metaCsp =
      html.match(/<meta http-equiv="Content-Security-Policy"[^>]*content="([^"]+)"/)?.[1] ?? '';
    const fbImg = fbCsp.match(/img-src[^;]+/)?.[0]?.trim();
    const metaImg = metaCsp.match(/img-src[^;]+/)?.[0]?.trim();
    expect(fbImg).toBe(metaImg);
  });
});
