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

describe('v3.27 T2b: archive 2-row 하이라키 — entity chip 1차 / question type 2차', () => {
  it('전체 chip(question type) title — 답변 모든 유형 (T2b 갱신)', () => {
    // v3.27 T2b: 2-row 분리 후 전체 chip은 question type 차원에서만 의미.
    // entity chip='all' 단독으로 답변+스크랩+인사이트 통합 안내.
    expect(archiveTabSource).toMatch(/data-filter="all"\s+title="답변\s*모든\s*유형"/);
  });

  it('⭐ 스크랩 chip 제거 (P0-4) — entity chip "scrap"으로 흡수', () => {
    // v3.27 T2b: 기존 question type row의 ⭐ 스크랩 chip(data-filter="scrap") 제거.
    // 스크랩만 보려면 entity chip [data-entity="scrap"] 사용.
    expect(archiveTabSource).not.toMatch(/data-filter="scrap"/);
    expect(archiveTabSource).toMatch(/data-entity="scrap"|renderEntityChipRow/);
  });
});
