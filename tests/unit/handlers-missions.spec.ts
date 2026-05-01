/**
 * v3.14 T4: handlers/missions.ts — dg:nav:tab-changed 시 hydrateMissions 호출.
 *
 * Option A 검증: renderMissionsSection (missions-section 모듈) 호출 여부를 spy로 확인.
 * 이유 — hydrateMissions 내부 구현이 바뀌어도 "missions 탭 진입 → 렌더 1회" 계약은 불변.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { saveUser } from '../../src/state/user';
import { mkUser } from './state/userFixture';

describe('handlers/missions tab-changed wiring', () => {
  beforeEach(() => {
    vi.resetModules();
    document.body.innerHTML = '<div id="missionsContainer"></div>';
    localStorage.clear();
  });

  afterEach(() => {
    vi.doUnmock('../../src/ui/missions-section');
  });

  it('hydrates missions exactly once when nav switches to missions tab', async () => {
    const renderSpy = vi.fn();
    vi.doMock('../../src/ui/missions-section', () => ({
      renderMissionsSection: renderSpy,
    }));

    // fixture: cached user 가 있어야 hydrateMissions 가 early-return 하지 않음.
    saveUser(mkUser({ name: 'T', interests: ['ai_ml'] }));

    const { registerMissionsHandlers } = await import('../../src/ui/handlers/missions');
    registerMissionsHandlers();

    document.dispatchEvent(
      new CustomEvent('dg:nav:tab-changed', { detail: { tab: 'missions' } }),
    );

    expect(renderSpy).toHaveBeenCalledTimes(1);
  });

  it('does NOT hydrate when tab-changed fires for a non-missions tab', async () => {
    const renderSpy = vi.fn();
    vi.doMock('../../src/ui/missions-section', () => ({
      renderMissionsSection: renderSpy,
    }));

    saveUser(mkUser({ name: 'T', interests: ['ai_ml'] }));

    const { registerMissionsHandlers } = await import('../../src/ui/handlers/missions');
    registerMissionsHandlers();

    document.dispatchEvent(
      new CustomEvent('dg:nav:tab-changed', { detail: { tab: 'home' } }),
    );
    document.dispatchEvent(
      new CustomEvent('dg:nav:tab-changed', { detail: { tab: 'archive' } }),
    );
    document.dispatchEvent(
      new CustomEvent('dg:nav:tab-changed', { detail: { tab: 'stats' } }),
    );

    expect(renderSpy).not.toHaveBeenCalled();
  });
});
