import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace('#', '');
  return [
    Number.parseInt(clean.slice(0, 2), 16),
    Number.parseInt(clean.slice(2, 4), 16),
    Number.parseInt(clean.slice(4, 6), 16),
  ];
}

function channel(value: number): number {
  const s = value / 255;
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
}

function luminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex);
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

function contrast(a: string, b: string): number {
  const l1 = luminance(a);
  const l2 = luminance(b);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

describe('<mark> tokens (v3.31 C5)', () => {
  const tokens = readFileSync('src/styles/tokens.css', 'utf8');

  it('keeps mark tokens semantically separate from accent-light because dark values differ', () => {
    expect(tokens).toMatch(/--accent-light:\s*#FEF3C7/);
    expect(tokens).toMatch(/--mark-bg:\s*#FEF3C7/);
    expect(tokens).toMatch(/\[data-theme="dark"\][\s\S]*--accent-light:\s*#422006/);
    expect(tokens).toMatch(/\[data-theme="dark"\][\s\S]*--mark-bg:\s*#78350F/);
  });

  it('light mark contrast passes WCAG AA against text-primary #1E293B', () => {
    expect(contrast('#1E293B', '#FEF3C7')).toBeGreaterThanOrEqual(4.5);
  });

  it('dark mark contrast passes WCAG AA', () => {
    expect(contrast('#FDE68A', '#78350F')).toBeGreaterThanOrEqual(4.5);
  });
});
