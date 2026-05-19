import { describe, it, expect } from 'vitest';
import { interestKeywords, matchesInterest } from '../../src/utils/interestKeywords';

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

describe('matchesInterest (v3.39 T2 — Codex 사전 P0-3)', () => {
  it('valid id + text에 keyword 토큰 포함 → true', () => {
    // ai_ml interestKeywords: ['ai_ml', 'ai', 'ml', 'openai', 'genai', 'aiops', 'aiml']
    // 'AI' 토큰이 word-boundary로 매칭 (length<=3 → \bai\b regex).
    expect(matchesInterest('AI 모델 학습 방법', 'ai_ml')).toBe(true);
  });
  it('valid id이지만 매칭 토큰 없음 → false', () => {
    expect(matchesInterest('아무 관련 없는 텍스트', 'ai_ml')).toBe(false);
  });
  it('invalid id (INTERESTS에 없음) → false', () => {
    expect(matchesInterest('AI 모델', 'totally_fake_id')).toBe(false);
  });
  it('lowercase 정규화 — 대문자 keyword도 매칭', () => {
    // hr_system interestKeywords: ['hr_system', '인사제도']
    // 'hr_system'은 length>3 → includes 경로. 'HR_SYSTEM' lowercase 후 hay에 includes.
    expect(matchesInterest('우리 HR_SYSTEM 도입 추진', 'hr_system')).toBe(true);
  });
  it('한국어 keyword 매칭 — hr_system label 토큰 "인사제도"', () => {
    expect(matchesInterest('인사제도 개편 검토', 'hr_system')).toBe(true);
  });
  it('빈 텍스트 → false', () => {
    expect(matchesInterest('', 'ai_ml')).toBe(false);
  });
  it('unknown sentinel id → false (INTERESTS catalog 없음)', () => {
    expect(matchesInterest('AI 모델 학습', 'unknown')).toBe(false);
  });
});
