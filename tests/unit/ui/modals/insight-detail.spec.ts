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

// v3.25 T6 (T1 graduate / v3.24 lesson #8): state/user vi.mock 시 validateInterestId
// passthrough 의무 — 본 spec에서는 INTERESTS whitelist 매칭만 시뮬레이트.
const VALID_IDS = new Set([
  'recruiting', 'onboarding', 'culture', 'hr_system', 'labor_law', 'leadership',
  'pm', 'ai_ml', 'data',
  'startup', 'marketing',
  'productivity', 'career', 'communication', 'self_dev',
]);

vi.mock('../../../../src/state/user', () => ({
  getCachedUser: (...a: unknown[]) => mockGetCachedUser(...a),
  saveUser: (...a: unknown[]) => mockSaveUser(...a),
  getSaveErrorMessage: (...a: unknown[]) => mockGetSaveErrorMessage(...a),
  validateInterestId: (id: string) => (VALID_IDS.has(id) ? id : 'unknown'),
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
      insights: [{ id: 'i1', text: '통찰', interestId: 'unknown', createdAt: '2026-05-09T10:00:00Z', pinned: false }],
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
      insights: [{ id: 'i1', text: '통찰', interestId: 'unknown', createdAt: '2026-05-09T10:00:00Z', pinned: false }],
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
      insights: [{ id: 'i1', text: '통찰', interestId: 'unknown', createdAt: '2026-05-09T10:00:00Z', pinned: false }],
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

// ---------------------------------------------------------------------------
// v3.25 T6: dropdown 분야 변경 wiring
// ---------------------------------------------------------------------------
describe('openInsightDetailModal — dropdown 분야 변경 (v3.25 T6)', () => {
  beforeEach(() => {
    document.body.replaceChildren();
    vi.clearAllMocks();
    mockSaveUser.mockReset();
    mockGetSaveErrorMessage.mockReturnValue('저장 실패');
  });

  afterEach(() => {
    document.body.replaceChildren();
  });

  /**
   * select + delete 버튼을 가진 wrap을 세팅한다.
   * select.value 초기값은 caller가 override 가능.
   */
  function setupWrapWithSelect(initial: string): {
    wrap: HTMLDivElement;
    select: HTMLSelectElement;
  } {
    const wrap = document.createElement('div');
    // eslint-disable-next-line no-restricted-syntax -- jsdom static fixture, no interpolation
    wrap.innerHTML =
      '<select class="insight-interest-select">' +
      '<option value="unknown">📰 미분류</option>' +
      '<option value="recruiting">🎯 채용</option>' +
      '<option value="onboarding">🚀 온보딩</option>' +
      '<option value="hallucinated">🤯 허상</option>' +
      '</select>' +
      '<button class="insight-delete-btn" type="button">삭제</button>';
    document.body.appendChild(wrap);
    const select = wrap.querySelector<HTMLSelectElement>('.insight-interest-select')!;
    select.value = initial;
    mockOpenModal.mockReturnValue(wrap);
    return { wrap, select };
  }

  it('dropdown 변경 시 saveUser 호출 + dg:insights:updated dispatch + toast (modal 닫지 않음)', () => {
    const { select } = setupWrapWithSelect('unknown');
    const user = mkUser({
      insights: [{ id: 'i1', text: '통찰', interestId: 'unknown', createdAt: '2026-05-09T10:00:00Z', pinned: false }],
    });
    mockGetCachedUser.mockReturnValue(user);
    mockSaveUser.mockImplementation(() => undefined);

    openInsightDetailModal('i1');
    select.value = 'recruiting';
    select.dispatchEvent(new Event('change'));

    expect(mockSaveUser).toHaveBeenCalledTimes(1);
    expect(user.insights[0]!.interestId).toBe('recruiting');
    expect(mockDispatch).toHaveBeenCalledWith('dg:insights:updated', { id: 'i1' });
    expect(mockShowToast).toHaveBeenCalledWith('분야를 변경했어요');
    expect(mockCloseModal).not.toHaveBeenCalled();
  });

  it('saveUser throw 시 in-memory + select.value 양방향 rollback', () => {
    const { select } = setupWrapWithSelect('unknown');
    const user = mkUser({
      insights: [{ id: 'i1', text: '통찰', interestId: 'unknown', createdAt: '2026-05-09T10:00:00Z', pinned: false }],
    });
    mockGetCachedUser.mockReturnValue(user);
    mockSaveUser.mockImplementationOnce(() => { throw new Error('Quota'); });

    openInsightDetailModal('i1');
    select.value = 'recruiting';
    select.dispatchEvent(new Event('change'));

    // in-memory rollback
    expect(user.insights[0]!.interestId).toBe('unknown');
    // UI rollback (양방향)
    expect(select.value).toBe('unknown');
    // dispatch 미발생
    expect(mockDispatch).not.toHaveBeenCalledWith('dg:insights:updated', expect.anything());
    // 에러 토스트 (getSaveErrorMessage 결과)
    expect(mockShowToast).toHaveBeenCalledWith('저장 실패');
  });

  it("invalid value (whitelist 외) — validateInterestId로 'unknown' 폴백", () => {
    const { select } = setupWrapWithSelect('unknown');
    const user = mkUser({
      insights: [{ id: 'i1', text: '통찰', interestId: 'unknown', createdAt: '2026-05-09T10:00:00Z', pinned: false }],
    });
    mockGetCachedUser.mockReturnValue(user);
    mockSaveUser.mockImplementation(() => undefined);

    openInsightDetailModal('i1');
    select.value = 'hallucinated';
    select.dispatchEvent(new Event('change'));

    expect(user.insights[0]!.interestId).toBe('unknown');
    expect(mockSaveUser).toHaveBeenCalledTimes(1);
  });
});
