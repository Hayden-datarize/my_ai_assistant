import { describe, it, expect, beforeEach } from 'vitest';
import { mountNav, switchTab } from '../../src/ui/nav';

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
