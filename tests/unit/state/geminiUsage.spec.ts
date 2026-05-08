import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  getGeminiCap, setGeminiCap, getGeminiTodayCount, checkAndIncrementGemini, resetForTest,
} from '../../../src/state/geminiUsage';

describe('gemini usage counter', () => {
  beforeEach(() => {
    localStorage.clear();
    resetForTest();
    vi.setSystemTime(new Date('2026-05-08T10:00:00Z'));
  });

  it('default cap is 50', () => {
    expect(getGeminiCap()).toBe(50);
  });

  it('increment increases count', () => {
    expect(checkAndIncrementGemini()).toBe(true);
    expect(getGeminiTodayCount()).toBe(1);
    expect(checkAndIncrementGemini()).toBe(true);
    expect(getGeminiTodayCount()).toBe(2);
  });

  it('returns false when cap reached', () => {
    setGeminiCap(10); // clamp min=10
    for (let i = 0; i < 10; i++) expect(checkAndIncrementGemini()).toBe(true);
    expect(checkAndIncrementGemini()).toBe(false);
    expect(getGeminiTodayCount()).toBe(10);
  });

  it('clampCap — NaN → DEFAULT 50 / min 10 / max 200', () => {
    setGeminiCap(NaN);
    expect(getGeminiCap()).toBe(50);

    setGeminiCap(5);
    expect(getGeminiCap()).toBe(10);

    setGeminiCap(999);
    expect(getGeminiCap()).toBe(200);
  });

  it('cross-feature LS 분리 — dg_gemini_usage ≠ dg_translate_usage', () => {
    // Gemini increment는 translate LS key를 건드리지 않는다
    localStorage.setItem('dg_translate_usage', JSON.stringify({ date: '2026-05-08', count: 99 }));
    checkAndIncrementGemini();
    checkAndIncrementGemini();

    const translateRaw = localStorage.getItem('dg_translate_usage');
    expect(translateRaw).not.toBeNull();
    const translate = JSON.parse(translateRaw!) as { count: number };
    // translate count는 gemini increment의 영향을 받지 않아야 한다
    expect(translate.count).toBe(99);

    // gemini usage key는 별도로 기록됨
    const geminiRaw = localStorage.getItem('dg_gemini_usage');
    expect(geminiRaw).not.toBeNull();
    const gemini = JSON.parse(geminiRaw!) as { count: number };
    expect(gemini.count).toBe(2);
  });
});
