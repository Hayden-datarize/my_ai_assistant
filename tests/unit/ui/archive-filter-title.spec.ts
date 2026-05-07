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

describe('v3.20 H5: archive 전체 chip title 정정', () => {
  it('전체 chip title clarifies answers-only scope (스크랩 분리 명시)', () => {
    expect(archiveTabSource).toMatch(/data-filter="all"\s+title="모든 답변/);
    expect(archiveTabSource).toMatch(/스크랩은\s*⭐\s*칩/);
  });

  it('does not promise "답변 + 스크랩 모든 기록" (이전 mismatch 텍스트 재발 가드)', () => {
    expect(archiveTabSource).not.toMatch(/title="답변\s*\+\s*스크랩\s*모든\s*기록"/);
  });

  it('스크랩 chip is still separate (data-filter="scrap")', () => {
    // 사용자가 스크랩 보려면 분리된 ⭐ 스크랩 chip 사용 — 회귀 가드
    expect(archiveTabSource).toMatch(/data-filter="scrap"/);
  });
});
