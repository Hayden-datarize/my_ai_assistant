/**
 * Translation toast helpers with per-session deduplication. Wraps showToast()
 * so that the same translation-related message (e.g. "cap reached") doesn't
 * fire 20× when a 5-card briefing batch all hit the same condition.
 *
 * Dedup is intentionally session-scoped (module-level variable). It does NOT
 * persist across reloads — that would be too sticky for transient errors.
 */

import { showToast } from '../utils/toast';
import { getCap } from '../state/usage';
import { MSG } from './messages';

let lastShownError: string | null = null;

export function showCapToast(): void {
  const cap = getCap();
  const msg = `오늘 번역 한도(${cap}건)에 도달했어요. 내일 자정에 재개됩니다.`;
  if (lastShownError === msg) return;
  lastShownError = msg;
  showToast(msg);
}

export function showTranslateError(err: unknown): void {
  const status = (err as { status?: number } | null | undefined)?.status;
  const message = (err as { message?: unknown } | null | undefined)?.message;
  const isAuth =
    status === 401 ||
    (typeof message === 'string' && message.includes('session blocked'));

  const msg = isAuth
    ? 'API 키가 유효하지 않아요. 설정에서 다시 입력해주세요.' // 단일 호출 — i18n Lite 미적용 (빈도 1)
    : `번역에 실패했어요. ${MSG.TRY_AGAIN}`;

  if (lastShownError === msg) return;
  lastShownError = msg;
  showToast(msg);
}

/**
 * Partial-failure toast for the translate queue's onDrain. Same dedup
 * mechanism as showCapToast / showTranslateError — identical messages
 * within session collapse to a single toast.
 */
export function showPartialTranslateFail(failedCount: number): void {
  const msg = MSG.partialTranslateFail(failedCount);
  if (lastShownError === msg) return;
  lastShownError = msg;
  showToast(msg);
}

// Production reset — called from settings.ts when the user saves a new API
// key, so a stale error message (e.g. 401) doesn't suppress a future toast
// for an unrelated failure.
export function resetToastDedup(): void {
  lastShownError = null;
}

// Test-only escape hatch (no production caller).
export function __resetToastDedupForTest(): void {
  lastShownError = null;
}
