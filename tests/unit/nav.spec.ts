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
  it('switchTab("home") renders Home into #app', () => {
    mountNav();
    switchTab('home');
    expect(document.querySelector('#homeTab')).not.toBeNull();
  });
  it('switchTab("archive") renders Archive into #app', () => {
    mountNav();
    switchTab('archive');
    expect(document.querySelector('#archiveTab')).not.toBeNull();
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
