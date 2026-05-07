import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

// v3.20 H5 (F5): archive '전체' chip title — UI/code 정합 회복.
// production 발견 — title="답변 + 스크랩 모든 기록" 이지만 code(handlers/archive.ts:435-437)는
// 'all' 분기에서 answers만 렌더링. mismatch.
// Q4=b 안전 옵션 — title 텍스트만 정정, code 그대로 (스크랩은 별도 ⭐ 칩 분리 유지).

const archiveTabSource = readFileSync(
  resolve(__dirname, '../../../src/ui/tabs/archive.ts'),
  'utf-8',
);

describe('v3.20.1 H4: archive 전체 chip — answers + scrapped 통합 렌더링 (사용자 의도)', () => {
  it('전체 chip title promises answers + scrapped (UI/code 정합)', () => {
    expect(archiveTabSource).toMatch(/data-filter="all"\s+title="답변\s*\+\s*스크랩\s*모든\s*기록"/);
  });

  it('스크랩 chip is still separate (data-filter="scrap")', () => {
    // 사용자가 스크랩만 보려면 별도 ⭐ 스크랩 chip 사용 — 회귀 가드
    expect(archiveTabSource).toMatch(/data-filter="scrap"/);
  });
});
