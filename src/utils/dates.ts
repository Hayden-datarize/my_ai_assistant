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
