import { openModal } from './shared';
import { loadUserData, saveUser } from '../../state/user';
import { takeSnapshot } from '../../state/achievements';
import { BADGE_CATALOG, findBadge } from '../../state/badgeCatalog';
import { escapeHtml } from '../../utils/escapeHtml';
import { loadAnswers } from '../../state/persistence';

/**
 * Home tab 활성화 시 호출. answers >= 1 && !gamificationMigrated → backfill + 환영 모달.
 * Idempotent — 모달 닫을 때 gamificationMigrated=true saveUser. 다시 호출되도 no-op.
 *
 * P2-1 fix: backfill 부분 실패 시 backfillSucceeded=false 유지 → onClose에서
 * gamificationMigrated set 안 함 → 다음 home 진입에서 재시도.
 */
export async function maybeShowWelcomeGamification(): Promise<void> {
  const u = loadUserData();
  if (!u) return;
  if (u.gamificationMigrated) return;
  const answers = loadAnswers();
  if (answers.length === 0) return;

  // backfill — try/catch graceful (Risk 1)
  // P2-1: backfill 부분 실패 시 다음 진입에서 재시도되도록 succeeded flag로 onClose 분기.
  //
  // v3.14.2 T11 (P2-12-10 annotation): backfill 중 다른 writer가 user를 mutate하는 race는
  // 이론적으로 가능하나, 현재 home tab 진입 직후 1회 호출 + maybeShowWelcomeGamification은
  // gamificationMigrated guard로 idempotent. 동시 호출 sources 미존재.
  // 향후 background sync writer 도입 시 inFlight Promise lock 패턴으로 가드.
  let backfilledIds: string[] = [];
  let backfillSucceeded = false;
  try {
    const snap = takeSnapshot();
    const now = Date.now();
    for (const def of BADGE_CATALOG) {
      if (def.predicate(snap) && !u.earnedBadges[def.id]) {
        u.earnedBadges[def.id] = now;
        backfilledIds.push(def.id);
      }
    }
    if (backfilledIds.length > 0) {
      saveUser(u);  // throw 시 catch로 — backfillSucceeded false 유지
    }
    backfillSucceeded = true;
  } catch {
    // backfill 실패 — schema 보존, 빈 컬렉션으로 시작 (영구 데이터 손실 없음).
    // gamificationMigrated는 false 유지 → 다음 home 진입 시 재시도.
    backfilledIds = [];
    backfillSucceeded = false;
  }

  const N = backfilledIds.length;
  const miniGrid = backfilledIds
    .map(id => findBadge(id))
    .filter((b): b is NonNullable<ReturnType<typeof findBadge>> => !!b)
    .map(def => `<button type="button" class="badge badge--earned" aria-label="${escapeHtml(def.name)}"><span class="badge-icon">${escapeHtml(def.icon)}</span><span class="badge-name">${escapeHtml(def.name)}</span></button>`).join('');

  // v3.24 T3: indent 압축 (production-safe).
  const bodyHtml = `<div class="welcome-game"><p>이미 달성한 <strong>${N}개</strong> 뱃지가 컬렉션에 추가되었어요!</p><div class="badges-grid">${miniGrid}</div><button type="button" class="btn btn-primary" id="goStatsBtn">stats 탭에서 보기</button></div>`;

  const wrap = openModal({
    title: '🎉 새 게임화 기능',
    bodyHtml,
    onClose: () => {
      const u2 = loadUserData();
      if (!u2 || u2.gamificationMigrated) return;
      // P2-1: backfill 부분 실패 시 flag set 안 함 → 다음 home 진입에서 재시도.
      if (!backfillSucceeded) return;
      u2.gamificationMigrated = true;
      try { saveUser(u2); } catch { /* graceful */ }
    },
  });

  // "stats에서 보기" 버튼 — wrap reference로 query (v3.14.2 T14 / P2-NEW-6: nested modal 도입 시도 invariant 유지).
  wrap.querySelector<HTMLButtonElement>('#goStatsBtn')
    ?.addEventListener('click', async () => {
      // v3.24 T3: dynamic 유지 — `vi.doMock(..ui/nav)` 패턴이 spec에서 lazy-load 가정 (welcome-gamification.spec.ts:80,98).
      const { closeModal } = await import('./shared');
      const { switchTab } = await import('../nav');
      closeModal();           // fires onClose → gamificationMigrated set + focus restore
      switchTab('stats');
    });
}
