import { describe, it, expect } from 'vitest';
import { interestKeywords } from '../../src/utils/interestKeywords';

describe('interestKeywords', () => {
  it('returns id lowercase + label keywords for known interest', () => {
    // 'ai_ml' label에 한국어 + AI/ML 같은 토큰 포함 가정 (categories.ts 참조)
    const k = interestKeywords('ai_ml');
    expect(k).toContain('ai_ml');
    expect(k.length).toBeGreaterThan(1);
  });

  it('returns just lowercased id for unknown interest', () => {
    expect(interestKeywords('UNKNOWN_X')).toEqual(['unknown_x']);
  });

  it('strips emoji prefix from label and splits on whitespace/slash', () => {
    // hr_system label: '🏢 인사제도' (또는 유사) — emoji 제거 후 split
    const k = interestKeywords('hr_system');
    expect(k.every(s => !/\p{Extended_Pictographic}/u.test(s))).toBe(true);
  });

  it('ai_ml은 BRAND_ALIASES(openai/genai/aiops/aiml)를 포함한다 (codex P1 false-negative 차단)', () => {
    const k = interestKeywords('ai_ml');
    expect(k).toContain('openai');
    expect(k).toContain('genai');
    expect(k).toContain('aiops');
    expect(k).toContain('aiml');
  });
});
