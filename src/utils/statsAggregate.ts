/**
 * statsAggregate.ts — v3.23 T4
 * getStatsRange(7|30): StatsRange
 *
 * codex P0-2 fix: KST anchor (T12:00:00+09:00) 기반 날짜 산술.
 * 기존 `new Date('${date}T00:00:00')` UTC 파싱은 Asia/Seoul에서 off-by-one.
 * KST 정오 anchor (T12:00:00+09:00) — DST 없는 KST에서 day 산술 안전.
 */

import { loadAnswers } from '../state/persistence';
import { getKstDateStr } from './dates';
import { KST_FMT_DATE as KST_FMT } from './intl';

export interface StatsRange {
  totalAnswers: number;
  longestStreak: number;
  activeInterests: number;
  avgPerDay: number;
  byInterest: Array<{ id: string; count: number }>;
  /** range=30만 반환, range=7은 undefined */
  daily?: number[];
}

// v3.26 T1a: KST_FMT singleton (src/utils/intl.ts) — KST_FMT_DATE alias 유지로 기존 caller 0 변경.

/**
 * UTC ISO 문자열 → KST 날짜 'YYYY-MM-DD'.
 * 머신 TZ에 무관하게 Asia/Seoul 기준 날짜 반환.
 */
function kstDateOf(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return KST_FMT.format(d);
}

/**
 * codex P0-2 fix: KST 정오 anchor 기반 n일 이전 날짜 반환.
 * today: 'YYYY-MM-DD' (KST 기준).
 * KST 정오 (T12:00:00+09:00)에서 n일 빼기 — UTC 변환 후 day 산술.
 */
function dateNDaysAgo(today: string, n: number): string {
  const anchor = new Date(`${today}T12:00:00+09:00`);
  anchor.setUTCDate(anchor.getUTCDate() - n);
  return KST_FMT.format(anchor);
}

/**
 * 최근 7일 또는 30일 통계를 KST 기준으로 집계.
 *
 * @param days 7 또는 30
 * @returns StatsRange — totalAnswers, longestStreak, activeInterests, avgPerDay, byInterest, daily(30만)
 */
export function getStatsRange(days: 7 | 30): StatsRange {
  const today = getKstDateStr();
  const fromDate = dateNDaysAgo(today, days - 1);
  const all = loadAnswers();

  // KST 날짜 기준으로 range 내 답변 필터
  const inRange = all.filter(a => {
    const d = kstDateOf(a.createdAt);
    return d >= fromDate && d <= today;
  });

  const totalAnswers = inRange.length;
  const avgPerDay = Math.round((totalAnswers / days) * 10) / 10;

  // v3.39 T6 (Codex P1-4): byInterest 의미 정정 — `a.type`(질문 유형, e.g. '분석'/'트렌드')이 아니라
  // `a.interestId`(관심분야, INTERESTS.id) 기준으로 분류. 이전 정책은 사용자에게 '분야 통계'로
  // 보여졌으나 실제로는 질문 유형 통계여서 의미 misleading.
  //
  // 정책:
  //   - a.interestId가 비문자열/빈값이어도 schema 강화 후엔 거의 없지만 'unknown' 안전 fallback.
  //   - 'unknown' bucket은 byInterest 결과 + activeInterests count에서 제외 (분야 통계 의미 보존).
  const byInterestMap = new Map<string, number>();
  for (const a of inRange) {
    const raw = (a as { interestId?: unknown }).interestId;
    const id = typeof raw === 'string' && raw.trim().length > 0 ? raw : 'unknown';
    byInterestMap.set(id, (byInterestMap.get(id) ?? 0) + 1);
  }
  byInterestMap.delete('unknown');
  const byInterest = Array.from(byInterestMap.entries())
    .map(([id, count]) => ({ id, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);
  const activeInterests = byInterestMap.size;

  // longestStreak — range 내 일별 답변 연속 기록
  const dateSet = new Set(inRange.map(a => kstDateOf(a.createdAt)));
  let longestStreak = 0;
  let curStreak = 0;
  for (let i = days - 1; i >= 0; i--) {
    const d = dateNDaysAgo(today, i);
    if (dateSet.has(d)) {
      curStreak += 1;
      longestStreak = Math.max(longestStreak, curStreak);
    } else {
      curStreak = 0;
    }
  }

  // daily — range=30만 반환
  const daily =
    days === 30
      ? Array.from({ length: 30 }, (_, i) => {
          const d = dateNDaysAgo(today, 29 - i);
          return inRange.filter(a => kstDateOf(a.createdAt) === d).length;
        })
      : undefined;

  return { totalAnswers, longestStreak, activeInterests, avgPerDay, byInterest, daily };
}
