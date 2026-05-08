/**
 * @deprecated v3.22 — 머신 TZ 기반 'YYYY-MM-DD' 반환. KST anchor 필요 시 `getKstDateStr` 사용.
 * v3.23+ 삭제 예정. 신규 caller는 ESLint `no-restricted-imports`로 차단.
 * 기존 caller는 v3.22 T5에서 모두 `getKstDateStr`로 마이그레이션 완료.
 */
export function getDateStr(date: Date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * KST (Asia/Seoul) 자정 anchor formatter.
 * 머신 TZ에 무관하게 'YYYY-MM-DD' KST 날짜 반환.
 * v3.14.5 T4 TZ guard sweep graduated pattern (Intl.DateTimeFormat).
 */
const KST_FMT = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Seoul',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

export function getKstDateStr(date: Date = new Date()): string {
  return KST_FMT.format(date);
}
