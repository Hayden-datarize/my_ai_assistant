import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mountNav, switchTab, TABS } from '../../src/ui/nav';

// v3.30 T5 (v3.29 carry C6): controlled deferred loader 헬퍼 — Promise resolver를
// 외부 노출하여 out-of-order chunk resolve를 결정론적으로 simulate.
function createDeferredLoader(
  render: (c: HTMLElement) => void,
): { load: () => Promise<(c: HTMLElement) => void>; resolve: () => void } {
  let resolveFn!: () => void;
  const pending = new Promise<(c: HTMLElement) => void>((res) => {
    resolveFn = () => res(render);
  });
  return { load: () => pending, resolve: resolveFn };
}

beforeEach(() => {
  document.body.replaceChildren();
  const app = document.createElement('main');
  app.id = 'app';
  const nav = document.createElement('nav');
  nav.id = 'bottomNav';
  document.body.append(app, nav);
});

describe('nav', () => {
  it('mounts 5 tab buttons', () => {
    mountNav();
    // v3.27 T2a: insights tab 제거 (6→5).
    expect(document.querySelectorAll('#bottomNav button').length).toBe(5);
  });
  // v3.29 T3: switchTab은 dynamic import 후 async — await 필요.
  it('switchTab("home") renders Home into #app', async () => {
    mountNav();
    await switchTab('home');
    expect(document.querySelector('#homeTab')).not.toBeNull();
  });
  it('switchTab("archive") renders Archive into #app', async () => {
    mountNav();
    await switchTab('archive');
    expect(document.querySelector('#archiveTab')).not.toBeNull();
  });

  it('v3.29 T3 review fix (I1): rapid switch — 최신 요청만 active, stale drop', async () => {
    // rapid clicks 시뮬레이션 — home → archive 연속 호출 후 모두 await.
    // pendingSwitchToken으로 token 비교 → 최신(archive)만 DOM mutate + active toggle.
    mountNav();
    const p1 = switchTab('home');
    const p2 = switchTab('archive');
    await Promise.all([p1, p2]);

    // 최종 active는 archive 단 1개
    const buttons = document.querySelectorAll<HTMLButtonElement>('.nav-item');
    const activeIds: string[] = [];
    buttons.forEach((b) => {
      if (b.classList.contains('active')) activeIds.push(b.dataset['tabId']!);
    });
    expect(activeIds).toEqual(['archive']);
  });

  // v3.30 T5 (v3.29 carry C6): out-of-order chunk resolve를 controlled deferred로
  // 강제 simulate — natural import 순서에 의존하지 않고 stale-render drop을 결정론 검증.
  describe('controlled deferred loader — out-of-order resolve', () => {
    const homeTab = TABS.find((t) => t.id === 'home')!;
    const archiveTab = TABS.find((t) => t.id === 'archive')!;
    const originalHomeLoad = homeTab.load;
    const originalArchiveLoad = archiveTab.load;

    afterEach(() => {
      // 다른 spec에 영향 X — 원본 load 복원.
      homeTab.load = originalHomeLoad;
      archiveTab.load = originalArchiveLoad;
    });

    it('home pending → archive pending → archive resolve first → home resolve last: home stale drop', async () => {
      mountNav();

      const homeDeferred = createDeferredLoader((c) => {
        const el = document.createElement('div');
        el.id = 'homeTab';
        c.append(el);
      });
      const archiveDeferred = createDeferredLoader((c) => {
        const el = document.createElement('div');
        el.id = 'archiveTab';
        c.append(el);
      });
      homeTab.load = homeDeferred.load;
      archiveTab.load = archiveDeferred.load;

      // Step 1: switchTab('home') 호출 → token=1, home.load pending
      const homeSwitch = switchTab('home');
      // Step 2: switchTab('archive') 호출 → token=2, archive.load pending
      const archiveSwitch = switchTab('archive');

      // Step 3: archive 먼저 resolve → token 일치(2===2), archive render + active toggle
      archiveDeferred.resolve();
      // Step 4: home 나중 resolve → token 불일치(1 !== 2), stale drop
      homeDeferred.resolve();

      await Promise.all([homeSwitch, archiveSwitch]);

      // 최종 상태: archive만 render, home은 stale drop
      expect(document.querySelector('#archiveTab')).not.toBeNull();
      expect(document.querySelector('#homeTab')).toBeNull();
      const active = Array.from(
        document.querySelectorAll<HTMLButtonElement>('.nav-item.active'),
      ).map((b) => b.dataset['tabId']);
      expect(active).toEqual(['archive']);
    });

    it('home resolve first (natural order) → archive resolve last: archive wins (latest token)', async () => {
      // 반대 시나리오 — natural 순서로 resolve해도 token=2(archive)가 최신이므로 archive win.
      mountNav();

      const homeDeferred = createDeferredLoader((c) => {
        const el = document.createElement('div');
        el.id = 'homeTab';
        c.append(el);
      });
      const archiveDeferred = createDeferredLoader((c) => {
        const el = document.createElement('div');
        el.id = 'archiveTab';
        c.append(el);
      });
      homeTab.load = homeDeferred.load;
      archiveTab.load = archiveDeferred.load;

      const homeSwitch = switchTab('home');
      const archiveSwitch = switchTab('archive');

      // home 먼저 resolve → token=1, 현재 pending=2, stale drop (DOM 변경 X)
      homeDeferred.resolve();
      // microtask flush — home의 stale-drop branch가 먼저 실행되도록 보장
      await Promise.resolve();
      archiveDeferred.resolve();

      await Promise.all([homeSwitch, archiveSwitch]);

      expect(document.querySelector('#archiveTab')).not.toBeNull();
      expect(document.querySelector('#homeTab')).toBeNull();
      const active = Array.from(
        document.querySelectorAll<HTMLButtonElement>('.nav-item.active'),
      ).map((b) => b.dataset['tabId']);
      expect(active).toEqual(['archive']);
    });
  });
});

describe('nav TABS catalog', () => {
  it('includes 5 tabs in fixed order', () => {
    // v3.27 T2a: insights 제거 (P0-5).
    expect(TABS.map((t) => t.id)).toEqual(['home', 'archive', 'stats', 'settings', 'missions']);
  });

  it('missions tab carries 미션 label and 🎯 icon', () => {
    const m = TABS.find((t) => t.id === 'missions');
    expect(m?.label).toBe('미션');
    expect(m?.icon).toBe('🎯');
  });
});
