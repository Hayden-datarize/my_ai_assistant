import { describe, it, expect, beforeEach } from 'vitest';

/**
 * v3.27 T2b: archive 통합 onboarding — insights tab 폐기 충격 mitigation.
 * - 첫 진입 is-new 배지 + tutorial overlay 1회 (sessionStorage gate).
 */

describe('v3.27 T2b: archive 통합 onboarding', () => {
  beforeEach(async () => {
    localStorage.clear();
    sessionStorage.clear();
    document.body.replaceChildren();
  });

  it('첫 진입 시 NEW 배지 + tutorial overlay 노출', async () => {
    const tab = await import('../../src/ui/tabs/archive');
    const container = document.createElement('div');
    tab.renderArchive(container);
    expect(container.querySelector('#archiveRelocatedBanner')).not.toBeNull();
    expect(container.querySelector('.archive-relocated-badge')).not.toBeNull();
    expect(container.querySelector('.archive-tutorial-overlay')).not.toBeNull();
  });

  it('dismiss 클릭 → sessionStorage stamp + 재진입 시 미노출', async () => {
    const tab = await import('../../src/ui/tabs/archive');
    const handlers = await import('../../src/ui/handlers/archive');
    const container = document.createElement('div');
    container.id = 'archiveTab';
    document.body.appendChild(container);
    tab.renderArchive(container);
    handlers.mountArchiveHandlers();

    document.getElementById('archiveOnboardingDismiss')!.click();
    expect(sessionStorage.getItem('archive-relocated-seen')).toBe('1');
    expect(document.getElementById('archiveRelocatedBanner')).toBeNull();

    // 재진입 — 새 container에 render → banner 미노출
    const container2 = document.createElement('div');
    tab.renderArchive(container2);
    expect(container2.querySelector('#archiveRelocatedBanner')).toBeNull();
  });
});
