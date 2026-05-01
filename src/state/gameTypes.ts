/**
 * 게임화 시리즈 공통 타입 (순환 회피 위해 별도 모듈로 분리).
 * achievements.ts와 badgeCatalog.ts 모두 여기서 import (단방향).
 */
import type { MissionInstance, MissionPeriod } from './missionTypes';

export interface Snapshot {
  xp: number;
  streak: number;
  answersCount: number;
  scrapsCount: number;
  memosCount: number;
  uniqueAnsweredTypes: ReadonlySet<string>;
  selectedInterests: ReadonlySet<string>;
  engagedInterests: ReadonlySet<string>;
  uniqueScrapCategories: number;
  earnedBadgeIds: ReadonlySet<string>;
  /** v3.13 T5: 현재 활성 미션 목록 (shallow clone, read-only view) */
  missionsActive: ReadonlyArray<Readonly<MissionInstance>>;
  /** v3.13 T5: 누적 완료 카운트 (daily/weekly/monthly) */
  missionsCumulative: { daily: number; weekly: number; monthly: number };
}

export type GameEvent =
  | { kind: 'xp-gained'; amount: number; at: number }
  | { kind: 'level-up'; tierId: number; at: number }
  | { kind: 'streak-milestone'; days: number; at: number }
  | { kind: 'badge'; badgeId: string; at: number }
  | { kind: 'mission-complete'; defId: string; period: MissionPeriod; rewardXp: number; at: number };

export const STREAK_MILESTONES = [3, 7, 30, 100, 365] as const;
