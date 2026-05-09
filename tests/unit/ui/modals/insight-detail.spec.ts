/**
 * @vitest-environment jsdom
 *
 * v3.23 T9: openInsightDetailModal delete flow 단위 테스트.
 * - confirm OK → saveUser + dg:insights:removed dispatch + closeModal + showToast
 * - confirm cancel → 변경 없음
 * - saveUser throw → rollback + getSaveErrorMessage 토스트, dispatch 미발생
 * - getCachedUser null → 조기 return
 *
 * 전략: vi.mock factory (openModal 반환값 제어) + mockGetCachedUser 직접 제어.
 * insight-detail은 mock 하지 않고 실제 구현 사용.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// ---------------------------------------------------------------------------
// mock 변수 선언 — vi.mock hoisting 전에 초기화
// ---------------------------------------------------------------------------
const mockGetCachedUser = vi.fn();
const mockSaveUser = vi.fn();
const mockGetSaveErrorMessage = vi.fn().mockReturnValue('저장 실패');
const mockOpenModal = vi.fn();
const mockCloseModal = vi.fn();
const mockShowToast = vi.fn();
const mockDispatch = vi.fn();

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

// ---------------------------------------------------------------------------
// import (mock 선언 후)
// ---------------------------------------------------------------------------
import { openInsightDetailModal } from '../../../../src/ui/modals/insight-detail';
import { mkUser } from '../../state/userFixture';

// ---------------------------------------------------------------------------
// tests
// ---------------------------------------------------------------------------
describe('openInsightDetailModal — delete flow (v3.23 T9)', () => {
  beforeEach(() => {
    document.body.replaceChildren();
    vi.clearAllMocks();
    // getSaveErrorMessage는 clearAllMocks 후 재등록
    mockGetSaveErrorMessage.mockReturnValue('저장 실패');
  });

  afterEach(() => {
    document.body.replaceChildren();
  });

  /** openModal mock이 wrap DOM을 반환하고 wrap에 delete 버튼이 있도록 세팅 */
  function setupWrap(): HTMLDivElement {
    const wrap = document.createElement('div');
    // eslint-disable-next-line no-restricted-syntax -- jsdom static fixture, no interpolation
    wrap.innerHTML = '<button class="insight-delete-btn" type="button">삭제</button>';
    document.body.appendChild(wrap);
    mockOpenModal.mockReturnValue(wrap);
    return wrap;
  }

  it('confirm OK → saveUser + dg:insights:removed dispatch + closeModal + showToast', () => {
    const wrap = setupWrap();
    window.confirm = vi.fn().mockReturnValue(true);

    const user = mkUser({
      insights: [{ id: 'i1', text: '통찰', interestId: 'unknown', createdAt: '2026-05-09T10:00:00Z' }],
    });
    mockGetCachedUser.mockReturnValue(user);
    mockSaveUser.mockImplementation(() => undefined);

    openInsightDetailModal('i1');
    wrap.querySelector<HTMLButtonElement>('.insight-delete-btn')!.click();

    expect(mockSaveUser).toHaveBeenCalledTimes(1);
    expect(user.insights).toHaveLength(0);
    expect(mockDispatch).toHaveBeenCalledWith('dg:insights:removed', { id: 'i1' });
    expect(mockCloseModal).toHaveBeenCalledTimes(1);
    expect(mockShowToast).toHaveBeenCalledWith('인사이트를 삭제했어요');
  });

  it('confirm cancel → 변경 없음 (saveUser/dispatch 미호출)', () => {
    const wrap = setupWrap();
    window.confirm = vi.fn().mockReturnValue(false);

    const user = mkUser({
      insights: [{ id: 'i1', text: '통찰', interestId: 'unknown', createdAt: '2026-05-09T10:00:00Z' }],
    });
    mockGetCachedUser.mockReturnValue(user);

    openInsightDetailModal('i1');
    wrap.querySelector<HTMLButtonElement>('.insight-delete-btn')!.click();

    expect(mockSaveUser).not.toHaveBeenCalled();
    expect(mockDispatch).not.toHaveBeenCalled();
    expect(user.insights).toHaveLength(1);
  });

  it('saveUser throw → rollback + getSaveErrorMessage 토스트, dispatch 미발생', () => {
    const wrap = setupWrap();
    window.confirm = vi.fn().mockReturnValue(true);

    const user = mkUser({
      insights: [{ id: 'i1', text: '통찰', interestId: 'unknown', createdAt: '2026-05-09T10:00:00Z' }],
    });
    mockGetCachedUser.mockReturnValue(user);
    mockSaveUser.mockImplementation(() => { throw new Error('quota'); });

    openInsightDetailModal('i1');
    wrap.querySelector<HTMLButtonElement>('.insight-delete-btn')!.click();

    expect(user.insights).toHaveLength(1); // rollback
    expect(mockDispatch).not.toHaveBeenCalled();
    expect(mockCloseModal).not.toHaveBeenCalled();
    expect(mockShowToast).toHaveBeenCalledWith('저장 실패');
  });

  it('getCachedUser null → 조기 return (openModal 미호출, crash 없음)', () => {
    mockGetCachedUser.mockReturnValue(null);
    expect(() => openInsightDetailModal('nonexistent')).not.toThrow();
    expect(mockOpenModal).not.toHaveBeenCalled();
  });

  it('insight 미존재 (user 있지만 id 불일치) → 조기 return', () => {
    const user = mkUser({ insights: [] });
    mockGetCachedUser.mockReturnValue(user);
    expect(() => openInsightDetailModal('ghost')).not.toThrow();
    expect(mockOpenModal).not.toHaveBeenCalled();
  });
});
