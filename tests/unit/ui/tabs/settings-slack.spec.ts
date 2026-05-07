import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderSettings } from '../../../../src/ui/tabs/settings';
import { saveSlackSettings, loadSlackSettings } from '../../../../src/state/slack';

// fetch is called only by the test button (sendAnswerDm). Stubbed here so neither
// passing nor failing the network is required for this UI-focused suite.
global.fetch = vi.fn();

describe('settings — Slack email section (v3.19 T6 UI rewrite)', () => {
  let container: HTMLElement;

  beforeEach(() => {
    localStorage.clear();
    document.body.replaceChildren();
    container = document.createElement('div');
    document.body.append(container);
    renderSettings(container);
  });

  it('renders email input with @datarize.ai placeholder', () => {
    const input = container.querySelector<HTMLInputElement>('#slackEmailInput');
    expect(input).toBeTruthy();
    expect(input?.type).toBe('email');
    expect(input?.placeholder).toContain('@datarize.ai');
  });

  it('rejects non-@datarize.ai email on save', () => {
    const input = container.querySelector<HTMLInputElement>('#slackEmailInput')!;
    const saveBtn = container.querySelector<HTMLButtonElement>('#saveSlackBtn')!;
    input.value = 'me@gmail.com';
    saveBtn.click();
    const result = container.querySelector<HTMLDivElement>('#slackTestResult');
    expect(result?.textContent).toMatch(/datarize\.ai/);
    expect(loadSlackSettings()).toBeNull();
  });

  it('saves valid @datarize.ai email with autoSend=false default', () => {
    const input = container.querySelector<HTMLInputElement>('#slackEmailInput')!;
    const saveBtn = container.querySelector<HTMLButtonElement>('#saveSlackBtn')!;
    input.value = 'me@datarize.ai';
    saveBtn.click();
    expect(loadSlackSettings()).toEqual({ email: 'me@datarize.ai', autoSend: false });
  });

  it('hydrates existing email + autoSend on render', () => {
    document.body.replaceChildren();
    saveSlackSettings({ email: 'a@datarize.ai', autoSend: true });
    container = document.createElement('div');
    document.body.append(container);
    renderSettings(container);
    const input = container.querySelector<HTMLInputElement>('#slackEmailInput');
    expect(input?.value).toBe('a@datarize.ai');
    const toggle = container.querySelector<HTMLInputElement>('#slackAutoToggle');
    expect(toggle?.checked).toBe(true);
  });

  it('clear button removes settings', () => {
    saveSlackSettings({ email: 'me@datarize.ai', autoSend: true });
    document.body.replaceChildren();
    container = document.createElement('div');
    document.body.append(container);
    renderSettings(container);
    container.querySelector<HTMLButtonElement>('#clearSlackBtn')!.click();
    expect(loadSlackSettings()).toBeNull();
  });
});
