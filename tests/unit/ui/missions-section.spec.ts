import { describe, it, expect, beforeEach } from 'vitest';
import { renderMissionsSection } from '../../../src/ui/missions-section';
import type { MissionInstance } from '../../../src/state/missionTypes';

// eslint-disable-next-line no-restricted-syntax -- jsdom DOM seed; static template, no user interpolation
beforeEach(() => { document.body.innerHTML = '<div id="root"></div>'; });

function mount(active: MissionInstance[]): HTMLElement {
  const root = document.getElementById('root')!;
  renderMissionsSection(root, active);
  return root;
}

describe('renderMissionsSection', () => {
  it('빈 active → 카드 0개', () => {
    const root = mount([]);
    expect(root.querySelectorAll('.mission-card')).toHaveLength(0);
  });

  it('3 daily + 2 weekly + 1 monthly → 6 cards, 3 group sections', () => {
    const active: MissionInstance[] = [
      { defId: 'daily-answer-1', period: 'daily', windowStart: 0, progress: 0, completed: false },
      { defId: 'daily-scrap-1', period: 'daily', windowStart: 0, progress: 0, completed: false },
      { defId: 'daily-memo-1', period: 'daily', windowStart: 0, progress: 0, completed: false },
      { defId: 'weekly-answers-5', period: 'weekly', windowStart: 0, progress: 0, completed: false },
      { defId: 'weekly-active-5days', period: 'weekly', windowStart: 0, progress: 0, completed: false, progressDates: [] },
      { defId: 'monthly-answers-20', period: 'monthly', windowStart: 0, progress: 0, completed: false },
    ];
    const root = mount(active);
    expect(root.querySelectorAll('.mission-card')).toHaveLength(6);
    expect(root.querySelectorAll('.mission-group')).toHaveLength(3);
  });

  it('completed: true → .mission-card--completed 클래스 + ✓', () => {
    const active: MissionInstance[] = [
      { defId: 'daily-answer-1', period: 'daily', windowStart: 0, progress: 1, completed: true },
    ];
    const root = mount(active);
    const card = root.querySelector('.mission-card')!;
    expect(card.classList.contains('mission-card--completed')).toBe(true);
    expect(card.querySelector('.mission-card__check')?.textContent).toBe('✓');
  });

  // v3.49: progressbar role → SVG ring으로 대체 (renderRing, role="img" + aria-label, circle.mission-card__ring-progress)
  it('target ≥ 2 미션 → ring SVG aria-label에 진행 표시', () => {
    const active: MissionInstance[] = [
      { defId: 'monthly-answers-20', period: 'monthly', windowStart: 0, progress: 5, completed: false },
    ];
    const root = mount(active);
    const ringWrap = root.querySelector('.mission-card__ring')!;
    expect(ringWrap.getAttribute('role')).toBe('img');
    expect(ringWrap.getAttribute('aria-label')).toBe('진행 5/20');
    expect(root.querySelector('circle.mission-card__ring-progress')).not.toBeNull();
  });

  // v3.49: ring은 target=1에서도 노출 (게임화 정책 — 항상 progress 시각화), 단 ratio=0
  it('target = 1 미션 → ring 노출 (ratio=0, full dashoffset)', () => {
    const active: MissionInstance[] = [
      { defId: 'daily-answer-1', period: 'daily', windowStart: 0, progress: 0, completed: false },
    ];
    const root = mount(active);
    const ring = root.querySelector('circle.mission-card__ring-progress')!;
    expect(ring).not.toBeNull();
    // ratio=0 → dashoffset === circumference (2π·20 ≈ 125.66)
    const off = Number(ring.getAttribute('stroke-dashoffset'));
    expect(off).toBeGreaterThan(125);
    expect(off).toBeLessThan(126);
  });

  it('chevron toggle: aria-expanded=true → 클릭 → false + 그리드 hidden', () => {
    const active: MissionInstance[] = [
      { defId: 'daily-answer-1', period: 'daily', windowStart: 0, progress: 0, completed: false },
    ];
    const root = mount(active);
    const btn = root.querySelector('.mission-group__header') as HTMLButtonElement;
    expect(btn.getAttribute('aria-expanded')).toBe('true');
    btn.click();
    expect(btn.getAttribute('aria-expanded')).toBe('false');
    // v3.49: __list → __grid (CSS grid responsive)
    const list = root.querySelector('.mission-group__grid') as HTMLElement;
    expect(list.hidden).toBe(true);
  });

  it('group 헤더에 진행 카운트 "N/M" 표시', () => {
    const active: MissionInstance[] = [
      { defId: 'daily-answer-1', period: 'daily', windowStart: 0, progress: 1, completed: true },
      { defId: 'daily-scrap-1', period: 'daily', windowStart: 0, progress: 0, completed: false },
      { defId: 'daily-memo-1', period: 'daily', windowStart: 0, progress: 0, completed: false },
    ];
    const root = mount(active);
    const header = root.querySelector('[data-period="daily"] .mission-group__progress')!;
    expect(header.textContent).toBe('1/3');
  });

  it('a11y: completed 카드에 aria-label로 완수 안내', () => {
    const active: MissionInstance[] = [
      { defId: 'daily-answer-1', period: 'daily', windowStart: 0, progress: 1, completed: true },
    ];
    const root = mount(active);
    const card = root.querySelector('.mission-card--completed')!;
    expect(card.getAttribute('aria-label')).toMatch(/완수/);
  });

  it('a11y: incompleted 카드는 aria-label에 미션 텍스트만', () => {
    const active: MissionInstance[] = [
      { defId: 'daily-answer-1', period: 'daily', windowStart: 0, progress: 0, completed: false },
    ];
    const root = mount(active);
    const card = root.querySelector('.mission-card')!;
    expect(card.getAttribute('aria-label')).toBe('오늘 답변 1개 작성');
  });

  it('a11y: chevron group header button + aria-controls가 list id 가리킴', () => {
    const active: MissionInstance[] = [
      { defId: 'daily-answer-1', period: 'daily', windowStart: 0, progress: 0, completed: false },
    ];
    const root = mount(active);
    const btn = root.querySelector('.mission-group__header')!;
    const listId = btn.getAttribute('aria-controls')!;
    expect(document.getElementById(listId)).not.toBeNull();
  });
});
