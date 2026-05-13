import { describe, it, expect, beforeEach } from 'vitest';

/**
 * v3.27 T2b: entity chip 1차 row + 2-row 하이라키 + ⭐스크랩 chip 제거 (P0-4).
 */

describe('v3.27 T2b: entity chip 1차 row', () => {
  beforeEach(async () => {
    localStorage.clear();
    sessionStorage.clear();
    document.body.replaceChildren();
  });

  it('entity chip row — 4개 chip [전체/답변/스크랩/인사이트] 노출', async () => {
    const tab = await import('../../src/ui/tabs/archive');
    const container = document.createElement('div');
    tab.renderArchive(container);
    const chips = container.querySelectorAll<HTMLButtonElement>('.archive-entity-chip[data-entity]');
    expect(chips).toHaveLength(4);
    expect([...chips].map(c => c.dataset['entity'])).toEqual(['all', 'answer', 'scrap', 'insight']);
  });

  it('entity chip ARIA radiogroup — role + aria-checked default "all"', async () => {
    const tab = await import('../../src/ui/tabs/archive');
    const container = document.createElement('div');
    tab.renderArchive(container);
    const row = container.querySelector('#archiveEntityFilters');
    expect(row?.getAttribute('role')).toBe('radiogroup');
    const allChip = container.querySelector<HTMLButtonElement>('.archive-entity-chip[data-entity="all"]');
    expect(allChip?.getAttribute('aria-checked')).toBe('true');
  });

  it('entity="scrap" 선택 시 2차 row(question type) 숨김', async () => {
    const tab = await import('../../src/ui/tabs/archive');
    const handlers = await import('../../src/ui/handlers/archive');
    const container = document.createElement('div');
    container.id = 'archiveTab';
    document.body.appendChild(container);
    tab.renderArchive(container);
    handlers.mountArchiveHandlers();

    const scrapChip = document.querySelector<HTMLButtonElement>('.archive-entity-chip[data-entity="scrap"]');
    scrapChip!.click();

    const questionRow = document.getElementById('archiveFilters');
    expect(questionRow?.style.display).toBe('none');
  });

  it('⭐ 스크랩 chip(data-filter="scrap") 제거 — entity chip 흡수 (P0-4)', async () => {
    const tab = await import('../../src/ui/tabs/archive');
    const container = document.createElement('div');
    tab.renderArchive(container);
    expect(container.querySelector('[data-filter="scrap"]')).toBeNull();
  });
});
