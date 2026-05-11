import { describe, it, expect } from 'vitest';
import { renderXpChart, type XpChartEntry } from '../../src/ui/components/xp-chart';

/**
 * v3.27 T6: XP 추이 30d SVG component.
 * Codex 사전 P1-1: TIERS.map(t => t.thresh) (LEVEL_THRESHOLDS export 없음).
 */

function mkHistory(opts: { days?: number; xpPerDay?: number; levelUpAt?: number } = {}): XpChartEntry[] {
  const days = opts.days ?? 30;
  const xpPerDay = opts.xpPerDay ?? 10;
  const out: XpChartEntry[] = [];
  let cum = 0;
  for (let i = 0; i < days; i++) {
    // levelUpAt 지정 시 해당 day에 thresh 100 cross (1→2 tier).
    cum = opts.levelUpAt === i ? 105 : cum + xpPerDay;
    const d = new Date(Date.UTC(2026, 4, 1 + i));
    const dateStr = d.toISOString().slice(0, 10);
    out.push({ date: dateStr, cumulativeXp: cum });
  }
  return out;
}

describe('v3.27 T6: XP 추이 30d SVG', () => {
  it('30d data binding — <path d="..."/>가 M 명령으로 시작', () => {
    const svg = renderXpChart(mkHistory());
    const path = svg.querySelector('path');
    expect(path).not.toBeNull();
    const d = path!.getAttribute('d');
    expect(d).toBeTruthy();
    expect(d!).toMatch(/^M\s*[\d.]/);
  });

  it('LEVEL_THRESHOLDS 마커 — cumulative XP cross 시점 circle.levelup-marker 추가', () => {
    // levelUpAt=5 → day 5에서 thresh 100 cross.
    const svg = renderXpChart(mkHistory({ levelUpAt: 5, xpPerDay: 5 }));
    const markers = svg.querySelectorAll('circle.levelup-marker');
    expect(markers.length).toBe(1);
  });

  it('aria-label — "최근 30일 XP 추이" 시작 / 끝 / 최대 / 레벨업 횟수 포함', () => {
    const svg = renderXpChart(mkHistory({ xpPerDay: 10 }));
    const label = svg.getAttribute('aria-label') ?? '';
    expect(label).toMatch(/최근 30일 XP 추이/);
    expect(label).toMatch(/\d+/); // 숫자 포함 (시작/끝/최대)
  });

  it('SVG path 명령 수 = history.length (M 1회 + L N-1회) — DOM injection 방어 패턴', () => {
    const history = mkHistory({ days: 30 });
    const svg = renderXpChart(history);
    const d = svg.querySelector('path')!.getAttribute('d')!;
    // M + L 명령 count
    const mCount = (d.match(/M/g) ?? []).length;
    const lCount = (d.match(/L/g) ?? []).length;
    expect(mCount).toBe(1);
    expect(lCount).toBe(history.length - 1);
  });
});
