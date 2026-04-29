import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { handleLangToggle } from '../../src/ui/handlers/home';
import { createLangToggle } from '../../src/ui/components/cardLangToggle';
import type { Briefing } from '../../src/state/briefings';

/**
 * v3.11.1 hotfix — pending UX 검증.
 * 사용자 다중 클릭 race 방지: async 번역 동안 button disabled + summary "번역 중…".
 */

function buildEnv() {
  const summaryEl = document.createElement('p');
  summaryEl.className = 'card-summary';
  summaryEl.textContent = 'Original English body';

  const toggle = createLangToggle({ initialState: 'en', onToggle: () => {} });

  const briefing: Briefing = {
    id: 'b-test',
    date: '2026-04-28',
    url: 'https://example.com/x',
    title: 'sample',
    summary: 'Original English body',
    scrapped: false,
    read: false,
    memo: '',
    sourceTitle: 'src',
    detectedLang: 'en',
  };

  return { summaryEl, toggle, briefing };
}

describe('handleLangToggle pending state (v3.11.1 hotfix)', () => {
  beforeEach(() => {
    localStorage.clear();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('async ko 경로: button disabled + summary "번역 중…" 표시 후 결과로 교체', async () => {
    let resolveFetch: ((value: unknown) => void) | null = null;
    global.fetch = vi.fn().mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveFetch = resolve;
        }),
    ) as unknown as typeof fetch;

    const { summaryEl, toggle, briefing } = buildEnv();
    const promise = handleLangToggle(
      'ko',
      summaryEl,
      briefing,
      'Original English body',
      toggle,
      'KEY',
    );

    // pending 즉시 검증 (fetch 미해결 상태)
    expect(toggle.disabled).toBe(true);
    expect(toggle.getAttribute('aria-disabled')).toBe('true');
    expect(summaryEl.textContent).toBe('번역 중…');

    // fetch 해결 → ko 텍스트 도착
    resolveFetch!({
      ok: true,
      status: 200,
      json: async () => ({
        candidates: [{ content: { parts: [{ text: '{"text":"한국어 본문"}' }] } }],
      }),
    });
    await promise;

    expect(summaryEl.textContent).toBe('한국어 본문');
    expect(toggle.disabled).toBe(false);
    expect(toggle.hasAttribute('aria-disabled')).toBe(false);
  });

  it('async 실패: summary 원본 복원 + button 재활성화 + state en 복귀', async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error('network down')) as unknown as typeof fetch;

    const { summaryEl, toggle, briefing } = buildEnv();
    await handleLangToggle('ko', summaryEl, briefing, 'Original English body', toggle, 'KEY');

    expect(summaryEl.textContent).toBe('Original English body');
    expect(toggle.disabled).toBe(false);
    expect(toggle.textContent).toContain('한글로 보기'); // en state label
  });

  it('cache hit (briefing.summaryKo): API 호출 없이 즉시 반영, pending 미표시', async () => {
    const fetchSpy = vi.fn();
    global.fetch = fetchSpy as unknown as typeof fetch;

    const { summaryEl, toggle, briefing } = buildEnv();
    briefing.summaryKo = '캐시된 한국어 본문';

    await handleLangToggle('ko', summaryEl, briefing, 'Original English body', toggle, 'KEY');

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(summaryEl.textContent).toBe('캐시된 한국어 본문');
    expect(toggle.disabled).toBe(false);
  });
});
