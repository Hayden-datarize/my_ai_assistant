import { describe, it, expect, beforeEach } from 'vitest';
import { renderSettings } from '../../src/ui/tabs/settings';
import { saveUser } from '../../src/state/user';
import { getKstDateStr } from '../../src/utils/dates';
import { mkUser } from '../unit/state/userFixture';

const daysAgoKst = (n: number) => getKstDateStr(new Date(Date.now() - n * 86400_000));

describe('settings freeze section (v3.48)', () => {
  beforeEach(() => { document.body.replaceChildren(); localStorage.clear(); });

  it('보유량 + 다음 충전 표시 (count 1, cap 미만)', () => {
    saveUser(mkUser({ streakFreeze: { count: 1, lastEarnedAt: daysAgoKst(8) } }));
    const c = document.createElement('div');
    renderSettings(c);
    const status = c.querySelector('#freezeStatus')!;
    expect(status.textContent).toContain('❄️');
    expect(status.textContent).toContain('1');
  });

  it('count=2 (cap) → "가득 참"', () => {
    saveUser(mkUser({ streakFreeze: { count: 2, lastEarnedAt: daysAgoKst(0) } }));
    const c = document.createElement('div');
    renderSettings(c);
    expect(c.querySelector('#freezeStatus')!.textContent).toContain('가득');
  });

  it('활동 내역 — entry 표시', () => {
    saveUser(mkUser({
      streakFreeze: { count: 0, lastEarnedAt: daysAgoKst(0) },
      freezeHistory: [{ date: '2026-05-15', kind: 'earned', amount: 1 }],
    }));
    const c = document.createElement('div');
    renderSettings(c);
    expect(c.querySelector('#freezeHistory')!.textContent).toContain('충전');
  });

  it('빈 내역 안내', () => {
    saveUser(mkUser({ streakFreeze: { count: 0, lastEarnedAt: daysAgoKst(0) }, freezeHistory: [] }));
    const c = document.createElement('div');
    renderSettings(c);
    expect(c.querySelector('#freezeHistory')!.textContent).toContain('아직 내역이 없어요');
  });
});
