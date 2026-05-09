import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  createChatPreviewBubble,
  bindChatPreviewBubbleHandlers,
  renderChatPreviewBubble,
} from '../../src/ui/chat-bubble';

beforeEach(() => {
  document.body.replaceChildren();
  const container = document.createElement('div');
  container.id = 'chatMessages';
  document.body.append(container);
});

describe('createChatPreviewBubble', () => {
  it('DOM Node 생성만 — 이벤트 등록 X', () => {
    const { bubble, primaryBtn, secondaryBtn } = createChatPreviewBubble({
      text: 'hello',
      primaryLabel: '저장',
      secondaryLabel: '취소',
    });
    expect(bubble.classList.contains('chat-preview-bubble')).toBe(true);
    expect(primaryBtn.textContent).toBe('저장');
    expect(secondaryBtn.textContent).toBe('취소');
    // 이벤트가 없으니 click해도 콜백 없음 — bubble 자동 제거 X (DOM에 추가 안 됨)
    primaryBtn.click();
    expect(bubble.isConnected).toBe(false);
  });

  it('text는 textContent로 안전 (XSS escape)', () => {
    const { bubble } = createChatPreviewBubble({
      text: '<img src=x onerror=alert(1)>',
      primaryLabel: 'A',
      secondaryLabel: 'B',
    });
    const textDiv = bubble.querySelector('.chat-preview-text');
    expect(textDiv?.textContent).toBe('<img src=x onerror=alert(1)>');
    expect(bubble.querySelectorAll('img').length).toBe(0);
  });
});

describe('bindChatPreviewBubbleHandlers', () => {
  it('primary click → onPrimary 호출 + bubble 제거', () => {
    const onPrimary = vi.fn();
    const onSecondary = vi.fn();
    const parts = createChatPreviewBubble({
      text: 't',
      primaryLabel: 'P',
      secondaryLabel: 'S',
    });
    document.getElementById('chatMessages')!.appendChild(parts.bubble);
    bindChatPreviewBubbleHandlers(parts, { onPrimary, onSecondary });
    parts.primaryBtn.click();
    expect(onPrimary).toHaveBeenCalledOnce();
    expect(onSecondary).not.toHaveBeenCalled();
    expect(parts.bubble.isConnected).toBe(false);
  });

  it('secondary click → onSecondary 호출 + bubble 제거', () => {
    const onPrimary = vi.fn();
    const onSecondary = vi.fn();
    const parts = createChatPreviewBubble({
      text: 't',
      primaryLabel: 'P',
      secondaryLabel: 'S',
    });
    document.getElementById('chatMessages')!.appendChild(parts.bubble);
    bindChatPreviewBubbleHandlers(parts, { onPrimary, onSecondary });
    parts.secondaryBtn.click();
    expect(onSecondary).toHaveBeenCalledOnce();
    expect(parts.bubble.isConnected).toBe(false);
  });
});

describe('renderChatPreviewBubble (legacy wrapper)', () => {
  it('기존 호출 형태 그대로 동작 (DOM 추가 + 이벤트 wiring)', () => {
    const onPrimary = vi.fn();
    const bubble = renderChatPreviewBubble({
      text: 't',
      primaryLabel: 'P',
      secondaryLabel: 'S',
      onPrimary,
      onSecondary: () => {},
    });
    expect(bubble.isConnected).toBe(true);
    bubble.querySelector<HTMLButtonElement>('.preview-primary')!.click();
    expect(onPrimary).toHaveBeenCalledOnce();
  });
});
