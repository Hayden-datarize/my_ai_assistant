import { describe, it, expect, beforeEach } from 'vitest';
import type { MissionInstance } from '../../src/state/missionTypes';
import { renderMissionsSection } from '../../src/ui/missions-section';
import {
  mountMissionsSparkleListener,
  __resetSparkleState,
} from '../../src/ui/missions-sparkle';
import { dispatch } from '../../src/ui/events';
import { DAILY_POOL, MISSION_CATALOG } from '../../src/state/missionCatalog';

const mkRoot = (): HTMLElement => {
  const root = document.createElement('div');
  document.body.appendChild(root);
  return root;
};

const mk = (
  defId: string,
  completed: boolean,
  progress = 0,
  period: 'daily' | 'weekly' | 'monthly' = 'daily',
): MissionInstance => ({ defId, period, windowStart: 0, progress, completed });

// Codex P2-4: hardcoded id 후보 대신 DAILY_POOL[0].id (catalog 변경 강건성)
// readonly tuple narrow: catalog invariant test가 def 존재를 보장 (DAILY_POOL.length ≥ 2)
const DAILY_ID = DAILY_POOL[0]!.id;

describe('renderMissionsSection (v3.49 grid)', () => {
  beforeEach(() => {
    // eslint-disable-next-line no-restricted-syntax -- jsdom test seed clear; static literal, no interpolation
    document.body.innerHTML = '';
    __resetSparkleState();
    window.matchMedia = ((q: string) => ({
      matches: false, media: q,
      addListener: () => {}, removeListener: () => {},
      addEventListener: () => {}, removeEventListener: () => {},
      dispatchEvent: () => true, onchange: null,
    })) as typeof window.matchMedia;
  });

  it('grid 컨테이너(.mission-group__grid)를 생성한다', () => {
    const root = mkRoot();
    renderMissionsSection(root, [mk(DAILY_ID, false, 0)]);
    expect(root.querySelectorAll('.mission-group__grid').length).toBeGreaterThanOrEqual(1);
  });

  it('각 카드에 data-mission-id 부착', () => {
    const root = mkRoot();
    renderMissionsSection(root, [mk(DAILY_ID, false, 0)]);
    expect(root.querySelector(`.mission-card[data-mission-id="${DAILY_ID}"]`)).toBeTruthy();
  });

  it('progress ring SVG 노출 (circle.mission-card__ring-progress + stroke-dashoffset)', () => {
    const root = mkRoot();
    renderMissionsSection(root, [mk(DAILY_ID, false, 0)]);
    const ring = root.querySelector('circle.mission-card__ring-progress');
    expect(ring).toBeTruthy();
    expect(ring?.getAttribute('stroke-dashoffset')).toMatch(/^[\d.]+$/);
  });

  it('ring NaN/Infinity 가드: target=0 → dashoffset finite', () => {
    const root = mkRoot();
    // target=0 시뮬레이션 — catalog defId지만 progress/target NaN 노출 가드 검증을 위한 inline override
    // (실 catalog는 target>=1이지만 입력 손상 시 방어)
    const bad: MissionInstance = { ...mk(DAILY_ID, false, 0), progress: Number.NaN } as MissionInstance;
    renderMissionsSection(root, [bad]);
    const ring = root.querySelector('circle.mission-card__ring-progress');
    const off = ring?.getAttribute('stroke-dashoffset') ?? '';
    expect(off).toMatch(/^[\d.]+$/);
    expect(Number(off)).toBeGreaterThanOrEqual(0);
    expect(Number.isFinite(Number(off))).toBe(true);
  });

  it('def 부재 미션은 group count/render에 포함 X (Codex P1-2)', () => {
    const root = mkRoot();
    // 'unknown-def-xyz'는 catalog에 없음 — group count·grid 모두에서 제외
    renderMissionsSection(root, [
      mk(DAILY_ID, false, 0),
      mk('unknown-def-xyz', true, 1),
    ]);
    const cards = root.querySelectorAll('.mission-card');
    expect(cards.length).toBe(1); // 1개만 (unknown 제외)
    const progress = root.querySelector('.mission-group__progress');
    expect(progress?.textContent).toBe('0/1'); // count = known만 (1개 활성)
  });

  it('완수 미션은 grid 끝으로 정렬', () => {
    const root = mkRoot();
    renderMissionsSection(root, [
      mk(DAILY_ID, true, 1),
      mk(DAILY_ID, false, 0),
    ]);
    const cards = root.querySelectorAll<HTMLElement>('.mission-card');
    expect(cards.length).toBe(2);
    expect(cards[0]!.classList.contains('mission-card--completed')).toBe(false);
    expect(cards[1]!.classList.contains('mission-card--completed')).toBe(true);
  });

  it('same-status 상대 순서 유지 (Codex P2-5)', () => {
    const root = mkRoot();
    const A = DAILY_POOL[0]!.id;
    const B = DAILY_POOL[1]!.id;
    // 둘 다 활성: 원래 순서(A, B) 유지
    renderMissionsSection(root, [mk(A, false, 0), mk(B, false, 0)]);
    const cards = root.querySelectorAll<HTMLElement>('.mission-card');
    expect(cards[0]!.dataset.missionId).toBe(A);
    expect(cards[1]!.dataset.missionId).toBe(B);
  });

  it('sparkle queue에 defId 주입 + 완수 mount → class 부착 (reduced motion false)', () => {
    mountMissionsSparkleListener();
    dispatch('dg:reward:mission-complete', { defId: DAILY_ID, period: 'daily', rewardXp: 10, at: 0 });
    const root = mkRoot();
    renderMissionsSection(root, [mk(DAILY_ID, true, 1)]);
    const card = root.querySelector<HTMLElement>(`.mission-card[data-mission-id="${DAILY_ID}"]`);
    expect(card?.classList.contains('mission-card--sparkle')).toBe(true);
  });

  it('reduced motion=true 시 sparkle class 부착 X', () => {
    window.matchMedia = ((q: string) => ({
      matches: q.includes('reduce'),
      media: q, addListener: () => {}, removeListener: () => {},
      addEventListener: () => {}, removeEventListener: () => {},
      dispatchEvent: () => true, onchange: null,
    })) as typeof window.matchMedia;
    mountMissionsSparkleListener();
    dispatch('dg:reward:mission-complete', { defId: DAILY_ID, period: 'daily', rewardXp: 10, at: 0 });
    const root = mkRoot();
    renderMissionsSection(root, [mk(DAILY_ID, true, 1)]);
    const card = root.querySelector<HTMLElement>(`.mission-card[data-mission-id="${DAILY_ID}"]`);
    expect(card?.classList.contains('mission-card--sparkle')).toBe(false);
  });

  it('reload 안전: queue 비어있는 상태에서 completed mount → sparkle X', () => {
    mountMissionsSparkleListener();
    // dispatch 없음 — reload 직후 시뮬
    const root = mkRoot();
    renderMissionsSection(root, [mk(DAILY_ID, true, 1)]);
    const card = root.querySelector<HTMLElement>(`.mission-card[data-mission-id="${DAILY_ID}"]`);
    expect(card?.classList.contains('mission-card--sparkle')).toBe(false);
  });

  it('escapeHtml: title sink 일관', () => {
    const root = mkRoot();
    renderMissionsSection(root, [mk(DAILY_ID, false, 0)]);
    const title = root.querySelector('.mission-card__title');
    // eslint-disable-next-line no-restricted-syntax -- assertion read of innerHTML (escapeHtml sink 검증)
    expect(title?.innerHTML).not.toContain('<script');
  });

  it('빈 active 배열 시 카드 0', () => {
    const root = mkRoot();
    renderMissionsSection(root, []);
    expect(root.querySelectorAll('.mission-card').length).toBe(0);
  });

  it('chevron toggle: aria-expanded false 시 list hidden', () => {
    const root = mkRoot();
    renderMissionsSection(root, [mk(DAILY_ID, false, 0)]);
    const header = root.querySelector<HTMLButtonElement>('.mission-group__header')!;
    expect(header.getAttribute('aria-expanded')).toBe('true');
    header.click();
    expect(header.getAttribute('aria-expanded')).toBe('false');
    const listId = header.getAttribute('aria-controls')!;
    const list = root.querySelector<HTMLElement>(`#${listId}`)!;
    expect(list.hidden).toBe(true);
  });

  it('catalog defId ASCII invariant (Codex P2-2 / 최종 N2 — MISSION_CATALOG 전체 확장)', () => {
    // v3.49 T5 Codex 최종 N2: DAILY_POOL만 검사하면 weekly/monthly invariant 누락.
    // data-mission-id sink 안전성을 주장하려면 MISSION_CATALOG 전체.
    for (const def of MISSION_CATALOG) {
      expect(def.id).toMatch(/^[a-z0-9-]+$/);
    }
  });
});
