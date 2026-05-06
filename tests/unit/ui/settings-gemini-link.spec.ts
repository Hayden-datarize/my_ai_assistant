import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('v3.18.1 H6 (#1) — Gemini API key 발급 안내', () => {
  let settingsTs: string;
  beforeAll(() => {
    settingsTs = readFileSync(resolve(__dirname, '../../../src/ui/tabs/settings.ts'), 'utf-8');
  });

  it('Gemini 섹션에 aistudio.google.com 링크 포함', () => {
    expect(settingsTs).toMatch(/aistudio\.google\.com\/app\/apikey/);
  });

  it('Gemini 섹션에 <details> 안내 블록 포함', () => {
    expect(settingsTs).toMatch(/Gemini API 키[\s\S]*?<details/);
  });

  it('Gemini 외부 링크는 noopener noreferrer 보호', () => {
    expect(settingsTs).toMatch(/aistudio\.google\.com[\s\S]*?rel="noopener[^"]*noreferrer/);
  });
});
