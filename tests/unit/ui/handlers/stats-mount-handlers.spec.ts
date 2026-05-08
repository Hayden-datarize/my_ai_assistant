/**
 * mountStatsHandlers wiring spec (v3.23 T6)
 *
 * dg:stats:weekly-report  → openStatsRangeModal({ range: 7 })  → .dg-modal '지난 7일'
 * dg:stats:growth-analysis → openStatsRangeModal({ range: 30 }) → .dg-modal '지난 30일'
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// ── openStatsRangeModal 을 mock (실제 Gemini/localStorage 의존성 제거)
vi.mock('../../../../src/ui/modals/stats-range-modal', () => ({
  openStatsRangeModal: vi.fn().mockResolvedValue(undefined),
}));

beforeEach(() => {
  // eslint-disable-next-line no-restricted-syntax -- jsdom DOM reset fixture
  document.body.innerHTML = '<div id="modalRoot"></div>';
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('mountStatsHandlers wiring (v3.23 T6)', () => {
  it('dg:stats:weekly-report → openStatsRangeModal({ range: 7 }) 호출', async () => {
    const { mountStatsHandlers } = await import('../../../../src/ui/handlers/stats');
    const { openStatsRangeModal } = await import('../../../../src/ui/modals/stats-range-modal');
    const spy = vi.mocked(openStatsRangeModal);

    mountStatsHandlers();
    document.dispatchEvent(new CustomEvent('dg:stats:weekly-report'));

    // void promise — flush microtask
    await Promise.resolve();
    expect(spy).toHaveBeenCalledWith({ range: 7 });
  });

  it('dg:stats:growth-analysis → openStatsRangeModal({ range: 30 }) 호출', async () => {
    const { mountStatsHandlers } = await import('../../../../src/ui/handlers/stats');
    const { openStatsRangeModal } = await import('../../../../src/ui/modals/stats-range-modal');
    const spy = vi.mocked(openStatsRangeModal);

    mountStatsHandlers();
    document.dispatchEvent(new CustomEvent('dg:stats:growth-analysis'));

    await Promise.resolve();
    expect(spy).toHaveBeenCalledWith({ range: 30 });
  });
});
