import type { User } from './user';
import { thresholdLookup } from './plantCatalog';

/**
 * 분야 1회 활동 기록 — cumulativeActivity 증가 + stage 재계산 + lastEngagedAt 갱신.
 *
 * **In-memory mutation only**. saveUser는 caller 책임 (atomic single-write 원칙, v3.10/v3.13.1 graduated).
 * 이벤트 emit은 caller path에서 takeSnapshot/runSweep diff로 자동 처리 (achievements.ts plant-stage-up).
 *
 * @param user - User (mutate)
 * @param interestId - 분야 ID (user.interests 멤버 가정. archived 분야도 호출 가능 — entry 유지)
 * @param delta - 보통 +1, 스크랩+메모 같이 발생하면 +2
 */
export function tickPlantActivity(user: User, interestId: string, delta: number): void {
  if (!Number.isFinite(delta) || delta <= 0) return;
  const today = new Date().toISOString();

  let plant = user.plantStateByInterest[interestId];
  if (!plant) {
    plant = { stage: 1, cumulativeActivity: 0 };
    user.plantStateByInterest[interestId] = plant;
  }

  const newCum = (Number.isFinite(plant.cumulativeActivity) ? plant.cumulativeActivity : 0) + delta;
  const newStage = thresholdLookup(newCum);

  plant.cumulativeActivity = newCum;
  plant.lastEngagedAt = today;
  if (newStage > plant.stage) {
    plant.stage = newStage;
    if (newStage === 5 && !plant.unlockedAt) {
      plant.unlockedAt = today;  // 영구 ✨ 마크 (한 번만 셋, idempotent)
    }
  }
}

/**
 * 미션 1개 완수 시 모든 식물에 동시 보너스 적용 (v3.13 anchor 이행).
 *
 * **In-memory mutation only**. saveUser는 caller (tickMissionProgress) 책임.
 * spec §3.2 placeholder 보너스: daily +1, weekly +5, monthly +20 (T2 §Mission Bonus Sim 후 ±50% 가능).
 *
 * archived 식물 (user.interests 외) 도 entry 있으면 update — 분야 재추가 시 누적 보존 (Q8-B).
 */
export function applyMissionBonus(user: User, period: 'daily' | 'weekly' | 'monthly'): void {
  const BONUS: Record<'daily' | 'weekly' | 'monthly', number> = { daily: 1, weekly: 5, monthly: 20 };
  const bonus = BONUS[period];
  for (const interestId of Object.keys(user.plantStateByInterest)) {
    tickPlantActivity(user, interestId, bonus);
  }
}

/**
 * S10 fix (Codex P1-4): 분야 추가 시 plant entry 자동 생성 — interests modal save 시 호출.
 *
 * user.interests에 있는 ID 중 plantStateByInterest에 entry 없는 것에 대해 stage 1 식물 생성.
 * 기존 entry는 유지 (archive/restore 정책 — Q8-B). 본 함수는 idempotent.
 *
 * **In-memory mutation only**. saveUser는 caller (interests modal save handler) 책임.
 */
export function ensurePlantsForInterests(user: User): void {
  const today = new Date().toISOString();
  for (const interestId of user.interests) {
    if (!user.plantStateByInterest[interestId]) {
      user.plantStateByInterest[interestId] = {
        stage: 1,
        cumulativeActivity: 0,
        lastEngagedAt: today,  // 첫 인상 wilting 회피 (C3 패턴 follow)
      };
    }
  }
}
