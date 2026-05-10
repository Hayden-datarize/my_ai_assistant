/**
 * Intl.DateTimeFormat KST singleton 중앙화 (v3.26 T1a/T1b, Codex 사전 P1-1/P1-2).
 * 사용 의무: KST anchor 가 필요한 모든 module은 본 export 를 import.
 *
 * - KST_FMT_DATE: 'en-CA' YYYY-MM-DD (data anchor + UTC date prefix fix 용)
 *   caller: src/utils/dates.ts, src/utils/statsAggregate.ts, src/state/missionEngine.ts,
 *           src/ui/modals/insight-detail.ts, src/ui/modals/badge-detail.ts
 * - KST_FMT_KO: 'ko-KR' 사용자 표시용 (T1b createdAt read 정합 — machine TZ 우회)
 *   caller: src/ui/tabs/archive.ts, src/ui/handlers/archive.ts
 */

export const KST_FMT_DATE = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Seoul',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

export const KST_FMT_KO = new Intl.DateTimeFormat('ko-KR', {
  timeZone: 'Asia/Seoul',
  year: 'numeric',
  month: 'numeric',
  day: 'numeric',
});
