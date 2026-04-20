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

describe('settings tab: slack section', () => {
  beforeEach(() => {
    localStorage.clear();
    document.body.replaceChildren();
  });

  it('renders Webhook input, test/save buttons, and <details> guide', () => {
    const container = document.createElement('div');
    document.body.append(container);
    renderSettings(container);
    expect(container.querySelector('#slackWebhookInput')).not.toBeNull();
    expect(container.querySelector('#testSlackBtn')).not.toBeNull();
    expect(container.querySelector('#saveSlackBtn')).not.toBeNull();
    expect(container.querySelector('#slackAutoToggle')).not.toBeNull();
    expect(container.querySelector('#clearSlackBtn')).not.toBeNull();
    expect(container.querySelector('#slackTestResult')).not.toBeNull();
    expect(container.querySelector('details')).not.toBeNull();
  });

  it('hydrates input + toggle + reveals toggle/clear row when settings exist', () => {
    localStorage.setItem('dg_slack', JSON.stringify({
      webhook: 'https://hooks.slack.com/services/AAA/BBB/CCC',
      autoSend: true,
    }));
    const container = document.createElement('div');
    document.body.append(container);
    renderSettings(container);
    const input = container.querySelector<HTMLInputElement>('#slackWebhookInput');
    const toggle = container.querySelector<HTMLInputElement>('#slackAutoToggle');
    const toggleRow = container.querySelector<HTMLElement>('#slackAutoRow');
    const clearBtn = container.querySelector<HTMLElement>('#clearSlackBtn');
    expect(input?.value).toBe('https://hooks.slack.com/services/AAA/BBB/CCC');
    expect(toggle?.checked).toBe(true);
    expect(toggleRow?.style.display).toBe('flex');
    expect(clearBtn?.style.display).toBe('block');
  });

  it('save rejects invalid URL format', () => {
    const container = document.createElement('div');
    document.body.append(container);
    renderSettings(container);
    const input = container.querySelector<HTMLInputElement>('#slackWebhookInput')!;
    const saveBtn = container.querySelector<HTMLButtonElement>('#saveSlackBtn')!;
    const result = container.querySelector<HTMLDivElement>('#slackTestResult')!;
    input.value = 'https://example.com/not-slack';
    saveBtn.click();
    expect(result.textContent ?? '').toMatch(/Slack Incoming Webhook URL 형식/);
    expect(localStorage.getItem('dg_slack')).toBeNull();
  });

  it('save persists valid URL with autoSend=false by default', () => {
    const container = document.createElement('div');
    document.body.append(container);
    renderSettings(container);
    const input = container.querySelector<HTMLInputElement>('#slackWebhookInput')!;
    const saveBtn = container.querySelector<HTMLButtonElement>('#saveSlackBtn')!;
    input.value = 'https://hooks.slack.com/services/A/B/C';
    saveBtn.click();
    const stored = JSON.parse(localStorage.getItem('dg_slack') ?? '{}');
    expect(stored).toEqual({ webhook: 'https://hooks.slack.com/services/A/B/C', autoSend: false });
  });

  it('clear wipes stored settings and hides toggle/clear row', () => {
    localStorage.setItem('dg_slack', JSON.stringify({ webhook: 'https://hooks.slack.com/services/X', autoSend: true }));
    const container = document.createElement('div');
    document.body.append(container);
    renderSettings(container);
    const clearBtn = container.querySelector<HTMLButtonElement>('#clearSlackBtn')!;
    clearBtn.click();
    expect(localStorage.getItem('dg_slack')).toBeNull();
    const toggleRow = container.querySelector<HTMLElement>('#slackAutoRow');
    expect(toggleRow?.style.display).toBe('none');
  });
});
