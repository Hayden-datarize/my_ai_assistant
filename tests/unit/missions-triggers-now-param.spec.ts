/**
 * v3.14 T6: missions-triggers single-now invariant (codex P1-7).
 *
 * fireTrigger에 optional `now?: Date` 파라미터가 추가되어 caller가 두 trigger를
 * 연속 호출할 때 동일 Date instance를 공유 — KST 자정 경계 race 차단.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { saveUser } from '../../src/state/user';
import { mkUser } from './state/userFixture';

describe('missions-triggers single-now invariant (codex P1-7)', () => {
  beforeEach(() => {
    vi.resetModules();
    localStorage.clear();
    saveUser(mkUser({ name: 'T', interests: ['ai_ml'] }));
  });

  it('two triggers called with shared `now` use the same Date instance', async () => {
    const tickSpy = vi.fn();
    vi.doMock('../../src/state/missionEngine', async () => {
      const actual = await vi.importActual<typeof import('../../src/state/missionEngine')>(
        '../../src/state/missionEngine',
      );
      return { ...actual, tickMissionProgress: tickSpy };
    });
    const { fireBriefingViewTrigger, fireCrossInterestTrigger } = await import(
      '../../src/ui/handlers/missions-triggers'
    );
    const sharedNow = new Date('2026-05-01T14:59:59.999+09:00');
    fireBriefingViewTrigger(sharedNow);
    fireCrossInterestTrigger(sharedNow);
    expect(tickSpy).toHaveBeenCalledTimes(2);
    expect(tickSpy.mock.calls[0]?.[2]).toBe(sharedNow);
    expect(tickSpy.mock.calls[1]?.[2]).toBe(sharedNow);
  });

  it('zero-arg call still produces a fresh Date (default param)', async () => {
    const tickSpy = vi.fn();
    vi.doMock('../../src/state/missionEngine', async () => {
      const actual = await vi.importActual<typeof import('../../src/state/missionEngine')>(
        '../../src/state/missionEngine',
      );
      return { ...actual, tickMissionProgress: tickSpy };
    });
    const { fireBriefingViewTrigger } = await import(
      '../../src/ui/handlers/missions-triggers'
    );
    const before = Date.now();
    fireBriefingViewTrigger();
    const after = Date.now();
    const passedNow = tickSpy.mock.calls[0]?.[2] as Date;
    expect(passedNow).toBeInstanceOf(Date);
    expect(passedNow.getTime()).toBeGreaterThanOrEqual(before);
    expect(passedNow.getTime()).toBeLessThanOrEqual(after);
  });
});
