import { KST_FMT_DATE } from './intl';

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
 * v3.26 T1a: KST_FMT_DATE singleton 중앙화 (src/utils/intl.ts).
 */
export function getKstDateStr(date: Date = new Date()): string {
  return KST_FMT_DATE.format(date);
}

/**
 * ISO → "오늘" / "어제" / "N일 전" 상대 시간 표기.
 * 음수 ms (시계 역행 / 미래 ISO)는 '오늘'으로 가드 (v3.22 T1 로직 보존).
 *
 * v3.24 T7: plant-detail.ts에서 이전 (cross-module dep 해소).
 * 호출처: plant-detail / insights / 향후 cross-module 사용 가능.
 */
export function formatRelative(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  if (ms < 0) return '오늘';
  const days = Math.floor(ms / 86400_000);
  if (days === 0) return '오늘';
  if (days === 1) return '어제';
  return `${days}일 전`;
}
