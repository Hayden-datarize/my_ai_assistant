/**
 * v3.27 T6: XP 추이 30d SVG line chart.
 *
 * - input shape: 외부 helper(getXpHistory in T7)가 변환한 `{ date, cumulativeXp }` entry.
 * - SVG viewBox 300×80 + path (M..L..) + LEVEL_THRESHOLDS marker.
 * - empty guard: length<2면 line 못 그림 → empty-state text.
 * - aria-label 텍스트 대체 (스크린리더용).
 * - XSS 방어: createElementNS + textContent만 사용 (innerHTML 금지).
 *
 * Codex 사전 P1-1 흡수: `LEVEL_THRESHOLDS` export 없음 → `TIERS.map(t => t.thresh)`.
 */

import { TIERS } from '../../state/leveling';

export interface XpChartEntry {
  date: string;        // 'YYYY-MM-DD'
  cumulativeXp: number;
}

const SVG_NS = 'http://www.w3.org/2000/svg';
const VIEW_W = 300;
const VIEW_H = 80;
const PAD_X = 4;
const PAD_Y = 6;

// LEVEL_THRESHOLDS = TIERS cumulative XP unlock thresh (Codex P1-1).
const LEVEL_THRESHOLDS = TIERS.map((t) => t.thresh);

function svgEl<K extends keyof SVGElementTagNameMap>(tag: K): SVGElementTagNameMap[K] {
  return document.createElementNS(SVG_NS, tag);
}

function buildPath(history: XpChartEntry[]): string {
  const max = Math.max(1, ...history.map((h) => h.cumulativeXp));
  const stepX = (VIEW_W - 2 * PAD_X) / Math.max(1, history.length - 1);
  const usableH = VIEW_H - 2 * PAD_Y;
  const parts: string[] = [];
  history.forEach((h, i) => {
    const x = (PAD_X + i * stepX).toFixed(2);
    const y = (PAD_Y + usableH * (1 - h.cumulativeXp / max)).toFixed(2);
    parts.push(`${i === 0 ? 'M' : 'L'} ${x} ${y}`);
  });
  return parts.join(' ');
}

function pointAt(history: XpChartEntry[], idx: number): { x: number; y: number } {
  const max = Math.max(1, ...history.map((h) => h.cumulativeXp));
  const stepX = (VIEW_W - 2 * PAD_X) / Math.max(1, history.length - 1);
  const usableH = VIEW_H - 2 * PAD_Y;
  return {
    x: PAD_X + idx * stepX,
    y: PAD_Y + usableH * (1 - history[idx]!.cumulativeXp / max),
  };
}

function crossedThreshold(prev: number, curr: number): boolean {
  return LEVEL_THRESHOLDS.some((t) => t > 0 && prev < t && curr >= t);
}

function countLevelups(history: XpChartEntry[]): number {
  let count = 0;
  for (let i = 1; i < history.length; i++) {
    if (crossedThreshold(history[i - 1]!.cumulativeXp, history[i]!.cumulativeXp)) count++;
  }
  return count;
}

function buildAriaLabel(history: XpChartEntry[]): string {
  if (history.length === 0) return '최근 30일 XP 추이: 데이터 없음';
  const start = history[0]!.cumulativeXp;
  const end = history[history.length - 1]!.cumulativeXp;
  const max = Math.max(...history.map((h) => h.cumulativeXp));
  const ups = countLevelups(history);
  return `최근 30일 XP 추이: 시작 ${start}, 끝 ${end}, 최대 ${max}, 레벨업 ${ups}회`;
}

function emptyStateText(svg: SVGSVGElement): void {
  const text = svgEl('text');
  text.setAttribute('class', 'empty-state-text');
  text.setAttribute('x', String(VIEW_W / 2));
  text.setAttribute('y', String(VIEW_H / 2));
  text.setAttribute('text-anchor', 'middle');
  text.setAttribute('dominant-baseline', 'middle');
  text.textContent = '아직 데이터가 없어요';
  svg.appendChild(text);
}

export function renderXpChart(history: XpChartEntry[]): SVGSVGElement {
  const svg = svgEl('svg');
  svg.setAttribute('viewBox', `0 0 ${VIEW_W} ${VIEW_H}`);
  svg.setAttribute('class', 'xp-chart');
  svg.setAttribute('role', 'img');
  svg.setAttribute('aria-label', buildAriaLabel(history));

  if (history.length < 2) {
    emptyStateText(svg);
    return svg;
  }

  const path = svgEl('path');
  path.setAttribute('class', 'xp-chart-line');
  path.setAttribute('d', buildPath(history));
  path.setAttribute('fill', 'none');
  svg.appendChild(path);

  // LEVEL_THRESHOLDS cross 시점 marker.
  for (let i = 1; i < history.length; i++) {
    if (!crossedThreshold(history[i - 1]!.cumulativeXp, history[i]!.cumulativeXp)) continue;
    const { x, y } = pointAt(history, i);
    const c = svgEl('circle');
    c.setAttribute('class', 'levelup-marker');
    c.setAttribute('cx', x.toFixed(2));
    c.setAttribute('cy', y.toFixed(2));
    c.setAttribute('r', '3');
    svg.appendChild(c);
  }

  return svg;
}
