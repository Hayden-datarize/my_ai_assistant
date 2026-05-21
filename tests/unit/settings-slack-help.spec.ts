import { describe, it, expect, beforeEach } from 'vitest';

describe('settings — Slack 도움말 UX copy (v3.45 T2)', () => {
  beforeEach(() => {
    document.body.replaceChildren();
    const container = document.createElement('div');
    container.id = 'settings';
    document.body.append(container);
    localStorage.clear();
  });

  it('Slack 연동 section에 <details class="slack-help"> 노출', async () => {
    const { renderSettings } = await import('../../src/ui/tabs/settings');
    const container = document.querySelector<HTMLDivElement>('#settings')!;
    renderSettings(container);
    const help = container.querySelector('.slack-help');
    expect(help).not.toBeNull();
    expect(help?.tagName.toLowerCase()).toBe('details');
  });

  it('<details class="slack-help">에 도움말 4단계 항목 포함', async () => {
    const { renderSettings } = await import('../../src/ui/tabs/settings');
    const container = document.querySelector<HTMLDivElement>('#settings')!;
    renderSettings(container);
    const items = container.querySelectorAll('.slack-help ol li');
    expect(items.length).toBe(4);
    expect(items[0]?.textContent).toContain('워크스페이스');
    expect(items[3]?.textContent).toContain('HR');
  });
});
