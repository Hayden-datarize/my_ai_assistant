import { describe, it, expect, beforeEach, vi } from 'vitest';
import { openStatsRangeModal } from '../../src/ui/modals/stats-range-modal';

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
    daily: undefined,
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

  it('byInterest id에 HTML injection 시도해도 escape 처리된다', async () => {
    await openStatsRangeModal({ range: 7 });
    const labels = document.querySelectorAll('.bar-label');
    expect(labels[0]?.textContent).toBe('<img src=x onerror=alert(1)>');
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
