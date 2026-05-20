/**
 * @vitest-environment jsdom
 *
 * v3.23 T9: openInsightDetailModal delete flow 단위 테스트.
 * - confirm OK → saveUser + dg:insights:removed dispatch + closeModal + showToast
 * - confirm cancel → 변경 없음
 * - saveUser throw → rollback + getSaveErrorMessage 토스트, dispatch 미발생
 * - getCachedUser null → 조기 return
 *
 * v3.38 T6: bodyHtml → bodyNode 마이그 후, listener는 production-rendered bodyNode에 attach.
 * openModal mock이 cfg.bodyNode를 document.body에 그대로 mount하여 click 시뮬레이션을 흘리도록 함.
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

// v3.38 T6: archive nav chip — navigateToInterestArchive spy.
// v3.40 T8 (C4): mock path archive-nav.ts로 이동.
const mockNavigateToInterestArchive = vi.fn();
vi.mock('../../../../src/ui/handlers/archive-nav', () => ({
  navigateToInterestArchive: (...a: unknown[]) => mockNavigateToInterestArchive(...a),
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

  /**
   * v3.38 T6: openModal mock이 cfg.bodyNode를 document.body에 mount하여
   * production-rendered bodyNode가 그대로 click 대상이 되도록 함.
   */
  function setupBodyNodeMount(): void {
    mockOpenModal.mockImplementation((cfg: { bodyNode?: Node; bodyHtml?: string }) => {
      const wrap = document.createElement('div');
      wrap.className = 'dg-modal';
      if (cfg.bodyNode) wrap.append(cfg.bodyNode);
      document.body.appendChild(wrap);
      return wrap;
    });
  }

  it('confirm OK → saveUser + dg:insights:removed dispatch + closeModal + showToast', () => {
    setupBodyNodeMount();
    window.confirm = vi.fn().mockReturnValue(true);

    const user = mkUser({
      insights: [{ id: 'i1', text: '통찰', interestId: 'unknown', createdAt: '2026-05-09T10:00:00Z', pinned: false }],
    });
    mockGetCachedUser.mockReturnValue(user);
    mockSaveUser.mockImplementation(() => undefined);

    openInsightDetailModal('i1');
    document.body.querySelector<HTMLButtonElement>('.insight-delete-btn')!.click();

    expect(mockSaveUser).toHaveBeenCalledTimes(1);
    expect(user.insights).toHaveLength(0);
    expect(mockDispatch).toHaveBeenCalledWith('dg:insights:removed', { id: 'i1' });
    expect(mockCloseModal).toHaveBeenCalledTimes(1);
    expect(mockShowToast).toHaveBeenCalledWith('인사이트를 삭제했어요');
  });

  it('confirm cancel → 변경 없음 (saveUser/dispatch 미호출)', () => {
    setupBodyNodeMount();
    window.confirm = vi.fn().mockReturnValue(false);

    const user = mkUser({
      insights: [{ id: 'i1', text: '통찰', interestId: 'unknown', createdAt: '2026-05-09T10:00:00Z', pinned: false }],
    });
    mockGetCachedUser.mockReturnValue(user);

    openInsightDetailModal('i1');
    document.body.querySelector<HTMLButtonElement>('.insight-delete-btn')!.click();

    expect(mockSaveUser).not.toHaveBeenCalled();
    expect(mockDispatch).not.toHaveBeenCalled();
    expect(user.insights).toHaveLength(1);
  });

  it('saveUser throw → rollback + getSaveErrorMessage 토스트, dispatch 미발생', () => {
    setupBodyNodeMount();
    window.confirm = vi.fn().mockReturnValue(true);

    const user = mkUser({
      insights: [{ id: 'i1', text: '통찰', interestId: 'unknown', createdAt: '2026-05-09T10:00:00Z', pinned: false }],
    });
    mockGetCachedUser.mockReturnValue(user);
    mockSaveUser.mockImplementation(() => { throw new Error('quota'); });

    openInsightDetailModal('i1');
    document.body.querySelector<HTMLButtonElement>('.insight-delete-btn')!.click();

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
   * v3.38 T6: openModal mock이 cfg.bodyNode를 mount하도록 세팅하고,
   * production-rendered select element를 반환한다.
   */
  function setupBodyNodeMount(): { getSelect: () => HTMLSelectElement } {
    mockOpenModal.mockImplementation((cfg: { bodyNode?: Node; bodyHtml?: string }) => {
      const wrap = document.createElement('div');
      wrap.className = 'dg-modal';
      if (cfg.bodyNode) wrap.append(cfg.bodyNode);
      document.body.appendChild(wrap);
      return wrap;
    });
    return {
      getSelect: () => document.body.querySelector<HTMLSelectElement>('.insight-interest-select')!,
    };
  }

  it('dropdown 변경 시 saveUser 호출 + dg:insights:updated dispatch + toast (modal 닫지 않음)', () => {
    const { getSelect } = setupBodyNodeMount();
    const user = mkUser({
      insights: [{ id: 'i1', text: '통찰', interestId: 'unknown', createdAt: '2026-05-09T10:00:00Z', pinned: false }],
    });
    mockGetCachedUser.mockReturnValue(user);
    mockSaveUser.mockImplementation(() => undefined);

    openInsightDetailModal('i1');
    const select = getSelect();
    select.value = 'recruiting';
    select.dispatchEvent(new Event('change'));

    expect(mockSaveUser).toHaveBeenCalledTimes(1);
    expect(user.insights[0]!.interestId).toBe('recruiting');
    expect(mockDispatch).toHaveBeenCalledWith('dg:insights:updated', { id: 'i1' });
    expect(mockShowToast).toHaveBeenCalledWith('분야를 변경했어요');
    expect(mockCloseModal).not.toHaveBeenCalled();
  });

  it('saveUser throw 시 in-memory + select.value 양방향 rollback', () => {
    const { getSelect } = setupBodyNodeMount();
    const user = mkUser({
      insights: [{ id: 'i1', text: '통찰', interestId: 'unknown', createdAt: '2026-05-09T10:00:00Z', pinned: false }],
    });
    mockGetCachedUser.mockReturnValue(user);
    mockSaveUser.mockImplementationOnce(() => { throw new Error('Quota'); });

    openInsightDetailModal('i1');
    const select = getSelect();
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
    const { getSelect } = setupBodyNodeMount();
    const user = mkUser({
      insights: [{ id: 'i1', text: '통찰', interestId: 'unknown', createdAt: '2026-05-09T10:00:00Z', pinned: false }],
    });
    mockGetCachedUser.mockReturnValue(user);
    mockSaveUser.mockImplementation(() => undefined);

    openInsightDetailModal('i1');
    const select = getSelect();
    // production-rendered select에는 'hallucinated' option이 없음 → JSDOM이 value 무시 가능.
    // validateInterestId가 whitelist를 enforce하므로, 직접 'hallucinated' 값을 강제 주입.
    const optHallu = document.createElement('option');
    optHallu.value = 'hallucinated';
    optHallu.textContent = '🤯 허상';
    select.append(optHallu);
    select.value = 'hallucinated';
    select.dispatchEvent(new Event('change'));

    expect(user.insights[0]!.interestId).toBe('unknown');
    expect(mockSaveUser).toHaveBeenCalledTimes(1);
  });
});

// ---------------------------------------------------------------------------
// v3.38 T6: archive nav chip + bodyNode 마이그
// ---------------------------------------------------------------------------
describe('openInsightDetailModal — archive nav chip (v3.38 T6)', () => {
  beforeEach(() => {
    document.body.replaceChildren();
    vi.clearAllMocks();
    mockGetSaveErrorMessage.mockReturnValue('저장 실패');
    mockNavigateToInterestArchive.mockReset();
  });

  afterEach(() => {
    document.body.replaceChildren();
  });

  /** openModal mock이 cfg.bodyNode를 mount하도록 세팅 */
  function setupBodyNodeMount(): void {
    mockOpenModal.mockImplementation((cfg: { bodyNode?: Node; bodyHtml?: string }) => {
      const wrap = document.createElement('div');
      wrap.className = 'dg-modal';
      if (cfg.bodyNode) wrap.append(cfg.bodyNode);
      document.body.appendChild(wrap);
      return wrap;
    });
  }

  it('interestId가 valid (unknown/empty 아님)이면 chip 표시', () => {
    setupBodyNodeMount();
    const user = mkUser({
      insights: [{ id: 'i1', text: '통찰', interestId: 'leadership', createdAt: '2026-05-09T10:00:00Z', pinned: false }],
    });
    mockGetCachedUser.mockReturnValue(user);

    openInsightDetailModal('i1');

    const chip = document.body.querySelector<HTMLButtonElement>('.insight-archive-nav-chip');
    expect(chip).not.toBeNull();
    expect(chip!.textContent).toBe('🔍 이 분야 다른 답변/스크랩 보기');
    expect(chip!.getAttribute('aria-label')).toContain('archive');
  });

  it('interestId === "unknown"이면 chip 미표시', () => {
    setupBodyNodeMount();
    const user = mkUser({
      insights: [{ id: 'i1', text: '통찰', interestId: 'unknown', createdAt: '2026-05-09T10:00:00Z', pinned: false }],
    });
    mockGetCachedUser.mockReturnValue(user);

    openInsightDetailModal('i1');

    expect(document.body.querySelector('.insight-archive-nav-chip')).toBeNull();
  });

  it('interestId === "" (empty)이면 chip 미표시', () => {
    setupBodyNodeMount();
    const user = mkUser({
      insights: [{ id: 'i1', text: '통찰', interestId: '', createdAt: '2026-05-09T10:00:00Z', pinned: false }],
    });
    mockGetCachedUser.mockReturnValue(user);

    openInsightDetailModal('i1');

    expect(document.body.querySelector('.insight-archive-nav-chip')).toBeNull();
  });

  it('chip 클릭 → navigateToInterestArchive(interestId) 1회 호출', () => {
    setupBodyNodeMount();
    mockNavigateToInterestArchive.mockResolvedValue(undefined);
    const user = mkUser({
      insights: [{ id: 'i1', text: '통찰', interestId: 'leadership', createdAt: '2026-05-09T10:00:00Z', pinned: false }],
    });
    mockGetCachedUser.mockReturnValue(user);

    openInsightDetailModal('i1');
    document.body.querySelector<HTMLButtonElement>('.insight-archive-nav-chip')!.click();

    expect(mockNavigateToInterestArchive).toHaveBeenCalledTimes(1);
    expect(mockNavigateToInterestArchive).toHaveBeenCalledWith('leadership');
  });

  it('navigateToInterestArchive reject 시 console.warn 호출하고 silent fail (throw 외부 누출 X)', async () => {
    setupBodyNodeMount();
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const rejection = Promise.reject(new Error('boom'));
    // 미처리 rejection 경고 회피
    rejection.catch(() => undefined);
    mockNavigateToInterestArchive.mockReturnValue(rejection);
    const user = mkUser({
      insights: [{ id: 'i1', text: '통찰', interestId: 'leadership', createdAt: '2026-05-09T10:00:00Z', pinned: false }],
    });
    mockGetCachedUser.mockReturnValue(user);

    openInsightDetailModal('i1');
    expect(() => {
      document.body.querySelector<HTMLButtonElement>('.insight-archive-nav-chip')!.click();
    }).not.toThrow();

    // microtask queue 충분히 flush (Promise.catch handler 발화 보장)
    await new Promise((r) => setTimeout(r, 0));
    await Promise.resolve();

    expect(warnSpy).toHaveBeenCalledWith('[insight-detail] navigate failed', expect.any(Error));
    warnSpy.mockRestore();
  });

  it('bodyNode 마이그 — XSS payload 인 text가 textContent로 안전 렌더 (innerHTML 직렬화 0)', () => {
    setupBodyNodeMount();
    const user = mkUser({
      insights: [{ id: 'i1', text: '<img src=x onerror=alert(1)>', interestId: 'unknown', createdAt: '2026-05-09T10:00:00Z', pinned: false }],
    });
    mockGetCachedUser.mockReturnValue(user);

    openInsightDetailModal('i1');

    const textP = document.body.querySelector('.insight-detail-text');
    expect(textP).not.toBeNull();
    // textContent는 안전 — 실제 <img> 노드는 생성되지 않음
    expect(textP!.textContent).toBe('<img src=x onerror=alert(1)>');
    expect(document.body.querySelector('img')).toBeNull();
  });
});
