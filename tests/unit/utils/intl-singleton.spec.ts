import { describe, it, expect } from 'vitest';
import { KST_FMT_DATE } from '../../../src/utils/intl';

describe('KST_FMT_DATE singleton (v3.26 T1a)', () => {
  it('uses Asia/Seoul timeZone', () => {
    expect(KST_FMT_DATE.resolvedOptions().timeZone).toBe('Asia/Seoul');
  });

  it('formats UTC noon as KST date (en-CA: YYYY-MM-DD)', () => {
    // 2026-05-10T03:00:00Z = 2026-05-10 12:00 KST
    expect(KST_FMT_DATE.format(new Date('2026-05-10T03:00:00Z'))).toBe('2026-05-10');
  });

  it('formats UTC pre-midnight as next KST date (negative-offset cross)', () => {
    // 2026-05-10T15:00:00Z = 2026-05-11 00:00 KST (KST 자정 직후)
    expect(KST_FMT_DATE.format(new Date('2026-05-10T15:00:00Z'))).toBe('2026-05-11');
  });
});
