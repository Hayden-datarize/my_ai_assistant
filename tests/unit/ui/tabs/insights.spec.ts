/**
 * @vitest-environment jsdom
 *
 * v3.23 T9: insights 탭 grid render + detail 모달 (dg:insights:removed wiring).
 *
 * 전략: vi.mock factory + vi.mocked 패턴 사용 (vi.resetModules 미사용으로 mock 안정성 확보).
 * getCachedUser는 localStorage 대신 mock 반환값으로 테스트 격리.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

// ---------------------------------------------------------------------------
// 모듈 mock 선언 — hoisted, factory 방식
// ---------------------------------------------------------------------------
const mockGetCachedUser = vi.fn();
const mockSaveUser = vi.fn();
const mockGetSaveErrorMessage = vi.fn().mockReturnValue('저장 실패');
const mockOpenModal = vi.fn();
const mockCloseModal = vi.fn();
const mockShowToast = vi.fn();
const mockDispatch = vi.fn();
const mockOpenInsightDetailModal = vi.fn();

vi.mock('../../../../src/state/user', () => ({
  getCachedUser: (...a: unknown[]) => mockGetCachedUser(...a),
  saveUser: (...a: unknown[]) => mockSaveUser(...a),
  getSaveErrorMessage: (...a: unknown[]) => mockGetSaveErrorMessage(...a),
}));
vi.mock('../../../../src/ui/modals/shared', () => ({
  openModal: (...a: unknown[]) => mockOpenModal(...a),
  closeModal: (...a: unknown[]) => mockCloseModal(...a),
}));
vi.mock('../../../../src/utils/toast', () => ({
  showToast: (...a: unknown[]) => mockShowToast(...a),
}));
vi.mock('../../../../src/ui/events', () => ({
  dispatch: (...a: unknown[]) => mockDispatch(...a),
  on: vi.fn(),
}));
vi.mock('../../../../src/ui/modals/insight-detail', () => ({
  openInsightDetailModal: (...a: unknown[]) => mockOpenInsightDetailModal(...a),
}));

// ---------------------------------------------------------------------------
// import (mock 선언 후)
// ---------------------------------------------------------------------------
import { renderInsights } from '../../../../src/ui/tabs/insights';
import { openInsightDetailModal } from '../../../../src/ui/modals/insight-detail';

// mkUser fixture
import { mkUser } from '../../state/userFixture';

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------
function makeContainer(): HTMLElement {
  const div = document.createElement('div');
  document.body.appendChild(div);
  return div;
}

// ---------------------------------------------------------------------------
// tests
// ---------------------------------------------------------------------------
describe('insights tab — renderInsights (v3.23 T9)', () => {
  let container: HTMLElement;

  beforeEach(() => {
    document.body.replaceChildren();
    container = makeContainer();
    vi.clearAllMocks();
  });

  it('빈 상태: placeholder 텍스트 렌더', () => {
    mockGetCachedUser.mockReturnValue(mkUser({ insights: [] }));
    renderInsights(container);
    expect(container.textContent).toMatch(/인사이트가 없어요/);
    expect(container.querySelector('.insights-grid')).toBeNull();
  });

  it('insights 있을 때 grid 렌더 (카드 수 일치)', () => {
    const user = mkUser({
      insights: [
        { id: 'i1', text: '첫 번째 인사이트', createdAt: '2026-05-09T10:00:00Z' },
        { id: 'i2', text: '두 번째 인사이트', createdAt: '2026-05-08T10:00:00Z' },
      ],
    });
    mockGetCachedUser.mockReturnValue(user);
    renderInsights(container);
    const cards = container.querySelectorAll('.insight-card');
    expect(cards).toHaveLength(2);
  });

  it('작성일 desc 정렬 — 신규(최근) 카드가 먼저', () => {
    const user = mkUser({
      insights: [
        { id: 'old', text: '오래된', createdAt: '2026-05-01T10:00:00Z' },
        { id: 'new', text: '신규', createdAt: '2026-05-09T10:00:00Z' },
      ],
    });
    mockGetCachedUser.mockReturnValue(user);
    renderInsights(container);
    const cards = Array.from(container.querySelectorAll<HTMLButtonElement>('.insight-card'));
    expect(cards[0]?.dataset.insightId).toBe('new');
    expect(cards[1]?.dataset.insightId).toBe('old');
  });

  it('카드 클릭 → openInsightDetailModal 호출', () => {
    const user = mkUser({
      insights: [{ id: 'i1', text: '통찰', createdAt: '2026-05-09T10:00:00Z' }],
    });
    mockGetCachedUser.mockReturnValue(user);
    renderInsights(container);
    const card = container.querySelector<HTMLButtonElement>('.insight-card')!;
    card.click();
    expect(mockOpenInsightDetailModal).toHaveBeenCalledWith('i1');
  });

  it('escapeHtml: insight.text 안 <script> escape', () => {
    const user = mkUser({
      insights: [{ id: 'xss', text: '<script>alert(1)</script>', createdAt: '2026-05-09T10:00:00Z' }],
    });
    mockGetCachedUser.mockReturnValue(user);
    renderInsights(container);
    // eslint-disable-next-line no-restricted-syntax -- reading innerHTML to verify escapeHtml encoding, not interpolating
    const text = container.querySelector('.insight-text')?.innerHTML ?? '';
    expect(text).not.toContain('<script>');
    expect(text).toContain('&lt;script&gt;');
  });

  it('getCachedUser null → 빈 상태 렌더 (crash 없음)', () => {
    mockGetCachedUser.mockReturnValue(null);
    expect(() => renderInsights(container)).not.toThrow();
    expect(container.textContent).toMatch(/인사이트가 없어요/);
  });
});

// openInsightDetailModal mock 호출 검증 (카드 클릭 wiring 테스트에서 이미 포함 — 별도 describe 불필요)
// delete flow 상세 테스트는 tests/unit/ui/modals/insight-detail.spec.ts 참조.
