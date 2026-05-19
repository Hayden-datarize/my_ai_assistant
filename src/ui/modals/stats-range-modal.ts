import { openModal } from './shared';
import { getStatsRange, type StatsRange } from '../../utils/statsAggregate';
import { getStatsCache, setStatsCache, type StatsFingerprint } from '../../utils/statsCache';
import { generateText } from '../../services/gemini';
import { PROMPTS } from '../../services/prompts';
import { checkAndIncrementGemini } from '../../state/geminiUsage';
import { getApiKey } from '../../utils/apiKey';
import { showToast } from '../../utils/toast';
import { getCategoryLabel } from '../../utils/categories';

export interface StatsRangeModalOpts {
  range: 7 | 30;
}

function buildFingerprint(r: StatsRange): StatsFingerprint {
  const top = r.byInterest[0];
  return {
    totalAnswers: r.totalAnswers,
    longestStreak: r.longestStreak,
    byInterestTopKey: top?.id ?? '',
    byInterestTopCount: top?.count ?? 0,
  };
}

function deterministicHighlight(r: StatsRange, days: 7 | 30): string {
  const top = r.byInterest[0];
  // v3.39 T6 (Codex P1-4): raw id 노출 → catalog label (emoji + 한글).
  const topPart = top ? `, ${getCategoryLabel(top.id)} 강세` : '';
  const prefix = days === 7 ? '이번 주' : '지난 30일';
  return `${prefix} ${r.totalAnswers}개 답변, 최장 ${r.longestStreak}일${topPart}`;
}

function buildStatCards(r: StatsRange): HTMLElement {
  const grid = document.createElement('div');
  grid.className = 'stats-stat-grid';
  const cards: Array<[string, string]> = [
    ['답변', String(r.totalAnswers)],
    ['최장 streak', `${r.longestStreak}일`],
    ['활성 분야', String(r.activeInterests)],
    ['일 평균', String(r.avgPerDay)],
  ];
  for (const [label, value] of cards) {
    const card = document.createElement('div');
    card.className = 'stats-stat-card';
    const labelSpan = document.createElement('span');
    labelSpan.className = 'stat-label';
    labelSpan.textContent = label;
    const valueSpan = document.createElement('span');
    valueSpan.className = 'stat-value';
    valueSpan.textContent = value;
    card.appendChild(labelSpan);
    card.appendChild(valueSpan);
    grid.appendChild(card);
  }
  return grid;
}

function buildSparkline(daily: number[]): HTMLElement {
  const max = Math.max(...daily, 1);
  const container = document.createElement('div');
  container.className = 'stats-sparkline';
  container.setAttribute('aria-hidden', 'true');
  for (const v of daily) {
    const bar = document.createElement('div');
    bar.className = 'stats-sparkline-bar';
    bar.style.height = `${Math.round((v / max) * 100)}%`;
    container.appendChild(bar);
  }
  return container;
}

/** v3.26 T5 (v3.24 T2 P2): byInterest 빈 배열 → null 반환 (caller가 append 분기 처리). export는 spec 단위 검증용. @internal */
export function buildInterestBars(byInterest: StatsRange['byInterest']): HTMLElement | null {
  const first = byInterest[0];
  if (!first) return null;
  const max = first.count;
  const ul = document.createElement('ul');
  ul.className = 'stats-interest-bars';
  for (const i of byInterest) {
    const li = document.createElement('li');
    const label = document.createElement('span');
    label.className = 'bar-label';
    // v3.39 T6 (Codex P1-4): raw id 노출 → catalog label (emoji + 한글).
    label.textContent = getCategoryLabel(i.id);
    const track = document.createElement('span');
    track.className = 'bar-track';
    const fill = document.createElement('span');
    fill.className = 'bar-fill';
    fill.style.width = `${Math.round((i.count / max) * 100)}%`;
    track.appendChild(fill);
    const count = document.createElement('span');
    count.className = 'bar-count';
    count.textContent = String(i.count);
    li.appendChild(label);
    li.appendChild(track);
    li.appendChild(count);
    ul.appendChild(li);
  }
  return ul;
}

/**
 * v3.39 T6 (Codex P1-4): legacy empty-state.
 *
 * byInterest가 비어 있으나 totalAnswers > 0인 케이스 — 답변은 있는데 분야 분류가
 * 모두 'unknown'이라는 의미 (v3.39 이전 legacy 데이터 + T2 이후 chat-summary 미경로 path 등).
 *
 * 안내 문구는 plain text — DOM API 조립(escapeHtml 불요, 외부 입력 0).
 *
 * @internal — spec 검증용 export.
 */
export function buildLegacyInterestEmpty(): HTMLElement {
  const root = document.createElement('div');
  root.className = 'stats-interest-empty';
  const p1 = document.createElement('p');
  p1.textContent = '분야별 통계는 v3.39부터 진짜 관심분야 기준으로 정확해졌어요.';
  const p2 = document.createElement('p');
  p2.textContent = '이전 답변은 분야 미지정으로 표시됩니다. 새 답변부터 자동 분류됩니다.';
  root.appendChild(p1);
  root.appendChild(p2);
  return root;
}

export async function openStatsRangeModal(opts: StatsRangeModalOpts): Promise<void> {
  const r = getStatsRange(opts.range);
  const fp = buildFingerprint(r);

  let highlightText: string;
  const cached = getStatsCache(opts.range, fp);

  if (cached) {
    // 캐시 hit — Gemini 호출 없이 반환
    const raw = opts.range === 7 ? (cached.highlight ?? '') : (cached.narrative ?? '');
    highlightText = raw || deterministicHighlight(r, opts.range);
  } else if (!getApiKey()) {
    // T6 mid-pass P1-1 fix: 빈 apiKey → Gemini call 차단 + cap 소비 차단
    highlightText = deterministicHighlight(r, opts.range);
    showToast('Gemini API 키가 필요해요. 설정에서 등록해 주세요');
  } else if (!checkAndIncrementGemini()) {
    // Quota 초과
    highlightText = deterministicHighlight(r, opts.range);
    showToast('오늘 AI 분석 quota 소진, 내일 다시');
  } else {
    try {
      const apiKey = getApiKey();
      const tmpl = opts.range === 7 ? PROMPTS.statsHighlight : PROMPTS.statsNarrative;
      const out = await generateText({
        apiKey,
        prompt: tmpl.build(r),
        maxOutputTokens: tmpl.maxOutputTokens, // codex P1-3 fix
      });
      highlightText = out.trim();
      // T5 review fix #2: cache write 실패는 silent — Gemini 결과는 이미 받았으니 사용자 표시 우선
      try {
        setStatsCache(
          opts.range,
          fp,
          opts.range === 7 ? { highlight: highlightText } : { narrative: highlightText },
        );
      } catch {
        /* cache 저장 실패 (Quota 등)는 derived data — silent OK */
      }
    } catch {
      highlightText = deterministicHighlight(r, opts.range);
      showToast('AI 분석에 실패했어요');
    }
  }

  // v3.24 T2: DOM API 마이그레이션 — textContent 기반 안전 조립.
  // v3.26 T3: bodyNode 채택 — innerHTML 직렬화 단계 제거 (XSS round-trip 안전성 + listener 보존).
  const bodyContainer = document.createElement('div');
  bodyContainer.appendChild(buildStatCards(r));
  if (opts.range === 30 && r.daily) {
    bodyContainer.appendChild(buildSparkline(r.daily));
  }
  const bars = buildInterestBars(r.byInterest);
  if (bars) {
    bodyContainer.appendChild(bars);
  } else if (r.totalAnswers > 0) {
    // v3.39 T6 (Codex P1-4): legacy empty-state — 답변은 있는데 모두 'unknown'인 경우 안내.
    bodyContainer.appendChild(buildLegacyInterestEmpty());
  }
  const highlight = document.createElement('p');
  highlight.className = 'stats-highlight';
  highlight.textContent = highlightText;
  bodyContainer.appendChild(highlight);

  const title = opts.range === 7 ? '지난 7일' : '지난 30일';
  openModal({ title, bodyNode: bodyContainer });
}
