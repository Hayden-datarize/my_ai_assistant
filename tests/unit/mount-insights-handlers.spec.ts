/**
 * @vitest-environment jsdom
 *
 * v3.24 T5 (B4): mountInsightsHandlers refresh path spec.
 *
 * 대상: `src/ui/tabs/insights.ts`의 `mountInsightsHandlers()`.
 * `dg:insights:added` / `dg:insights:removed` 이벤트 수신 시 grid 재렌더 동작과
 * insightsTab DOM 비활성 시 no-op 동작을 검증한다.
 *
 * 전략: vi.mock factory 패턴 (insights.spec.ts와 동일).
 *   - `getCachedUser`는 mock 반환값으로 격리.
 *   - `dispatch`/`on`은 실제 events 모듈 사용 (refresh 트리거 검증을 위해).
 *   - `openInsightDetailModal`은 click handler에서 호출되므로 mock 처리.
 *
 * production code 변경 0 — test coverage 보강만.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

// ---------------------------------------------------------------------------
// 모듈 mock 선언 — hoisted, factory 방식
// ---------------------------------------------------------------------------
const mockGetCachedUser = vi.fn();
const mockOpenInsightDetailModal = vi.fn();

vi.mock('../../src/state/user', () => ({
  getCachedUser: (...a: unknown[]) => mockGetCachedUser(...a),
}));
vi.mock('../../src/ui/modals/insight-detail', () => ({
  openInsightDetailModal: (...a: unknown[]) => mockOpenInsightDetailModal(...a),
}));

// ---------------------------------------------------------------------------
// import (mock 선언 후) — events는 실제 모듈 사용 (dispatch ⇒ on 콜백 트리거)
// ---------------------------------------------------------------------------
import { renderInsights, mountInsightsHandlers } from '../../src/ui/tabs/insights';
import { dispatch } from '../../src/ui/events';
import { mkUser } from './state/userFixture';

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------
/**
 * insights 탭 wrapper element 생성.
 * `mountInsightsHandlers`의 refresh 콜백은 `document.getElementById('insightsTab')?.parentElement`로
 * tab wrapper를 찾으므로, renderInsights 호출 후 wrapper 안에 `#insightsTab`이 들어가도록 구성한다.
 */
function makeTabWrapper(): HTMLElement {
  const wrapper = document.createElement('div');
  wrapper.id = 'tabContainer';
  document.body.appendChild(wrapper);
  return wrapper;
}

// ---------------------------------------------------------------------------
// tests
// ---------------------------------------------------------------------------
describe('mountInsightsHandlers refresh path (v3.24 T5 / B4)', () => {
  beforeEach(() => {
    document.body.replaceChildren();
    vi.clearAllMocks();
  });

  it('renderInsights 후 dg:insights:added dispatch 시 grid 재렌더 (카드 수 동일 mock 유지)', () => {
    const user = mkUser({
      insights: [
        { id: 'a', text: 'first', createdAt: '2026-05-01T00:00:00Z' },
        { id: 'b', text: 'second', createdAt: '2026-05-02T00:00:00Z' },
      ],
    });
    mockGetCachedUser.mockReturnValue(user);

    const wrapper = makeTabWrapper();
    renderInsights(wrapper);
    expect(wrapper.querySelectorAll('.insight-card').length).toBe(2);

    mountInsightsHandlers();
    dispatch('dg:insights:added', { id: 'c' });

    // mock 반환값 동일하므로 grid count 그대로 — re-render 동작 자체 검증.
    expect(wrapper.querySelectorAll('.insight-card').length).toBe(2);
    // getCachedUser는 처음 renderInsights + refresh 시 한 번 더 호출 (총 ≥2).
    expect(mockGetCachedUser.mock.calls.length).toBeGreaterThanOrEqual(2);
  });

  it('insightsTab DOM 없을 때 (탭 비활성) refresh no-op (throw 없음)', () => {
    mockGetCachedUser.mockReturnValue(mkUser({ insights: [] }));
    mountInsightsHandlers();
    expect(() => dispatch('dg:insights:removed', { id: 'a' })).not.toThrow();
  });

  it('dg:insights:removed dispatch도 동일한 refresh 트리거 (no error)', () => {
    const user = mkUser({
      insights: [{ id: 'a', text: 'first', createdAt: '2026-05-01T00:00:00Z' }],
    });
    mockGetCachedUser.mockReturnValue(user);

    const wrapper = makeTabWrapper();
    renderInsights(wrapper);
    mountInsightsHandlers();

    expect(() => dispatch('dg:insights:removed', { id: 'a' })).not.toThrow();
    // mock 동일 반환 — count 유지.
    expect(wrapper.querySelectorAll('.insight-card').length).toBe(1);
  });
});
