import { openModal } from './shared';
import { escapeHtml } from '../../utils/escapeHtml';

export function openApiKeyModal(currentKeyMasked: string): void {
  openModal({
    title: 'Gemini API 키 관리',
    bodyHtml: `
      <p>현재 키: <code>${escapeHtml(currentKeyMasked)}</code></p>
      <input type="password" id="modalApiKeyInput" autocomplete="off" />
      <div id="modalApiKeyStatus"></div>
    `,
  });
}
