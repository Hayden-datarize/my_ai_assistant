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
        { id: 'i1', text: '첫 번째 인사이트', interestId: 'unknown', createdAt: '2026-05-09T10:00:00Z' },
        { id: 'i2', text: '두 번째 인사이트', interestId: 'unknown', createdAt: '2026-05-08T10:00:00Z' },
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
        { id: 'old', text: '오래된', interestId: 'unknown', createdAt: '2026-05-01T10:00:00Z' },
        { id: 'new', text: '신규', interestId: 'unknown', createdAt: '2026-05-09T10:00:00Z' },
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
      insights: [{ id: 'i1', text: '통찰', interestId: 'unknown', createdAt: '2026-05-09T10:00:00Z' }],
    });
    mockGetCachedUser.mockReturnValue(user);
    renderInsights(container);
    const card = container.querySelector<HTMLButtonElement>('.insight-card')!;
    card.click();
    expect(mockOpenInsightDetailModal).toHaveBeenCalledWith('i1');
  });

  it('escapeHtml: insight.text 안 <script> escape', () => {
    const user = mkUser({
      insights: [{ id: 'xss', text: '<script>alert(1)</script>', interestId: 'unknown', createdAt: '2026-05-09T10:00:00Z' }],
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

// ---------------------------------------------------------------------------
// v3.25 T5 — insights tab chip filter + 카드 chip
// ---------------------------------------------------------------------------
describe('insights chip filter (v3.25 T5)', () => {
  let container: HTMLElement;

  beforeEach(() => {
    document.body.replaceChildren();
    container = makeContainer();
    vi.clearAllMocks();
  });

  it('insights.length < 6 — filter row 미노출, 카드 chip 노출', () => {
    const user = mkUser({
      insights: [
        { id: 'i1', text: 'a', interestId: 'recruiting', createdAt: '2026-05-09T10:00:00Z' },
        { id: 'i2', text: 'b', interestId: 'ai_ml',      createdAt: '2026-05-08T10:00:00Z' },
        { id: 'i3', text: 'c', interestId: 'culture',    createdAt: '2026-05-07T10:00:00Z' },
        { id: 'i4', text: 'd', interestId: 'data',       createdAt: '2026-05-06T10:00:00Z' },
        { id: 'i5', text: 'e', interestId: 'recruiting', createdAt: '2026-05-05T10:00:00Z' },
      ],
    });
    mockGetCachedUser.mockReturnValue(user);
    renderInsights(container);

    expect(container.querySelector('.insight-filter-row')).toBeNull();
    const cards = container.querySelectorAll('.insight-card');
    expect(cards).toHaveLength(5);
    // 첫 카드 (newest = recruiting): chip text = '🎯 채용'
    const firstChip = cards[0]?.querySelector('.insight-chip');
    expect(firstChip).not.toBeNull();
    expect(firstChip?.textContent).toBe('🎯 채용');
  });

  it('insights.length >= 6 — filter row 노출 + chip 정렬 (전체 → INTERESTS 순서 → 미분류)', () => {
    const user = mkUser({
      insights: [
        { id: 'i1', text: 'a', interestId: 'ai_ml',      createdAt: '2026-05-09T10:00:00Z' },
        { id: 'i2', text: 'b', interestId: 'recruiting', createdAt: '2026-05-08T10:00:00Z' },
        { id: 'i3', text: 'c', interestId: 'unknown',    createdAt: '2026-05-07T10:00:00Z' },
        { id: 'i4', text: 'd', interestId: 'recruiting', createdAt: '2026-05-06T10:00:00Z' },
        { id: 'i5', text: 'e', interestId: 'ai_ml',      createdAt: '2026-05-05T10:00:00Z' },
        { id: 'i6', text: 'f', interestId: 'recruiting', createdAt: '2026-05-04T10:00:00Z' },
      ],
    });
    mockGetCachedUser.mockReturnValue(user);
    renderInsights(container);

    const row = container.querySelector('.insight-filter-row');
    expect(row).not.toBeNull();
    const chips = Array.from(row!.querySelectorAll<HTMLButtonElement>('.filter-chip'));
    // INTERESTS 순서: recruiting (HR 첫번째) → ai_ml (Tech 두번째) → unknown 마지막
    expect(chips.map(c => c.dataset.interestId ?? '')).toEqual(['', 'recruiting', 'ai_ml', 'unknown']);
    expect(chips.map(c => c.textContent)).toEqual(['전체', '🎯 채용', '🤖 AI/ML', '📰 미분류']);
    // 기본 active = '전체'
    expect(chips[0]?.classList.contains('active')).toBe(true);
  });

  it('chip 클릭 → 해당 분야 카드만 grid 표시 + active class 이동', () => {
    const user = mkUser({
      insights: [
        { id: 'r1', text: 'r1', interestId: 'recruiting', createdAt: '2026-05-09T10:00:00Z' },
        { id: 'r2', text: 'r2', interestId: 'recruiting', createdAt: '2026-05-08T10:00:00Z' },
        { id: 'r3', text: 'r3', interestId: 'recruiting', createdAt: '2026-05-07T10:00:00Z' },
        { id: 'a1', text: 'a1', interestId: 'ai_ml',      createdAt: '2026-05-06T10:00:00Z' },
        { id: 'a2', text: 'a2', interestId: 'ai_ml',      createdAt: '2026-05-05T10:00:00Z' },
        { id: 'u1', text: 'u1', interestId: 'unknown',    createdAt: '2026-05-04T10:00:00Z' },
      ],
    });
    mockGetCachedUser.mockReturnValue(user);
    renderInsights(container);

    // initial: 6 cards
    expect(container.querySelectorAll('.insight-card')).toHaveLength(6);

    // recruiting chip 클릭
    const recChip = container.querySelector<HTMLButtonElement>(
      '.filter-chip[data-interest-id="recruiting"]',
    );
    expect(recChip).not.toBeNull();
    recChip!.click();

    // 3 cards (recruiting only)
    const cards = container.querySelectorAll('.insight-card');
    expect(cards).toHaveLength(3);
    // active class 이동
    const activeChip = container.querySelector('.filter-chip.active');
    expect(activeChip?.getAttribute('data-interest-id')).toBe('recruiting');
    // 전체 chip은 inactive
    const allChip = container.querySelector<HTMLButtonElement>(
      '.filter-chip[data-interest-id=""]',
    );
    expect(allChip?.classList.contains('active')).toBe(false);
  });

  it("'미분류' chip은 unknown 인사이트가 1개 이상일 때만 노출", () => {
    // unknown 0건 — 6개 모두 recruiting
    const user = mkUser({
      insights: Array.from({ length: 6 }, (_, k) => ({
        id: `r${k}`,
        text: `r${k}`,
        interestId: 'recruiting',
        createdAt: `2026-05-0${k + 1}T10:00:00Z`,
      })),
    });
    mockGetCachedUser.mockReturnValue(user);
    renderInsights(container);

    const chips = Array.from(container.querySelectorAll<HTMLButtonElement>('.filter-chip'));
    expect(chips.map(c => c.dataset.interestId ?? '')).toEqual(['', 'recruiting']);
    // 미분류 chip 없음
    expect(container.querySelector('.filter-chip[data-interest-id="unknown"]')).toBeNull();
  });

  it("insight-card 안 chip — interestId='unknown' 시 muted variant + '📰 미분류' 텍스트", () => {
    const user = mkUser({
      insights: [
        { id: 'u1', text: 'unk', interestId: 'unknown', createdAt: '2026-05-09T10:00:00Z' },
      ],
    });
    mockGetCachedUser.mockReturnValue(user);
    renderInsights(container);

    const card = container.querySelector('.insight-card');
    const chip = card?.querySelector('.insight-chip');
    expect(chip).not.toBeNull();
    expect(chip?.classList.contains('insight-chip--muted')).toBe(true);
    expect(chip?.textContent).toBe('📰 미분류');
  });

  it("insight-card 안 chip — interestId 카탈로그 매칭 시 라벨 그대로", () => {
    const user = mkUser({
      insights: [
        { id: 'i1', text: 't', interestId: 'leadership', createdAt: '2026-05-09T10:00:00Z' },
      ],
    });
    mockGetCachedUser.mockReturnValue(user);
    renderInsights(container);

    const chip = container.querySelector('.insight-card .insight-chip');
    expect(chip).not.toBeNull();
    expect(chip?.classList.contains('insight-chip--muted')).toBe(false);
    expect(chip?.textContent).toBe('👑 리더십');
  });
});
