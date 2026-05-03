import type { PlantStage } from './plantTypes';

/**
 * Stage 1~4: 분야 공통 emoji (씨앗 → 새싹 → 줄기 → 봉오리)
 * Stage 5: 분야별 차별화 emoji (max stage 도달 시 도파민 모먼트)
 *
 * 사용자 정의 분야 (catalog 외) → DEFAULT_STAGE5 fallback (🌸)
 */
const COMMON_STAGE_EMOJI: Record<1 | 2 | 3 | 4, string> = {
  1: '🌱',  // 씨앗
  2: '🌿',  // 새싹
  3: '🌷',  // 줄기
  4: '🌳',  // 봉오리
};

/**
 * Stage 5 분야별 (interest ID → emoji). 실제 INTERESTS catalog
 * (`src/utils/categories.ts`) 15개 ID 기준. 사용자 정의 분야는 DEFAULT_STAGE5.
 *
 * Stage 5 emoji 디자인 원칙: 각 분야 정체성을 살리면서 "만개" 트로피 느낌.
 */
const STAGE5_BY_INTEREST: Record<string, string> = {
  // HR (6)
  recruiting:    '🏆',  // 🎯 채용 → 트로피 (도달감)
  onboarding:    '🚀',  // 🚀 온보딩 (label 동일)
  culture:       '🏛️',  // 🏢 조직문화 → 견고한 조직
  hr_system:     '📜',  // 📋 인사제도 → 문서 정합
  labor_law:     '⚖️',  // ⚖️ 노무/법률 (label 동일)
  leadership:    '👑',  // 👑 리더십 (label 동일)
  // Tech (3)
  pm:            '🛠️',  // 📱 프로덕트 → 도구 마스터
  ai_ml:         '🤖',  // 🤖 AI/ML (label 동일)
  data:          '📈',  // 📊 데이터분석 → 성장 차트
  // Biz (2)
  startup:       '🦄',  // 🦄 스타트업 (label 동일)
  marketing:     '📣',  // 📣 마케팅 (label 동일)
  // General (4)
  productivity:  '⚡',  // ⚡ 생산성 (label 동일)
  career:        '🎯',  // 🎯 커리어 (label 동일)
  communication: '💬',  // 💬 커뮤니케이션 (label 동일)
  self_dev:      '🌳',  // 🌱 자기계발 → 성장의 끝 (stage 1 🌱과 차별화)
};

const DEFAULT_STAGE5 = '🌸';  // catalog 외 분야 (사용자 정의) fallback

/** Stage 5 도달 시 영구 ✨ 마크 (모든 분야 공통, 분야별 emoji와 별도 overlay) */
export const TROPHY_MARK = '✨';

/**
 * Stage 1~5 중 분야별 emoji 반환.
 * Stage 1~4는 분야와 무관 공통, Stage 5만 분야별 (catalog 외는 default).
 */
export function getPlantIcon(interestId: string, stage: PlantStage): string {
  if (stage === 5) {
    return STAGE5_BY_INTEREST[interestId] ?? DEFAULT_STAGE5;
  }
  return COMMON_STAGE_EMOJI[stage];
}

/** Stage 라벨 (UI 카드 텍스트). i18n MSG와 별도 — 본 catalog는 한국어. */
export const STAGE_LABEL: Record<PlantStage, string> = {
  1: '씨앗',
  2: '새싹',
  3: '줄기',
  4: '봉오리',
  5: '만개',
};

/**
 * cumulativeActivity 누적 → 도달 stage 매핑.
 * spec §3.1 threshold. T2 §Threshold Sim 결과로 확정 (유지 결정).
 *
 * 곡선: exponential ratio 보존 (8 → 25 → 70 → 160 = 약 3x ramp).
 */
export const STAGE_THRESHOLDS: readonly [number, number, number, number] = [8, 25, 70, 160];

/**
 * cumulativeActivity 누적 카운트 → stage derive.
 * 0~7 → 1, 8~24 → 2, 25~69 → 3, 70~159 → 4, 160+ → 5.
 * NaN / negative / fractional 입력 → defensive: 1 반환.
 */
export function thresholdLookup(cumulativeActivity: number): PlantStage {
  // NaN guard: isNaN 체크로 명시적 처리
  if (!Number.isFinite(cumulativeActivity)) return 1;
  const c = Math.max(0, Math.floor(cumulativeActivity));
  if (c >= STAGE_THRESHOLDS[3]) return 5;
  if (c >= STAGE_THRESHOLDS[2]) return 4;
  if (c >= STAGE_THRESHOLDS[1]) return 3;
  if (c >= STAGE_THRESHOLDS[0]) return 2;
  return 1;
}
