/**
 * Intl.DateTimeFormat KST singleton 중앙화 (v3.26 T1a, Codex 사전 P1-1).
 * 사용 의무: KST anchor 가 필요한 모든 module은 본 export 를 import.
 * caller: src/utils/dates.ts, src/utils/statsAggregate.ts, src/state/missionEngine.ts.
 */

export const KST_FMT_DATE = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Seoul',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});
