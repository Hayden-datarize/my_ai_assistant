import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { closeModal } from '../../../../src/ui/modals/shared';
import { resetForTest } from '../../../../src/state/geminiUsage';

// KST 2026-05-08 기준 (T09:00:00Z → KST 18:00)
const FIXED_TIME = new Date('2026-05-08T09:00:00Z');

beforeEach(() => {
  // eslint-disable-next-line no-restricted-syntax -- jsdom DOM reset fixture
  document.body.innerHTML = '<div id="modalRoot"></div>';
  localStorage.clear();
  vi.useFakeTimers();
  vi.setSystemTime(FIXED_TIME);
  resetForTest();
});

afterEach(() => {
  closeModal();
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe('openStatsRangeModal', () => {
  it('range=7: 헤더 "지난 7일" 포함 + .stats-sparkline 미렌더', async () => {
    const { openStatsRangeModal } = await import('../../../../src/ui/modals/stats-range-modal');
    await openStatsRangeModal({ range: 7 });
    const modal = document.querySelector('.dg-modal');
    expect(modal?.textContent).toContain('지난 7일');
    expect(modal?.querySelector('.stats-sparkline')).toBeNull();
  });

  it('range=30: .stats-sparkline 렌더됨 + bar 30개', async () => {
    const { openStatsRangeModal } = await import('../../../../src/ui/modals/stats-range-modal');
    await openStatsRangeModal({ range: 30 });
    const bars = document.querySelectorAll('.stats-sparkline-bar');
    expect(bars.length).toBe(30);
  });

  it('stat 카드 4개 렌더 (답변 / streak / 분야 / 평균)', async () => {
    const { openStatsRangeModal } = await import('../../../../src/ui/modals/stats-range-modal');
    await openStatsRangeModal({ range: 7 });
    expect(document.querySelectorAll('.stats-stat-card').length).toBe(4);
  });

  it('Gemini quota 초과 시 deterministic 1줄 fallback 표시', async () => {
    // cap을 0으로 강제 — checkAndIncrementGemini() → false
    const { setGeminiCap } = await import('../../../../src/state/geminiUsage');
    setGeminiCap(0);

    const { openStatsRangeModal } = await import('../../../../src/ui/modals/stats-range-modal');
    await openStatsRangeModal({ range: 7 });

    const highlight = document.querySelector('.stats-highlight');
    // 답변이 없는 상태라도 deterministic 패턴
    expect(highlight?.textContent).toMatch(/이번 주.*개 답변/);
  });

  it('escapeHtml 강제: Gemini 출력 <script> 태그가 DOM에 삽입되지 않음', async () => {
    // apiKey 시드
    localStorage.setItem('dg_gemini_key', 'TEST_KEY');

    // fetch mock: XSS 시도 응답
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        candidates: [
          {
            content: {
              parts: [{ text: '<script>alert(1)</script>오늘 성장했어요' }],
            },
          },
        ],
      }),
    });

    const { openStatsRangeModal } = await import('../../../../src/ui/modals/stats-range-modal');
    await openStatsRangeModal({ range: 7 });

    const modal = document.querySelector('.dg-modal');
    // <script> 태그 DOM 삽입 없음
    expect(modal?.querySelector('script')).toBeNull();
    // escape된 형태의 텍스트가 존재
    const highlight = document.querySelector('.stats-highlight');
    expect(highlight?.textContent).toContain('<script>');
  });

  it('캐시 hit 시 Gemini fetch 미호출', async () => {
    localStorage.setItem('dg_gemini_key', 'TEST_KEY');

    const fetchSpy = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        candidates: [{ content: { parts: [{ text: '캐시 이전 Gemini 결과' }] } }],
      }),
    });
    global.fetch = fetchSpy;

    const { openStatsRangeModal } = await import('../../../../src/ui/modals/stats-range-modal');

    // 첫 호출 — Gemini 호출 후 cache set
    await openStatsRangeModal({ range: 7 });
    expect(fetchSpy).toHaveBeenCalledTimes(1);

    // 두 번째 호출 — 동일 fingerprint(같은 localStorage 상태), cache hit
    await openStatsRangeModal({ range: 7 });
    expect(fetchSpy).toHaveBeenCalledTimes(1); // 추가 호출 없음
  });

  it('range=30: 헤더 "지난 30일" 포함 + .stats-highlight 렌더됨', async () => {
    const { openStatsRangeModal } = await import('../../../../src/ui/modals/stats-range-modal');
    await openStatsRangeModal({ range: 30 });
    const modal = document.querySelector('.dg-modal');
    expect(modal?.textContent).toContain('지난 30일');
    expect(document.querySelector('.stats-highlight')).not.toBeNull();
  });
});
