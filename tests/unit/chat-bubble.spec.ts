import { describe, it, expect, beforeEach, vi } from 'vitest';
import { switchTab } from '../../src/ui/nav';

vi.mock('../../src/ui/nav', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../src/ui/nav')>();
  return {
    ...actual,
    switchTab: vi.fn(),
  };
});

describe('addBubble (home handler)', () => {
  beforeEach(() => {
    document.body.replaceChildren();
    const msgs = document.createElement('div');
    msgs.id = 'chatMessages';
    document.body.append(msgs);
  });

  it('renders plain text bubble without action', async () => {
    const { addBubble } = await import('../../src/ui/handlers/home');
    addBubble('user', '안녕');
    const bubble = document.querySelector('.chat-bubble');
    expect(bubble?.classList.contains('chat-user')).toBe(true);
    expect(bubble?.textContent).toBe('안녕');
    expect(bubble?.querySelector('.chat-bubble-action')).toBeNull();
  });

  it('renders action button when provided and wires onClick', async () => {
    const { addBubble } = await import('../../src/ui/handlers/home');
    const onClick = vi.fn();
    addBubble('ai', 'API 키를 등록해 주세요.', { label: '⚙ 설정 열기', onClick });
    const action = document.querySelector<HTMLButtonElement>('.chat-bubble-action');
    expect(action?.textContent).toBe('⚙ 설정 열기');
    expect(action?.type).toBe('button');
    action?.click();
    expect(onClick).toHaveBeenCalledOnce();
  });

  it('uses textContent for text (no script injection)', async () => {
    const { addBubble } = await import('../../src/ui/handlers/home');
    addBubble('ai', '<script>alert(1)</script>');
    const bubble = document.querySelector('.chat-bubble');
    expect(bubble?.querySelector('script')).toBeNull();
    expect(bubble?.textContent).toBe('<script>alert(1)</script>');
  });

  it('uses textContent for action label (no HTML injection)', async () => {
    const { addBubble } = await import('../../src/ui/handlers/home');
    addBubble('ai', 'msg', { label: '<b>bold</b>', onClick: () => {} });
    const action = document.querySelector('.chat-bubble-action');
    expect(action?.querySelector('b')).toBeNull();
    expect(action?.textContent).toBe('<b>bold</b>');
  });

  it('bubble role="user" adds chat-user class; "ai" adds chat-ai', async () => {
    const { addBubble } = await import('../../src/ui/handlers/home');
    addBubble('user', 'u');
    addBubble('ai', 'a');
    const bubbles = document.querySelectorAll('.chat-bubble');
    expect(bubbles[0]?.classList.contains('chat-user')).toBe(true);
    expect(bubbles[1]?.classList.contains('chat-ai')).toBe(true);
  });
});

describe('openSettingsWithFocus', () => {
  beforeEach(() => {
    document.body.replaceChildren();
    const nav = document.createElement('nav');
    const home = document.createElement('button');
    home.className = 'nav-item active';
    home.dataset['tabId'] = 'home';
    const settings = document.createElement('button');
    settings.className = 'nav-item';
    settings.dataset['tabId'] = 'settings';
    nav.append(home, settings);
    document.body.append(nav);

    const app = document.createElement('div');
    app.id = 'app';
    document.body.append(app);

    vi.clearAllMocks();
  });

  it('calls switchTab("settings") when not already on settings', async () => {
    const { openSettingsWithFocus } = await import('../../src/ui/handlers/home');
    openSettingsWithFocus();
    expect(switchTab).toHaveBeenCalledWith('settings');
  });

  it('does NOT call switchTab when already on settings', async () => {
    document.querySelector('.nav-item.active')?.classList.remove('active');
    document.querySelector('[data-tab-id="settings"]')?.classList.add('active');

    const { openSettingsWithFocus } = await import('../../src/ui/handlers/home');
    openSettingsWithFocus();
    expect(switchTab).not.toHaveBeenCalled();
  });
});
