import { describe, it, expect, beforeEach } from 'vitest';
import { loadSlackSettings, saveSlackSettings, clearSlackSettings } from '../../../src/state/slack';

describe('slack settings (v3.19 schema)', () => {
  beforeEach(() => localStorage.clear());

  it('returns null when storage empty', () => {
    expect(loadSlackSettings()).toBeNull();
  });

  it('reads valid email shape', () => {
    saveSlackSettings({ email: 'me@datarize.ai', autoSend: true });
    expect(loadSlackSettings()).toEqual({ email: 'me@datarize.ai', autoSend: true });
  });

  it('rejects legacy webhook shape silently (returns null)', () => {
    localStorage.setItem('dg_slack', JSON.stringify({ webhook: 'https://hooks.slack.com/...', autoSend: true }));
    expect(loadSlackSettings()).toBeNull();
  });

  it('rejects empty email', () => {
    localStorage.setItem('dg_slack', JSON.stringify({ email: '', autoSend: true }));
    expect(loadSlackSettings()).toBeNull();
  });

  it('defaults autoSend to false when missing', () => {
    localStorage.setItem('dg_slack', JSON.stringify({ email: 'me@datarize.ai' }));
    expect(loadSlackSettings()).toEqual({ email: 'me@datarize.ai', autoSend: false });
  });

  it('clearSlackSettings removes localStorage entry', () => {
    saveSlackSettings({ email: 'me@datarize.ai', autoSend: false });
    clearSlackSettings();
    expect(localStorage.getItem('dg_slack')).toBeNull();
  });
});
