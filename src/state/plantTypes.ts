export type PlantStage = 1 | 2 | 3 | 4 | 5;

export interface PlantState {
  stage: PlantStage;
  cumulativeActivity: number;
  unlockedAt?: string;        // stage 5 도달 ISO (영구 ✨ 마크용)
  lastEngagedAt?: string;     // 마지막 활동 ISO (wilting 판단)
}
