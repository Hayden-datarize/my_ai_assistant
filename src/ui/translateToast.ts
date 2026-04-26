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
    ? 'API 키가 유효하지 않아요. 설정에서 다시 입력해주세요.'
    : '번역에 실패했어요. 잠시 후 다시 시도해주세요.';

  if (lastShownError === msg) return;
  lastShownError = msg;
  showToast(msg);
}

// Test-only escape hatch (no production caller).
export function __resetToastDedupForTest(): void {
  lastShownError = null;
}
