import { describe, it, expect, beforeEach } from 'vitest';
import { mountNav, switchTab, TABS } from '../../src/ui/nav';

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
