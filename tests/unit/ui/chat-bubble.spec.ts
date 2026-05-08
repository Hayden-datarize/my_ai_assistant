import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderChatPreviewBubble } from '../../../src/ui/chat-bubble';

beforeEach(() => {
  // eslint-disable-next-line no-restricted-syntax -- jsdom DOM seed; static template, no user interpolation
  document.body.innerHTML = '<div id="chatMessages"></div>';
});

describe('renderChatPreviewBubble', () => {
  it('text + 2 버튼 (primary/secondary) 렌더', () => {
    renderChatPreviewBubble({
      text: '오늘 발표 망쳤지만 배웠다',
      primaryLabel: '저장',
      secondaryLabel: '폐기',
      onPrimary: () => {},
      onSecondary: () => {},
    });
    const bubble = document.querySelector('.chat-preview-bubble');
    expect(bubble?.textContent).toContain('오늘 발표');
    expect(bubble?.querySelector('button.preview-primary')?.textContent).toBe('저장');
    expect(bubble?.querySelector('button.preview-secondary')?.textContent).toBe('폐기');
  });

  it('primary 클릭 → onPrimary callback + bubble 제거', () => {
    const onPrimary = vi.fn();
    renderChatPreviewBubble({
      text: 't', primaryLabel: 'p', secondaryLabel: 's',
      onPrimary, onSecondary: () => {},
    });
    (document.querySelector('button.preview-primary') as HTMLButtonElement).click();
    expect(onPrimary).toHaveBeenCalledTimes(1);
    expect(document.querySelector('.chat-preview-bubble')).toBeNull();
  });

  it('secondary 클릭 → onSecondary callback + bubble 제거', () => {
    const onSecondary = vi.fn();
    renderChatPreviewBubble({
      text: 't', primaryLabel: 'p', secondaryLabel: 's',
      onPrimary: () => {}, onSecondary,
    });
    (document.querySelector('button.preview-secondary') as HTMLButtonElement).click();
    expect(onSecondary).toHaveBeenCalledTimes(1);
    expect(document.querySelector('.chat-preview-bubble')).toBeNull();
  });

  it('XSS 방어: <script> 텍스트 삽입 시 script 요소 미생성', () => {
    renderChatPreviewBubble({
      text: '<script>alert(1)</script>안녕',
      primaryLabel: 'p', secondaryLabel: 's',
      onPrimary: () => {}, onSecondary: () => {},
    });
    const bubble = document.querySelector('.chat-preview-bubble');
    // textContent 기반이므로 <script> 요소가 DOM에 삽입되지 않음
    expect(bubble?.querySelector('script')).toBeNull();
    // 텍스트는 raw 형태로 textContent에 포함됨
    expect(bubble?.textContent).toContain('<script>');
  });

  it('container 없으면 throw', () => {
    // eslint-disable-next-line no-restricted-syntax -- jsdom DOM reset; static empty string, no user interpolation
    document.body.innerHTML = '';
    expect(() =>
      renderChatPreviewBubble({
        text: 't', primaryLabel: 'p', secondaryLabel: 's',
        onPrimary: () => {}, onSecondary: () => {},
      }),
    ).toThrow('chatMessages container not found');
  });
});
