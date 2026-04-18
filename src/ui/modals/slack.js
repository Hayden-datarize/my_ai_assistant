import { openModal } from './shared';
export function openSlackModal() {
    openModal({
        title: 'Slack 연동',
        bodyHtml: `
      <input type="url" id="modalSlackWebhook" placeholder="https://hooks.slack.com/..." />
      <button type="button" id="modalSlackTestBtn">테스트</button>
      <div id="modalSlackResult"></div>
    `,
    });
}
