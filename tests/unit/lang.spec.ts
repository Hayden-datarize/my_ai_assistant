import { describe, it, expect } from 'vitest';
import { detectLanguage } from '../../src/utils/lang';

describe('detectLanguage', () => {
  it('classifies pure Korean title as ko', () => {
    expect(detectLanguage('오늘의 성장 일기')).toBe('ko');
  });

  it('classifies pure English title as en', () => {
    expect(detectLanguage('OpenAI launches new GPT model')).toBe('en');
  });

  it('classifies Korean+English mixed (한글 1자 이상) as ko', () => {
    expect(detectLanguage('AI startup 등장')).toBe('ko');
    expect(detectLanguage('MIT 입학')).toBe('ko');
  });

  it('classifies short English with brand+number (GPT-5) as en', () => {
    expect(detectLanguage('GPT-5')).toBe('en');
  });

  it('uses description as supplement when title is too short', () => {
    expect(detectLanguage('GPT-5', '오픈AI가 새로운 모델을 발표했습니다')).toBe('ko');
  });

  it('classifies emoji-only title as unknown', () => {
    expect(detectLanguage('🚀✨')).toBe('unknown');
  });

  it('classifies numeric-only title as unknown', () => {
    expect(detectLanguage('2026 04 26')).toBe('unknown');
  });

  it('classifies Japanese-only title as unknown (no Korean, ASCII < 50%)', () => {
    expect(detectLanguage('東京の最新ニュース')).toBe('unknown');
  });

  it('handles whitespace-only input as unknown', () => {
    expect(detectLanguage('   ')).toBe('unknown');
  });

  it('handles empty input as unknown', () => {
    expect(detectLanguage('')).toBe('unknown');
  });
});
