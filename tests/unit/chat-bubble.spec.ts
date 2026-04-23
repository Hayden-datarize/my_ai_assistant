import { describe, it, expect, beforeEach, vi } from 'vitest';

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
