import { describe, it, expect } from 'vitest';
import { KST_FMT_DATE, KST_FMT_KO } from '../../../src/utils/intl';

/**
 * v3.26 T1b: createdAt UTC ISO contract closing (v3.23 T8 carry).
 * - write side: new Date().toISOString() (UTC, Z 접미)
 * - read side: KST_FMT_DATE.format / KST_FMT_KO.format (KST anchor)
 */
describe('createdAt UTC ISO contract (v3.26 T1b)', () => {
  it('write side stores UTC ISO with Z suffix', () => {
    const insight = { createdAt: new Date('2026-05-10T03:00:00Z').toISOString() };
    expect(insight.createdAt).toMatch(/Z$/);
  });

  it('read side displays as KST date (en-CA YYYY-MM-DD)', () => {
    // 2026-05-10T03:00:00Z = 2026-05-10 12:00 KST
    expect(KST_FMT_DATE.format(new Date('2026-05-10T03:00:00Z'))).toBe('2026-05-10');
  });

  it('UTC pre-midnight maps to next KST day (KST anchor 정확)', () => {
    // 2026-05-10T15:00:00Z = 2026-05-11 00:00 KST
    expect(KST_FMT_DATE.format(new Date('2026-05-10T15:00:00Z'))).toBe('2026-05-11');
  });

  it('KST_FMT_KO formats locale ko-KR (사용자 표시용)', () => {
    // 2026-05-10T03:00:00Z = 2026-05-10 12:00 KST → ko-KR locale numeric
    const out = KST_FMT_KO.format(new Date('2026-05-10T03:00:00Z'));
    // ko-KR locale은 '2026. 5. 10.' 또는 유사 형식
    expect(out).toMatch(/2026/);
    expect(out).toMatch(/5/);
    expect(out).toMatch(/10/);
  });

  it('KST_FMT_KO uses KST anchor (machine TZ 우회)', () => {
    // 2026-05-10T15:00:00Z = KST 2026-05-11 — KST anchor면 11일 표시
    const out = KST_FMT_KO.format(new Date('2026-05-10T15:00:00Z'));
    expect(out).toMatch(/11/); // KST 다음 날
  });

  // v3.26 T1b P1-1 (badge-detail.ts unlockedAt ms epoch 회귀)
  it('KST_FMT_DATE accepts ms epoch input (Date.now() 패턴)', () => {
    // 2026-05-10T03:00:00Z = ms epoch 1778266800000
    const ms = Date.UTC(2026, 4, 10, 3, 0, 0); // month 0-index
    expect(KST_FMT_DATE.format(new Date(ms))).toBe('2026-05-10');
  });

  it('KST_FMT_DATE ms epoch crosses KST midnight correctly', () => {
    // 2026-05-10T15:00:00Z = KST 2026-05-11 (자정 cross)
    const ms = Date.UTC(2026, 4, 10, 15, 0, 0);
    expect(KST_FMT_DATE.format(new Date(ms))).toBe('2026-05-11');
  });
});
