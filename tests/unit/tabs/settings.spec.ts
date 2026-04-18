import { describe, it, expect, beforeEach } from 'vitest';
import { renderSettings } from '../../../src/ui/tabs/settings';

beforeEach(() => {
  localStorage.clear();
});

describe('renderSettings', () => {
  it('mounts settings container with apiKeyStatus and slack input', () => {
    const root = document.createElement('div');
    renderSettings(root);
    expect(root.querySelector('#settingsTab')).not.toBeNull();
    expect(root.querySelector('#apiKeyStatus')).not.toBeNull();
    expect(root.querySelector('#slackWebhookInput')).not.toBeNull();
  });
  it('rejects a too-short API key', () => {
    const root = document.createElement('div');
    renderSettings(root);
    const input = root.querySelector<HTMLInputElement>('#apiKeyInput');
    const saveBtn = root.querySelector<HTMLButtonElement>('#saveApiKeyBtn');
    const status = root.querySelector<HTMLDivElement>('#apiKeyStatus');
    if (!input || !saveBtn || !status) throw new Error('elements missing');
    input.value = 'short';
    saveBtn.click();
    expect(status.textContent).toMatch(/올바르지 않/);
    expect(localStorage.getItem('dg_gemini_key')).toBeNull();
  });
  it('saves a valid API key to dg_gemini_key', () => {
    const root = document.createElement('div');
    renderSettings(root);
    const input = root.querySelector<HTMLInputElement>('#apiKeyInput');
    const saveBtn = root.querySelector<HTMLButtonElement>('#saveApiKeyBtn');
    const status = root.querySelector<HTMLDivElement>('#apiKeyStatus');
    if (!input || !saveBtn || !status) throw new Error('elements missing');
    input.value = 'AIzaSyAbcdefghijklmnopqrstuvwxyz12345678';
    saveBtn.click();
    expect(localStorage.getItem('dg_gemini_key')).toBe('AIzaSyAbcdefghijklmnopqrstuvwxyz12345678');
    expect(status.textContent).toMatch(/저장|성공/);
  });
  it('shows guidance when slack test is clicked with empty webhook', () => {
    const root = document.createElement('div');
    renderSettings(root);
    const testBtn = root.querySelector<HTMLButtonElement>('#testSlackBtn');
    const result = root.querySelector<HTMLDivElement>('#slackTestResult');
    if (!testBtn || !result) throw new Error('elements missing');
    testBtn.click();
    expect(result.textContent).toMatch(/Webhook|입력/);
  });
  it('renders no inline handler attributes', () => {
    const root = document.createElement('div');
    renderSettings(root);
    expect(root.querySelectorAll('[onclick],[oninput],[onchange],[onkeydown]').length).toBe(0);
  });
});
