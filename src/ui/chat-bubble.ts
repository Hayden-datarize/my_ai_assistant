export interface ChatPreviewBubbleOpts {
  text: string;          // Gemini 출력 raw — textContent로 안전 삽입
  primaryLabel: string;
  secondaryLabel: string;
  onPrimary: () => void;
  onSecondary: () => void;
}

export interface ChatPreviewBubbleParts {
  bubble: HTMLDivElement;
  primaryBtn: HTMLButtonElement;
  secondaryBtn: HTMLButtonElement;
}

/**
 * DOM Node만 생성 — 이벤트 wiring 없음. 호출자가 DOM 추가 + bindChatPreviewBubbleHandlers 의무.
 */
export function createChatPreviewBubble(opts: {
  text: string;
  primaryLabel: string;
  secondaryLabel: string;
}): ChatPreviewBubbleParts {
  const bubble = document.createElement('div');
  bubble.className = 'chat-message chat-message-ai chat-preview-bubble';

  const textDiv = document.createElement('div');
  textDiv.className = 'chat-preview-text';
  textDiv.textContent = opts.text;

  const actionsDiv = document.createElement('div');
  actionsDiv.className = 'chat-preview-actions';

  const primaryBtn = document.createElement('button');
  primaryBtn.type = 'button';
  primaryBtn.className = 'btn btn-primary preview-primary';
  primaryBtn.textContent = opts.primaryLabel;

  const secondaryBtn = document.createElement('button');
  secondaryBtn.type = 'button';
  secondaryBtn.className = 'btn btn-secondary preview-secondary';
  secondaryBtn.textContent = opts.secondaryLabel;

  actionsDiv.appendChild(primaryBtn);
  actionsDiv.appendChild(secondaryBtn);
  bubble.appendChild(textDiv);
  bubble.appendChild(actionsDiv);

  return { bubble, primaryBtn, secondaryBtn };
}

/**
 * 이벤트 wiring + auto-remove. createChatPreviewBubble로 만든 parts에 적용.
 */
export function bindChatPreviewBubbleHandlers(
  parts: ChatPreviewBubbleParts,
  handlers: { onPrimary: () => void; onSecondary: () => void },
): void {
  parts.primaryBtn.addEventListener('click', () => {
    handlers.onPrimary();
    parts.bubble.remove();
  });
  parts.secondaryBtn.addEventListener('click', () => {
    handlers.onSecondary();
    parts.bubble.remove();
  });
}

/**
 * Legacy wrapper — DOM 생성 + chatMessages 컨테이너에 추가 + 이벤트 wiring + scrollIntoView.
 * v3.24 T4 분리 후 보존 (caller 호환성).
 */
export function renderChatPreviewBubble(opts: ChatPreviewBubbleOpts): HTMLDivElement {
  const container = document.getElementById('chatMessages');
  if (!container) throw new Error('chatMessages container not found');

  const parts = createChatPreviewBubble(opts);
  bindChatPreviewBubbleHandlers(parts, opts);

  container.appendChild(parts.bubble);
  // jsdom에서 scrollIntoView 미구현 — optional chaining으로 안전 처리
  parts.bubble.scrollIntoView?.({ behavior: 'smooth', block: 'end' });

  return parts.bubble;
}
