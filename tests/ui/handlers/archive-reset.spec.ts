/**
 * @vitest-environment jsdom
 *
 * v3.37 T1: resetArchiveFilters() 단독 spec.
 * - module state + DOM 동기화 + select-mode bulk button (Codex 사전 P1-1) + counter-click 회귀.
 * - 신규 entry point (T2 plant-detail navigateToInterestArchive 등) 확장 시 동일 파일에 추가.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

beforeEach(() => {
  localStorage.clear();
  document.body.replaceChildren();
});

afterEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
});

describe('resetArchiveFilters — module state', () => {
  it('state 5종이 default 값으로 복귀한다 (export 시그니처 + throw 안 함)', async () => {
    const mod = await import('../../../src/ui/handlers/archive');
    // 사전 setup: 모든 state를 non-default로 mutate
    mod.handleArchiveFilter('memo');
    const input = document.createElement('input');
    input.id = 'archiveSearch';
    input.value = 'foo bar';
    document.body.appendChild(input);
    mod.handleArchiveSearch();

    mod.resetArchiveFilters();

    // 검증: closure state는 직접 read 불가 → export 시그니처 + throw 안 함만 가드.
    // DOM 동기화 + bulk button은 후속 spec block에서 보강.
    expect(typeof mod.resetArchiveFilters).toBe('function');
  });
});

describe('resetArchiveFilters — DOM 동기화', () => {
  /** ESLint no-restricted-syntax(innerHTML)를 피하기 위해 createElement 조합으로 구성. */
  function setupArchiveDom(): void {
    const tab = document.createElement('div');
    tab.id = 'archiveTab';
    tab.classList.add('archive--select-mode');

    const entityChips = document.createElement('div');
    entityChips.id = 'entityChips';
    const entityScrap = document.createElement('button');
    entityScrap.className = 'archive-entity-chip active';
    entityScrap.dataset['entity'] = 'scrap';
    entityScrap.setAttribute('aria-checked', 'true');
    entityScrap.textContent = '스크랩';
    const entityAll = document.createElement('button');
    entityAll.className = 'archive-entity-chip';
    entityAll.dataset['entity'] = 'all';
    entityAll.setAttribute('aria-checked', 'false');
    entityAll.textContent = '전체';
    entityChips.appendChild(entityScrap);
    entityChips.appendChild(entityAll);

    const filters = document.createElement('div');
    filters.id = 'archiveFilters';
    filters.style.display = 'none';
    const filterMemo = document.createElement('button');
    filterMemo.className = 'filter-chip active';
    filterMemo.dataset['filter'] = 'memo';
    filterMemo.disabled = true;
    filterMemo.setAttribute('aria-disabled', 'true');
    filterMemo.textContent = '메모';
    const filterAll = document.createElement('button');
    filterAll.className = 'filter-chip';
    filterAll.dataset['filter'] = 'all';
    filterAll.disabled = true;
    filterAll.setAttribute('aria-disabled', 'true');
    filterAll.textContent = '전체';
    filters.appendChild(filterMemo);
    filters.appendChild(filterAll);

    const selectToggle = document.createElement('button');
    selectToggle.id = 'archiveSelectToggle';
    selectToggle.setAttribute('aria-pressed', 'true');
    selectToggle.textContent = '선택';

    const card = document.createElement('div');
    card.className = 'archive-card selected';
    card.dataset['answerId'] = 'a1';

    tab.appendChild(entityChips);
    tab.appendChild(filters);
    tab.appendChild(selectToggle);
    tab.appendChild(card);
    document.body.appendChild(tab);
  }

  it('entity chip 동기화 — all만 active + aria-checked=true', async () => {
    setupArchiveDom();
    const mod = await import('../../../src/ui/handlers/archive');
    mod.resetArchiveFilters();

    const all = document.querySelector<HTMLButtonElement>('.archive-entity-chip[data-entity="all"]')!;
    const scrap = document.querySelector<HTMLButtonElement>('.archive-entity-chip[data-entity="scrap"]')!;
    expect(all.classList.contains('active')).toBe(true);
    expect(all.getAttribute('aria-checked')).toBe('true');
    expect(scrap.classList.contains('active')).toBe(false);
    expect(scrap.getAttribute('aria-checked')).toBe('false');
  });

  it('filter chip 동기화 — all active + disabled 해제', async () => {
    setupArchiveDom();
    const mod = await import('../../../src/ui/handlers/archive');
    mod.resetArchiveFilters();

    const all = document.querySelector<HTMLButtonElement>('.filter-chip[data-filter="all"]')!;
    const memo = document.querySelector<HTMLButtonElement>('.filter-chip[data-filter="memo"]')!;
    expect(all.classList.contains('active')).toBe(true);
    expect(all.disabled).toBe(false);
    expect(memo.classList.contains('active')).toBe(false);
    expect(memo.disabled).toBe(false);
    expect(memo.hasAttribute('aria-disabled')).toBe(false);
  });

  it('question type row display 복구 + select mode UI 흔적 제거', async () => {
    setupArchiveDom();
    const mod = await import('../../../src/ui/handlers/archive');
    mod.resetArchiveFilters();

    expect(document.getElementById('archiveFilters')!.style.display).toBe('');
    expect(document.getElementById('archiveSelectToggle')!.getAttribute('aria-pressed')).toBe('false');
    expect(document.getElementById('archiveTab')!.classList.contains('archive--select-mode')).toBe(false);
    expect(document.querySelectorAll('.archive-card.selected').length).toBe(0);
  });

  it('archive DOM이 mount 안 된 상태(다른 탭)에서 silent no-op', async () => {
    // setupArchiveDom 호출 없음 — empty body
    const mod = await import('../../../src/ui/handlers/archive');
    expect(() => mod.resetArchiveFilters()).not.toThrow();
  });

  // v2 (Codex 사전 P1-1): select mode 중간 reset 진입 시 bulk button 회귀 가드.
  it('select mode 중간 reset → #archiveBulkDelete disabled + count textContent === 0', async () => {
    setupArchiveDom();
    // bulk button 추가 (setupArchiveDom 외 별도)
    const bulk = document.createElement('button');
    bulk.id = 'archiveBulkDelete';
    bulk.textContent = '선택 항목 삭제 (3)';
    bulk.disabled = false;
    document.body.appendChild(bulk);

    const mod = await import('../../../src/ui/handlers/archive');
    mod.resetArchiveFilters();

    expect(bulk.disabled).toBe(true);
    expect(bulk.textContent).toContain('(0)');
  });
});

describe('counter-click → resetArchiveFilters 통합', () => {
  it('.other-pin-counter click → entity/filter all active 복귀 + question row 표시', async () => {
    const tab = document.createElement('div');
    tab.id = 'archiveTab';

    const entityScrap = document.createElement('button');
    entityScrap.className = 'archive-entity-chip active';
    entityScrap.dataset['entity'] = 'scrap';
    entityScrap.setAttribute('aria-checked', 'true');
    entityScrap.textContent = '스크랩';

    const entityAll = document.createElement('button');
    entityAll.className = 'archive-entity-chip';
    entityAll.dataset['entity'] = 'all';
    entityAll.setAttribute('aria-checked', 'false');
    entityAll.textContent = '전체';

    const filters = document.createElement('div');
    filters.id = 'archiveFilters';
    filters.style.display = 'none';

    const counter = document.createElement('div');
    counter.className = 'other-pin-counter';
    counter.textContent = '다른 카테고리 보기';

    tab.appendChild(entityScrap);
    tab.appendChild(entityAll);
    tab.appendChild(filters);
    tab.appendChild(counter);
    document.body.appendChild(tab);

    const mod = await import('../../../src/ui/handlers/archive');
    mod.mountArchiveHandlers();

    document.querySelector<HTMLElement>('.other-pin-counter')!.click();

    const all = document.querySelector<HTMLButtonElement>('.archive-entity-chip[data-entity="all"]')!;
    expect(all.classList.contains('active')).toBe(true);
    expect(all.getAttribute('aria-checked')).toBe('true');
    expect(document.getElementById('archiveFilters')!.style.display).toBe('');
  });
});
