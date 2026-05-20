/**
 * v3.40 T7 (C5 + Codex 사전 P1-2): "v3.39부터 분야별 통계가 정확" one-time toast.
 *
 * v3.39 Answer/Briefing schema v9에서 byInterest 의미 정정 (interestId exact filter)이
 * stats/archive 양쪽에 영향. one-time toast로 1회 안내.
 *
 * Trigger: stats 진입 (renderStats) 또는 archive 진입 (renderArchive) 중 최초 1회.
 * Storage: localStorage `dg.toast.byInterestNotice` === '1' strict check.
 *
 * @internal — caller는 src/ui/tabs/stats.ts + src/ui/tabs/archive.ts 2 spot.
 */
import { showToast } from '../../utils/toast';

const STORAGE_KEY = 'dg.toast.byInterestNotice';
const SHOWN_FLAG = '1';
const MESSAGE = '📊 분야별 통계가 정확해졌어요\n이제 관심분야 단위로 집계됩니다';
const DURATION_MS = 4000;

export function maybeShowByInterestNotice(): void {
  // v3.40 T7: defensive — localStorage quota/throw가 stats/archive 렌더 차단하지 않게.
  try {
    if (localStorage.getItem(STORAGE_KEY) === SHOWN_FLAG) return;
    showToast(MESSAGE, DURATION_MS);
    localStorage.setItem(STORAGE_KEY, SHOWN_FLAG);
  } catch {
    // localStorage 접근 실패 시 silent — 안내 toast 미노출 OK.
  }
}
