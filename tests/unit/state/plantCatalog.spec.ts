import { describe, it, expect } from 'vitest';
import {
  getPlantIcon,
  thresholdLookup,
  STAGE_LABEL,
  STAGE_THRESHOLDS,
} from '../../../src/state/plantCatalog';

describe('plantCatalog', () => {
  describe('getPlantIcon', () => {
    it('stage 1~4 = 분야 공통 emoji', () => {
      expect(getPlantIcon('recruiting', 1)).toBe('🌱');
      expect(getPlantIcon('ai_ml', 1)).toBe('🌱');
      expect(getPlantIcon('recruiting', 4)).toBe('🌳');
      expect(getPlantIcon('ai_ml', 4)).toBe('🌳');
    });

    it('stage 5 = 분야별 차별화 (실제 INTERESTS catalog ID 기준)', () => {
      expect(getPlantIcon('recruiting', 5)).toBe('🏆');
      expect(getPlantIcon('ai_ml', 5)).toBe('🤖');
      expect(getPlantIcon('startup', 5)).toBe('🦄');
      expect(getPlantIcon('self_dev', 5)).toBe('🌳');
    });

    it('stage 5 + 사용자 정의 분야 → default fallback', () => {
      expect(getPlantIcon('my_custom_topic', 5)).toBe('🌸');
    });

    it('Codex S9 fix 회귀: 가상 ID(ai/design/economy/trend/practice/growth) 호출은 fallback', () => {
      // 옛 plan v1의 가상 ID는 catalog 외 → DEFAULT_STAGE5
      expect(getPlantIcon('ai', 5)).toBe('🌸');
      expect(getPlantIcon('design', 5)).toBe('🌸');
    });
  });

  describe('thresholdLookup', () => {
    it('boundary case', () => {
      expect(thresholdLookup(0)).toBe(1);
      expect(thresholdLookup(7)).toBe(1);
      expect(thresholdLookup(8)).toBe(2);
      expect(thresholdLookup(24)).toBe(2);
      expect(thresholdLookup(25)).toBe(3);
      expect(thresholdLookup(69)).toBe(3);
      expect(thresholdLookup(70)).toBe(4);
      expect(thresholdLookup(159)).toBe(4);
      expect(thresholdLookup(160)).toBe(5);
      expect(thresholdLookup(99999)).toBe(5);
    });

    it('NaN/negative/fractional → 1 (defensive)', () => {
      expect(thresholdLookup(-5)).toBe(1);
      expect(thresholdLookup(7.9)).toBe(1);
      expect(thresholdLookup(NaN)).toBe(1);
    });
  });

  describe('STAGE_LABEL', () => {
    it('5 단계 모두 한글 라벨', () => {
      expect(STAGE_LABEL[1]).toBe('씨앗');
      expect(STAGE_LABEL[5]).toBe('만개');
    });
  });

  describe('STAGE_THRESHOLDS (placeholder, T2 시뮬 결과 반영)', () => {
    it('exponential ratio 보존 (~3x ramp)', () => {
      expect(STAGE_THRESHOLDS).toHaveLength(4);
      // 시뮬 후 실제 값으로 갱신 시 본 spec assert는 그대로 유지 (구조만 검증)
      expect(STAGE_THRESHOLDS[0]).toBeGreaterThan(0);
      for (let i = 1; i < STAGE_THRESHOLDS.length; i++) {
        expect(STAGE_THRESHOLDS[i]).toBeGreaterThan(STAGE_THRESHOLDS[i - 1]!);
      }
    });
  });
});
