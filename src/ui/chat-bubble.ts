import { escapeHtml } from '../utils/escapeHtml';

export interface ChatPreviewBubbleOpts {
  text: string;          // Gemini 출력 raw — 내부에서 escapeHtml 적용
  primaryLabel: string;
  secondaryLabel: string;
  onPrimary: () => void;
  onSecondary: () => void;
}

/**
 * chat 컨테이너 하단에 미리보기 bubble을 추가한다.
 * primary/secondary 버튼 클릭 시 callback 호출 후 bubble 자동 제거.
 */
export function renderChatPreviewBubble(opts: ChatPreviewBubbleOpts): HTMLDivElement {
  const container = document.getElementById('chatMessages');
  if (!container) throw new Error('chatMessages container not found');

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
  primaryBtn.addEventListener('click', () => {
    opts.onPrimary();
    bubble.remove();
  });

  const secondaryBtn = document.createElement('button');
  secondaryBtn.type = 'button';
  secondaryBtn.className = 'btn btn-secondary preview-secondary';
  secondaryBtn.textContent = opts.secondaryLabel;
  secondaryBtn.addEventListener('click', () => {
    opts.onSecondary();
    bubble.remove();
  });

  actionsDiv.appendChild(primaryBtn);
  actionsDiv.appendChild(secondaryBtn);
  bubble.appendChild(textDiv);
  bubble.appendChild(actionsDiv);
  container.appendChild(bubble);
  // jsdom에서 scrollIntoView 미구현 — optional chaining으로 안전 처리
  bubble.scrollIntoView?.({ behavior: 'smooth', block: 'end' });

  return bubble;
}

/**
 * XSS 방어용 escapeHtml 래퍼 — 외부에서 text를 HTML 문자열로 삽입할 경우 사용.
 * renderChatPreviewBubble 내부에서는 textContent를 사용하므로 불필요하지만,
 * 호출자가 직접 HTML을 조합할 때를 위해 re-export.
 */
export { escapeHtml };
