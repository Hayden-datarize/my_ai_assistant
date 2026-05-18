import { describe, it, expect } from 'vitest';
import { renderArchiveSearchSummary, type ArchiveSearchCounts } from '../../../src/ui/components/archive-search-summary';

describe('renderArchiveSearchSummary (v3.38 T7a C1)', () => {
  it('renders 3 chips with hit counts (answer/scrap/insight)', () => {
    const counts: ArchiveSearchCounts = { answer: 12, scrap: 5, insight: 2 };
    const el = renderArchiveSearchSummary(counts);
    expect(el).not.toBeNull();
    expect(el?.querySelector('button[data-entity="answer"]')?.textContent).toContain('답변 12');
    expect(el?.querySelector('button[data-entity="scrap"]')?.textContent).toContain('스크랩 5');
    expect(el?.querySelector('button[data-entity="insight"]')?.textContent).toContain('인사이트 2');
  });

  it('omits chips with hit count 0', () => {
    const counts: ArchiveSearchCounts = { answer: 12, scrap: 0, insight: 0 };
    const el = renderArchiveSearchSummary(counts);
    expect(el?.querySelector('button[data-entity="scrap"]')).toBeNull();
    expect(el?.querySelector('button[data-entity="insight"]')).toBeNull();
    expect(el?.querySelector('button[data-entity="answer"]')).not.toBeNull();
  });

  it('returns null when all counts are 0', () => {
    const counts: ArchiveSearchCounts = { answer: 0, scrap: 0, insight: 0 };
    expect(renderArchiveSearchSummary(counts)).toBeNull();
  });

  it('chips are buttons with type="button" + data-entity + aria-label', () => {
    const counts: ArchiveSearchCounts = { answer: 1, scrap: 0, insight: 0 };
    const el = renderArchiveSearchSummary(counts);
    const btn = el?.querySelector<HTMLButtonElement>('button[data-entity="answer"]');
    expect(btn).toBeTruthy();
    expect(btn?.tagName).toBe('BUTTON');
    expect(btn?.type).toBe('button');
    expect(btn?.getAttribute('aria-label')).toContain('답변');
  });

  it('chip order: answer → scrap → insight (canonical order)', () => {
    const counts: ArchiveSearchCounts = { answer: 1, scrap: 1, insight: 1 };
    const el = renderArchiveSearchSummary(counts);
    const chips = el?.querySelectorAll<HTMLElement>('button[data-entity]');
    expect(chips?.[0]?.dataset.entity).toBe('answer');
    expect(chips?.[1]?.dataset.entity).toBe('scrap');
    expect(chips?.[2]?.dataset.entity).toBe('insight');
  });

  it('prefix label "검색 결과:" 표시', () => {
    const counts: ArchiveSearchCounts = { answer: 1, scrap: 0, insight: 0 };
    const el = renderArchiveSearchSummary(counts);
    expect(el?.querySelector('.archive-search-summary-label')?.textContent).toBe('검색 결과:');
  });
});
