import { describe, it, expect } from 'vitest';
import { escapeHtml } from '../../src/utils/escapeHtml';

describe('escapeHtml', () => {
  it('escapes the five HTML special characters', () => {
    expect(escapeHtml('<script>')).toBe('&lt;script&gt;');
    expect(escapeHtml('a & b')).toBe('a &amp; b');
    expect(escapeHtml('"hi"')).toBe('&quot;hi&quot;');
    expect(escapeHtml("'hi'")).toBe('&#39;hi&#39;');
  });
  it('handles empty string and non-string falsy', () => {
    expect(escapeHtml('')).toBe('');
    expect(escapeHtml(null as unknown as string)).toBe('');
    expect(escapeHtml(undefined as unknown as string)).toBe('');
  });
  it('preserves safe content', () => {
    expect(escapeHtml('hello world 123')).toBe('hello world 123');
  });
});
