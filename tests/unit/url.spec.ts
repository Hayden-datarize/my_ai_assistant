import { describe, it, expect } from 'vitest';
import { isHttpsUrl, isSafeUrl } from '../../src/utils/url';

describe('isHttpsUrl', () => {
  it('accepts https:// URLs', () => {
    expect(isHttpsUrl('https://example.com')).toBe(true);
    expect(isHttpsUrl('https://cdn.example.com/img.jpg')).toBe(true);
    expect(isHttpsUrl('HTTPS://example.com')).toBe(true); // protocol case-insensitive
  });

  it('rejects http://', () => {
    expect(isHttpsUrl('http://example.com')).toBe(false);
  });

  it('rejects javascript: / data: schemes', () => {
    expect(isHttpsUrl('javascript:alert(1)')).toBe(false);
    expect(isHttpsUrl('data:text/html,<script>')).toBe(false);
  });

  it('rejects malformed input', () => {
    expect(isHttpsUrl('not a url')).toBe(false);
    expect(isHttpsUrl('')).toBe(false);
    expect(isHttpsUrl('  https://example.com  ')).toBe(false); // whitespace not auto-trimmed
  });

  it('rejects non-string types', () => {
    expect(isHttpsUrl(null)).toBe(false);
    expect(isHttpsUrl(undefined)).toBe(false);
    expect(isHttpsUrl(123)).toBe(false);
    expect(isHttpsUrl({})).toBe(false);
  });

  it('rejects bare-path scheme (defense-in-depth, v3.6 P2-2)', () => {
    expect(isHttpsUrl('https:foo')).toBe(false);
    expect(isHttpsUrl('https:foo/bar')).toBe(false);
    expect(isHttpsUrl('https:./relative')).toBe(false);
  });

  it('rejects backslash variants (v3.6 P2-2)', () => {
    expect(isHttpsUrl('https:\\\\evil.com')).toBe(false);
  });

  it('rejects empty hostname (v3.6 P2-2)', () => {
    expect(isHttpsUrl('https://')).toBe(false);
    expect(isHttpsUrl('https:///path')).toBe(false);
  });

  it('rejects case-insensitive bare-path scheme (v3.6 P2-2 회귀)', () => {
    expect(isHttpsUrl('HTTPS:foo')).toBe(false);
  });
});

describe('isSafeUrl (v3.41 T4 — Codex P1 F4)', () => {
  it('accepts https URL', () => {
    expect(isSafeUrl('https://example.com/article')).toBe(true);
  });

  it('accepts http URL (legacy/external RSS 대비)', () => {
    expect(isSafeUrl('http://example.com')).toBe(true);
  });

  it('accepts case-insensitive scheme', () => {
    expect(isSafeUrl('HTTPS://example.com')).toBe(true);
    expect(isSafeUrl('HTTP://example.com')).toBe(true);
  });

  it('rejects javascript: scheme (XSS vector)', () => {
    expect(isSafeUrl('javascript:alert(1)')).toBe(false);
    expect(isSafeUrl('JAVASCRIPT:alert(1)')).toBe(false);
  });

  it('rejects data: scheme', () => {
    expect(isSafeUrl('data:text/html,<script>alert(1)</script>')).toBe(false);
  });

  it('rejects vbscript: scheme', () => {
    expect(isSafeUrl('vbscript:msgbox("x")')).toBe(false);
  });

  it('rejects file: scheme', () => {
    expect(isSafeUrl('file:///etc/passwd')).toBe(false);
  });

  it('rejects blob: scheme', () => {
    expect(isSafeUrl('blob:https://example.com/abc')).toBe(false);
  });

  it('rejects empty string', () => {
    expect(isSafeUrl('')).toBe(false);
  });

  it('rejects non-string types', () => {
    expect(isSafeUrl(undefined)).toBe(false);
    expect(isSafeUrl(null)).toBe(false);
    expect(isSafeUrl(123)).toBe(false);
    expect(isSafeUrl({ url: 'https://x.com' })).toBe(false);
  });

  it('rejects bare-path scheme (https:foo, http:foo)', () => {
    expect(isSafeUrl('https:foo')).toBe(false);
    expect(isSafeUrl('http:foo')).toBe(false);
  });

  it('rejects empty authority (https:///path)', () => {
    expect(isSafeUrl('https:///path')).toBe(false);
    expect(isSafeUrl('http:///path')).toBe(false);
  });

  it('rejects leading/trailing whitespace (caller responsibility)', () => {
    expect(isSafeUrl(' https://example.com ')).toBe(false);
  });
});
