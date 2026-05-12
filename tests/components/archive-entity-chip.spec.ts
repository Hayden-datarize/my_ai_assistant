/**
 * v3.30 T2: renderEntityChipRow(active, counts) signature 확장 spec.
 * - counts 제공 시: `<span class="archive-entity-count">` 4개 렌더.
 * - counts === null (default): count span 비표시 (placeholder 0 X) — R1 race 방어.
 * - active class + aria-checked 유지 (v3.27 T2b 정합).
 */
import { describe, it, expect } from 'vitest';
import { renderEntityChipRow } from '../../src/ui/components/archive-entity-chip';

describe('v3.30 T2: renderEntityChipRow with counts', () => {
  it('counts 제공 시 archive-entity-count span 4개 렌더', () => {
    const html = renderEntityChipRow('all', { all: 12, answer: 5, scrap: 4, insight: 3 });
    expect(html).toContain('archive-entity-count');
    expect(html).toMatch(/data-entity-count="all">12</);
    expect(html).toMatch(/data-entity-count="answer">5</);
    expect(html).toMatch(/data-entity-count="scrap">4</);
    expect(html).toMatch(/data-entity-count="insight">3</);
  });

  it('counts === null 시 카운트 span 비표시 (placeholder 0 X)', () => {
    const html = renderEntityChipRow('all', null);
    expect(html).not.toContain('archive-entity-count');
    expect(html).not.toContain('data-entity-count');
  });

  it('counts 인자 생략(default null) 시 v3.27 호환 — count span 비표시', () => {
    const html = renderEntityChipRow('all');
    expect(html).not.toContain('archive-entity-count');
  });

  it('active entity는 active class + aria-checked=true', () => {
    const html = renderEntityChipRow('scrap', null);
    // class와 data-entity 순서가 어느 쪽이든 정합 — chip 단위 substring 검증
    expect(html).toMatch(/<button[^>]*class="[^"]*active[^"]*"[^>]*data-entity="scrap"/);
    expect(html).toMatch(/data-entity="scrap"[^>]*aria-checked="true"/);
  });

  it('비-active entity는 aria-checked=false + no active class', () => {
    const html = renderEntityChipRow('scrap', null);
    expect(html).toMatch(/data-entity="all"[^>]*aria-checked="false"/);
    // 'all' chip에는 active class 없음 — chip 단위 검증
    expect(html).not.toMatch(/<button[^>]*class="[^"]*active[^"]*"[^>]*data-entity="all"/);
  });

  it('count 0 (silent corruption guard) — 0도 정확히 출력', () => {
    const html = renderEntityChipRow('all', { all: 0, answer: 0, scrap: 0, insight: 0 });
    expect(html).toMatch(/data-entity-count="all">0</);
    expect(html).toMatch(/data-entity-count="answer">0</);
  });
});
