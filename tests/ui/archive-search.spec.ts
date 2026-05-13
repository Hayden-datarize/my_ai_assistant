import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { registerCoreHandlerListeners, resetCoreHandlerListenersForTest } from '../../src/ui/handlers/register';

/**
 * v3.27 T3: archive 검색 enhancement — debounce 200ms + IME composition 가드 + NFC normalize + chip AND + 빈 결과 aria-live.
 *
 * 단위 테스트 5건 (spec §5.7: jsdom IME 한계로 IME spec은 listener 등록 여부 검증으로 격하).
 */

async function setupArchive(): Promise<void> {
  const tab = await import('../../src/ui/tabs/archive');
  const handlers = await import('../../src/ui/handlers/archive');
  // eslint-disable-next-line no-restricted-syntax -- jsdom fixture, no user interpolation
  document.body.innerHTML = '<div id="archiveTab"></div>';
  const container = document.getElementById('archiveTab')!;
  tab.renderArchive(container);
  handlers.mountArchiveHandlers();
  registerCoreHandlerListeners();
}

describe('v3.27 T3: archive 검색 enhancement', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    // eslint-disable-next-line no-restricted-syntax -- jsdom fixture cleanup, no user interpolation
    document.body.innerHTML = '';
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    resetCoreHandlerListenersForTest();
  });

  it('debounce 200ms — 연속 input 3회 후 단일 search 트리거', async () => {
    vi.useFakeTimers();
    await setupArchive();

    const searchSpy = vi.fn();
    document.addEventListener('dg:archive:search', searchSpy);

    const input = document.getElementById('archiveSearch') as HTMLInputElement;
    input.value = 'a';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.value = 'ab';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.value = 'abc';
    input.dispatchEvent(new Event('input', { bubbles: true }));

    // 150ms 진행 — 아직 debounce 끝나지 않음
    await vi.advanceTimersByTimeAsync(150);
    expect(searchSpy).not.toHaveBeenCalled();

    // 추가 60ms — 마지막 input 후 총 210ms → 트리거
    await vi.advanceTimersByTimeAsync(60);
    expect(searchSpy).toHaveBeenCalledTimes(1);
  });

  it('chip AND — entity=answer + question chip=분석 + search query 모두 AND', async () => {
    // 시드: 분석/실무 답변 각 2건
    const answers = [
      { id: 'a1', text: '분석 키워드 매칭', type: '분석', createdAt: '2026-05-10T10:00:00.000Z', date: '2026-05-10' },
      { id: 'a2', text: '다른 분석 답', type: '분석', createdAt: '2026-05-10T11:00:00.000Z', date: '2026-05-10' },
      { id: 'a3', text: '분석 키워드 매칭', type: '실무', createdAt: '2026-05-10T12:00:00.000Z', date: '2026-05-10' },
    ];
    localStorage.setItem('dg.answers', JSON.stringify(answers));

    await setupArchive();

    // entity chip = answer
    document.querySelector<HTMLButtonElement>('.archive-entity-chip[data-entity="answer"]')!.click();
    // question chip = 분석
    document.querySelector<HTMLButtonElement>('.filter-chip[data-filter="분석"]')!.click();
    // search = "키워드"
    const input = document.getElementById('archiveSearch') as HTMLInputElement;
    input.value = '키워드';
    document.dispatchEvent(new CustomEvent('dg:archive:search'));

    const list = document.getElementById('archiveList')!;
    await vi.waitFor(() => {
      const cards = list.querySelectorAll('.archive-card');
      // a1만 만족 (entity=answer ∧ type=분석 ∧ text~'키워드')
      expect(cards.length).toBe(1);
      expect(list.textContent).toContain('분석 키워드 매칭');
      expect(list.textContent).not.toContain('다른 분석 답');
    });
  });

  it('NFC normalize — NFD 분해된 한국어 검색어도 NFC 정규화 답변과 매치', async () => {
    // 시드: '하다' NFC 정규화된 답변
    const nfcText = '오늘 하다 키워드'.normalize('NFC');
    const answers = [
      { id: 'a1', text: nfcText, type: '분석', createdAt: '2026-05-10T10:00:00.000Z', date: '2026-05-10' },
    ];
    localStorage.setItem('dg.answers', JSON.stringify(answers));

    await setupArchive();

    // 검색어를 NFD로 입력 (조합형 분해)
    const input = document.getElementById('archiveSearch') as HTMLInputElement;
    const nfdQuery = '하다'.normalize('NFD');
    // NFD ≠ NFC byte-level (분해형 한글)
    expect(nfdQuery).not.toBe('하다'.normalize('NFC'));
    input.value = nfdQuery;
    document.dispatchEvent(new CustomEvent('dg:archive:search'));

    const list = document.getElementById('archiveList')!;
    await vi.waitFor(() => {
      expect(list.querySelectorAll('.archive-card').length).toBe(1);
    });
  });

  it('빈 결과 — aria-live="polite" 메시지 + search input aria-label', async () => {
    // 시드 없음 (빈 답변)
    await setupArchive();

    // search input aria-label (spec §5.6)
    const input = document.getElementById('archiveSearch') as HTMLInputElement;
    expect(input.getAttribute('aria-label')).toBe('archive 검색');

    // entity=answer, search = 'nomatch'
    document.querySelector<HTMLButtonElement>('.archive-entity-chip[data-entity="answer"]')!.click();
    input.value = 'nomatch';
    document.dispatchEvent(new CustomEvent('dg:archive:search'));

    const list = document.getElementById('archiveList')!;
    await vi.waitFor(() => {
      expect(list.getAttribute('aria-live')).toBe('polite');
      expect(list.textContent).toBeTruthy();
    });
  });

  it('IME composition — compositionstart/end listener 등록 (단위 검증)', async () => {
    await setupArchive();
    const input = document.getElementById('archiveSearch') as HTMLInputElement;

    // composition 중 input은 search 트리거 X
    vi.useFakeTimers();
    const searchSpy = vi.fn();
    document.addEventListener('dg:archive:search', searchSpy);

    input.dispatchEvent(new Event('compositionstart', { bubbles: true }));
    input.value = '한';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    await vi.advanceTimersByTimeAsync(300);
    expect(searchSpy).not.toHaveBeenCalled();

    // compositionend → debounce 후 search 트리거
    input.value = '한글';
    input.dispatchEvent(new Event('compositionend', { bubbles: true }));
    await vi.advanceTimersByTimeAsync(210);
    expect(searchSpy).toHaveBeenCalledTimes(1);
  });

});

describe('v3.32 T3: archive 검색 다중 토큰 + 초성', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    // eslint-disable-next-line no-restricted-syntax -- jsdom fixture cleanup
    document.body.innerHTML = '';
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    resetCoreHandlerListenersForTest();
  });

  it('다중 토큰 AND — 두 단어 모두 포함 항목만 표시', async () => {
    const answers = [
      { id: 'a1', text: '리액트 훅 사용법', type: '분석', createdAt: '2026-05-10T10:00:00.000Z', date: '2026-05-10' },
      { id: 'a2', text: '리액트 컴포넌트', type: '분석', createdAt: '2026-05-10T11:00:00.000Z', date: '2026-05-10' },
      { id: 'a3', text: '훅 정리', type: '분석', createdAt: '2026-05-10T12:00:00.000Z', date: '2026-05-10' },
    ];
    localStorage.setItem('dg.answers', JSON.stringify(answers));
    await setupArchive();

    document.querySelector<HTMLButtonElement>('.archive-entity-chip[data-entity="answer"]')!.click();
    const input = document.getElementById('archiveSearch') as HTMLInputElement;
    input.value = '리액트 훅';
    document.dispatchEvent(new CustomEvent('dg:archive:search'));

    const list = document.getElementById('archiveList')!;
    await vi.waitFor(() => {
      expect(list.querySelectorAll('.archive-card').length).toBe(1);
      expect(list.textContent).toContain('리액트 훅 사용법');
      expect(list.textContent).not.toContain('리액트 컴포넌트');
      expect(list.textContent).not.toContain('훅 정리');
    });
  });

  it('초성 only — 한글 텍스트 매칭 (mark 없음)', async () => {
    const answers = [
      { id: 'a1', text: '프로젝트 정리', type: '분석', createdAt: '2026-05-10T10:00:00.000Z', date: '2026-05-10' },
      { id: 'a2', text: '회고 문서', type: '분석', createdAt: '2026-05-10T11:00:00.000Z', date: '2026-05-10' },
    ];
    localStorage.setItem('dg.answers', JSON.stringify(answers));
    await setupArchive();

    document.querySelector<HTMLButtonElement>('.archive-entity-chip[data-entity="answer"]')!.click();
    const input = document.getElementById('archiveSearch') as HTMLInputElement;
    input.value = 'ㅍㄹ';
    document.dispatchEvent(new CustomEvent('dg:archive:search'));

    const list = document.getElementById('archiveList')!;
    await vi.waitFor(() => {
      expect(list.querySelectorAll('.archive-card').length).toBe(1);
      expect(list.textContent).toContain('프로젝트 정리');
      // 초성-only 토큰은 <mark> 없음 (filter pass-only)
      expect(list.querySelector('mark')).toBeNull();
    });
  });

  it('초성 + substring 혼합 — substring 토큰만 mark', async () => {
    const answers = [
      { id: 'a1', text: 'react 프로젝트', type: '분석', createdAt: '2026-05-10T10:00:00.000Z', date: '2026-05-10' },
      { id: 'a2', text: 'react 회고', type: '분석', createdAt: '2026-05-10T11:00:00.000Z', date: '2026-05-10' },
    ];
    localStorage.setItem('dg.answers', JSON.stringify(answers));
    await setupArchive();

    document.querySelector<HTMLButtonElement>('.archive-entity-chip[data-entity="answer"]')!.click();
    const input = document.getElementById('archiveSearch') as HTMLInputElement;
    input.value = 'ㅍㄹ react';
    document.dispatchEvent(new CustomEvent('dg:archive:search'));

    const list = document.getElementById('archiveList')!;
    await vi.waitFor(() => {
      expect(list.querySelectorAll('.archive-card').length).toBe(1);
      expect(list.textContent).toContain('react 프로젝트');
      // react만 mark, 초성은 mark X
      const marks = Array.from(list.querySelectorAll('mark')).map((m) => m.textContent);
      expect(marks).toEqual(['react']);
    });
  });

  it('빈 토큰만 (공백 다수) — 전체 표시 (UX 회귀 차단)', async () => {
    const answers = [
      { id: 'a1', text: 'A', type: '분석', createdAt: '2026-05-10T10:00:00.000Z', date: '2026-05-10' },
      { id: 'a2', text: 'B', type: '분석', createdAt: '2026-05-10T11:00:00.000Z', date: '2026-05-10' },
    ];
    localStorage.setItem('dg.answers', JSON.stringify(answers));
    await setupArchive();

    document.querySelector<HTMLButtonElement>('.archive-entity-chip[data-entity="answer"]')!.click();
    const input = document.getElementById('archiveSearch') as HTMLInputElement;
    input.value = '   ';
    document.dispatchEvent(new CustomEvent('dg:archive:search'));

    const list = document.getElementById('archiveList')!;
    await vi.waitFor(() => {
      // tokenizeQuery('   ') → [] → vacuous true → 전체 표시
      expect(list.querySelectorAll('.archive-card').length).toBe(2);
    });
  });

  it('영문 substring — 기존 회귀 없음 + case-insensitive mark', async () => {
    const answers = [
      { id: 'a1', text: 'React 훅 사용법', type: '분석', createdAt: '2026-05-10T10:00:00.000Z', date: '2026-05-10' },
      { id: 'a2', text: 'Vue 컴포넌트', type: '분석', createdAt: '2026-05-10T11:00:00.000Z', date: '2026-05-10' },
    ];
    localStorage.setItem('dg.answers', JSON.stringify(answers));
    await setupArchive();

    document.querySelector<HTMLButtonElement>('.archive-entity-chip[data-entity="answer"]')!.click();
    const input = document.getElementById('archiveSearch') as HTMLInputElement;
    input.value = 'react';
    document.dispatchEvent(new CustomEvent('dg:archive:search'));

    const list = document.getElementById('archiveList')!;
    await vi.waitFor(() => {
      expect(list.querySelectorAll('.archive-card').length).toBe(1);
      expect(list.textContent).toContain('React 훅 사용법');
      expect(list.querySelector('mark')?.textContent).toBe('React');
    });
  });

  // v3.32 T7 fix-B (Codex 최종 P2-2): scrap/briefing title+summary 결합 검색 회귀 spec.
  // Codex 사전 P1-3 흡수 효과 직접 검증 — 토큰이 title/summary에 나뉘면 결합 검색으로 hit.
  it('scrap entity — 토큰이 title/summary 분리된 항목도 결합 검색으로 hit (P1-3)', async () => {
    const briefings = [
      { id: 'b1', date: '2026-05-10', url: 'https://x/1', title: '리액트 가이드', summary: '훅 사용법 정리', scrapped: true, read: false, memo: '', pinned: false },
      { id: 'b2', date: '2026-05-10', url: 'https://x/2', title: '리액트 컴포넌트', summary: '구조화', scrapped: true, read: false, memo: '', pinned: false },
    ];
    localStorage.setItem('briefings', JSON.stringify(briefings));
    await setupArchive();

    document.querySelector<HTMLButtonElement>('.archive-entity-chip[data-entity="scrap"]')!.click();
    const input = document.getElementById('archiveSearch') as HTMLInputElement;
    // "리액트"는 b1/b2 title 둘 다, "훅"은 b1 summary만 → 결합 검색 시 b1만 hit
    input.value = '리액트 훅';
    document.dispatchEvent(new CustomEvent('dg:archive:search'));

    const list = document.getElementById('archiveList')!;
    await vi.waitFor(() => {
      expect(list.querySelectorAll('.archive-card').length).toBe(1);
      expect(list.textContent).toContain('리액트 가이드');
      expect(list.textContent).not.toContain('리액트 컴포넌트');
    });
  });

  it('all merge — briefing title/summary 분리 토큰도 결합 검색 hit (P1-3)', async () => {
    // answers 없고 briefings만 — 'all' merge에서 briefing 분기 검증
    const briefings = [
      { id: 'b1', date: '2026-05-10', url: 'https://x/1', title: '리액트 정리', summary: '훅 활용', scrapped: true, read: false, memo: '', pinned: false },
      { id: 'b2', date: '2026-05-10', url: 'https://x/2', title: 'Vue 가이드', summary: '컴포지션 API', scrapped: true, read: false, memo: '', pinned: false },
    ];
    localStorage.setItem('briefings', JSON.stringify(briefings));
    await setupArchive();

    // entity='all' (기본) + question chip='all' → 'all' merge 분기 진입
    const input = document.getElementById('archiveSearch') as HTMLInputElement;
    input.value = '리액트 훅';
    document.dispatchEvent(new CustomEvent('dg:archive:search'));

    const list = document.getElementById('archiveList')!;
    await vi.waitFor(() => {
      expect(list.querySelectorAll('.archive-card').length).toBe(1);
      expect(list.textContent).toContain('리액트 정리');
      expect(list.textContent).not.toContain('Vue 가이드');
    });
  });
});
