import { describe, it, expect } from 'vitest';
import { isHttpsUrl } from '../../src/utils/url';

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
});
