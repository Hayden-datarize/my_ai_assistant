import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'fs';
import { resolve, join } from 'path';

// v3.20 T8 (C2): 외부 링크 rel="noopener noreferrer" 통일.
// v3.18.1 carry-forward — settings.ts:52 패턴 정합. target="_blank" 사용 시 noopener+noreferrer 강제.
//
// 회귀 가드 — `target="_blank"`을 가진 모든 <a> 태그가 rel에 noopener+noreferrer 둘 다 포함.

const SRC_ROOT = resolve(__dirname, '../../src');
const INDEX_HTML = resolve(__dirname, '../../index.html');

function walk(dir: string, exts: string[]): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    const stat = statSync(path);
    if (stat.isDirectory()) out.push(...walk(path, exts));
    else if (exts.some((e) => entry.endsWith(e))) out.push(path);
  }
  return out;
}

const sourceFiles = [...walk(SRC_ROOT, ['.ts', '.tsx', '.html']), INDEX_HTML];

// regex: <a ...> with target="_blank" — capture rel attribute (또는 부재)
const ANCHOR_RE = /<a\b[^>]*\btarget=["']_blank["'][^>]*>/gi;
const REL_RE = /\brel=["']([^"']*)["']/i;

describe('v3.20 T8: target="_blank" links require rel="noopener noreferrer"', () => {
  for (const file of sourceFiles) {
    const content = readFileSync(file, 'utf-8');
    const matches = content.match(ANCHOR_RE);
    if (!matches) continue;
    for (const tag of matches) {
      it(`${file.replace(SRC_ROOT, 'src').replace(INDEX_HTML, 'index.html')}: ${tag.slice(0, 80)}...`, () => {
        const rel = tag.match(REL_RE)?.[1] ?? '';
        expect(rel).toContain('noopener');
        expect(rel).toContain('noreferrer');
      });
    }
  }
  // dynamic createElement <a target="_blank"> — element.rel 검증 (간접 검증, source string 매칭)
  it('createElement-style: link.rel contains both noopener + noreferrer', () => {
    const tsFiles = walk(SRC_ROOT, ['.ts', '.tsx']);
    for (const file of tsFiles) {
      const content = readFileSync(file, 'utf-8');
      // link.target = '_blank' 패턴 발견 시 link.rel = 'noopener noreferrer' 명시 강제
      if (/\.target\s*=\s*['"]_blank['"]/.test(content)) {
        expect(content, file).toMatch(/\.rel\s*=\s*['"][^'"]*\bnoopener\b[^'"]*\bnoreferrer\b[^'"]*['"]/);
      }
    }
  });
});
