import { describe, it, expect, beforeEach, vi } from 'vitest';
import { openStatsRangeModal } from '../../src/ui/modals/stats-range-modal';

// v3.26 T5 (v3.24 T2 P2): daily 미지정으로 mock 단순화 (range=7 path는 daily 사용 안 함)
vi.mock('../../src/utils/statsAggregate', () => ({
  getStatsRange: () => ({
    totalAnswers: 5,
    longestStreak: 3,
    activeInterests: 2,
    avgPerDay: 0.7,
    byInterest: [
      { id: '<img src=x onerror=alert(1)>', count: 3 },
      { id: 'AI', count: 2 },
    ],
  }),
}));
vi.mock('../../src/utils/statsCache', () => ({
  getStatsCache: () => ({ highlight: 'cached' }),
  setStatsCache: () => {},
}));
vi.mock('../../src/services/gemini', () => ({ generateText: vi.fn() }));
vi.mock('../../src/state/geminiUsage', () => ({ checkAndIncrementGemini: () => true }));
vi.mock('../../src/utils/apiKey', () => ({ getApiKey: () => 'k' }));

describe('stats-range-modal DOM 안전성 (v3.24 T2)', () => {
  beforeEach(() => {
    // eslint-disable-next-line no-restricted-syntax -- jsdom DOM reset fixture
    document.body.innerHTML = '<div id="modalRoot"></div>';
  });

  it('byInterest id에 HTML injection 시도해도 escape 처리된다 (v3.39 T6: getCategoryLabel fallback)', async () => {
    await openStatsRangeModal({ range: 7 });
    const labels = document.querySelectorAll('.bar-label');
    // v3.39 T6 (Codex P1-4): label은 catalog whitelist getCategoryLabel(id) → 'unknown' id는 '📰 일반' fallback.
    // 이는 raw id 노출(textContent도 자체 XSS-safe)보다 보안적으로 더 강화 — catalog 미일치 id는 표시 자체 차단.
    expect(labels[0]?.textContent).toBe('📰 일반');
    expect(document.querySelectorAll('.dg-modal img').length).toBe(0);
  });

  it('stats-stat-card는 4개 (답변/streak/활성분야/일평균)', async () => {
    await openStatsRangeModal({ range: 7 });
    expect(document.querySelectorAll('.stats-stat-card').length).toBe(4);
  });

  it('range=7에서는 sparkline 미표시', async () => {
    await openStatsRangeModal({ range: 7 });
    expect(document.querySelectorAll('.stats-sparkline').length).toBe(0);
  });
});

// v3.26 T5 (v3.24 T2 P2): byInterest null explicit spec — buildInterestBars 정책 명문화.
import { buildInterestBars } from '../../src/ui/modals/stats-range-modal';

describe('buildInterestBars empty/non-empty (v3.26 T5)', () => {
  it('byInterest 빈 배열 → null 반환 (caller가 append 안 함)', () => {
    expect(buildInterestBars([])).toBeNull();
  });

  it('byInterest 1개 이상 → ul.stats-interest-bars 반환', () => {
    const ul = buildInterestBars([{ id: 'recruiting', count: 5 }]);
    expect(ul).not.toBeNull();
    expect(ul?.classList.contains('stats-interest-bars')).toBe(true);
    expect(ul?.querySelectorAll('li').length).toBe(1);
  });
});
