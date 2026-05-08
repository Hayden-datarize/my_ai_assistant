import { openModal } from './shared';
import { getStatsRange, type StatsRange } from '../../utils/statsAggregate';
import { getStatsCache, setStatsCache, type StatsFingerprint } from '../../utils/statsCache';
import { generateText } from '../../services/gemini';
import { PROMPTS } from '../../services/prompts';
import { checkAndIncrementGemini } from '../../state/geminiUsage';
import { getApiKey } from '../../utils/apiKey';
import { escapeHtml } from '../../utils/escapeHtml';
import { showToast } from '../../utils/toast';

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
  const topPart = top ? `, ${escapeHtml(top.id)} 강세` : '';
  const prefix = days === 7 ? '이번 주' : '지난 30일';
  return `${prefix} ${r.totalAnswers}개 답변, 최장 ${r.longestStreak}일${topPart}`;
}

function renderStatCards(r: StatsRange): string {
  return (
    `<div class="stats-stat-card"><span class="stat-label">답변</span><span class="stat-value">${r.totalAnswers}</span></div>` +
    `<div class="stats-stat-card"><span class="stat-label">최장 streak</span><span class="stat-value">${r.longestStreak}일</span></div>` +
    `<div class="stats-stat-card"><span class="stat-label">활성 분야</span><span class="stat-value">${r.activeInterests}</span></div>` +
    `<div class="stats-stat-card"><span class="stat-label">일 평균</span><span class="stat-value">${r.avgPerDay}</span></div>`
  );
}

function renderSparkline(daily: number[]): string {
  const max = Math.max(...daily, 1);
  const bars = daily
    .map(v => `<div class="stats-sparkline-bar" style="height:${Math.round((v / max) * 100)}%"></div>`)
    .join('');
  return `<div class="stats-sparkline" aria-hidden="true">${bars}</div>`;
}

function renderInterestBars(byInterest: StatsRange['byInterest']): string {
  const first = byInterest[0];
  if (!first) return '';
  const max = first.count;
  const items = byInterest
    .map(
      i =>
        `<li><span class="bar-label">${escapeHtml(i.id)}</span>` +
        `<span class="bar-track"><span class="bar-fill" style="width:${Math.round((i.count / max) * 100)}%"></span></span>` +
        `<span class="bar-count">${i.count}</span></li>`,
    )
    .join('');
  return `<ul class="stats-interest-bars">${items}</ul>`;
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
      highlightText = escapeHtml(out.trim());
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

  const title = opts.range === 7 ? '지난 7일' : '지난 30일';
  const sparklineHtml = opts.range === 30 && r.daily ? renderSparkline(r.daily) : '';

  // innerHTML 주의: 모든 동적 문자열은 escapeHtml 처리됨
  // eslint-disable-next-line no-restricted-syntax
  const bodyHtml = [
    `<div class="stats-stat-grid">${renderStatCards(r)}</div>`,
    sparklineHtml,
    renderInterestBars(r.byInterest),
    `<p class="stats-highlight">${highlightText}</p>`,
  ].join('');

  openModal({ title, bodyHtml });
}
