import { describe, it, expect, beforeEach } from 'vitest';
import { loadSlackSettings, saveSlackSettings, clearSlackSettings } from '../../src/state/slack';

describe('state/slack', () => {
  beforeEach(() => localStorage.clear());

  it('loadSlackSettings returns null when none saved', () => {
    expect(loadSlackSettings()).toBeNull();
  });

  it('save/load roundtrip', () => {
    saveSlackSettings({ webhook: 'https://hooks.slack.com/services/X/Y/Z', autoSend: true });
    expect(loadSlackSettings()).toEqual({
      webhook: 'https://hooks.slack.com/services/X/Y/Z',
      autoSend: true,
    });
  });

  it('returns null on corrupted JSON', () => {
    localStorage.setItem('dg_slack', 'not json');
    expect(loadSlackSettings()).toBeNull();
  });

  it('returns null when webhook field missing', () => {
    localStorage.setItem('dg_slack', JSON.stringify({ autoSend: true }));
    expect(loadSlackSettings()).toBeNull();
  });

  it('defaults autoSend to false when missing from stored blob', () => {
    localStorage.setItem('dg_slack', JSON.stringify({ webhook: 'https://hooks.slack.com/services/X' }));
    expect(loadSlackSettings()).toEqual({
      webhook: 'https://hooks.slack.com/services/X',
      autoSend: false,
    });
  });

  it('clearSlackSettings removes state', () => {
    saveSlackSettings({ webhook: 'https://hooks.slack.com/services/X', autoSend: true });
    clearSlackSettings();
    expect(loadSlackSettings()).toBeNull();
  });
});
