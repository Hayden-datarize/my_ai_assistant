const STORAGE_KEY_APIKEY = 'dg_gemini_key'; // legacy storage key — preserved for cutover compat

/**
 * Settings 탭 — Task 14에서는 API 키 + Slack Webhook 2개 섹션만 다룬다.
 * 프로필/알림/Notion/테마/데이터 초기화 등 legacy 설정은 Task 18에서 확장된다.
 */
export function renderSettings(container: HTMLElement): void {
  // eslint-disable-next-line no-restricted-syntax -- trusted static template, no interpolation
  container.innerHTML = `
    <div class="settings-section" id="settingsTab">
      <h2 style="margin-bottom:16px;">⚙️ 설정</h2>
      <section class="settings-group">
        <div class="settings-group-title">Gemini API 키</div>
        <input type="password" id="apiKeyInput" autocomplete="off" placeholder="AI...로 시작하는 키" style="width:100%;padding:10px;border:1px solid var(--border);border-radius:var(--radius-sm);background:var(--bg-input);color:var(--text-primary);" />
        <button type="button" id="saveApiKeyBtn" class="btn btn-primary btn-block mt-16" style="margin-top:8px;">저장</button>
        <div id="apiKeyStatus" style="margin-top:8px;font-size:0.85rem;"></div>
      </section>
      <section class="settings-group">
        <div class="settings-group-title">Slack Webhook</div>
        <input type="url" id="slackWebhookInput" placeholder="https://hooks.slack.com/services/..." style="width:100%;padding:10px;border:1px solid var(--border);border-radius:var(--radius-sm);background:var(--bg-input);color:var(--text-primary);" />
        <button type="button" id="testSlackBtn" class="btn btn-secondary btn-block" style="margin-top:8px;">테스트</button>
        <div id="slackTestResult" style="margin-top:8px;font-size:0.85rem;"></div>
      </section>
    </div>
  `;
  bindHandlers(container);
}

function bindHandlers(container: HTMLElement): void {
  const saveBtn = container.querySelector<HTMLButtonElement>('#saveApiKeyBtn');
  if (saveBtn) saveBtn.addEventListener('click', () => onSaveKey(container));

  const testBtn = container.querySelector<HTMLButtonElement>('#testSlackBtn');
  if (testBtn) testBtn.addEventListener('click', () => onTestSlack(container));
}

function onSaveKey(container: HTMLElement): void {
  const input = container.querySelector<HTMLInputElement>('#apiKeyInput');
  const status = container.querySelector<HTMLDivElement>('#apiKeyStatus');
  if (!input || !status) return;
  const key = input.value.trim();
  if (key.length < 20) {
    status.textContent = '키 형식이 올바르지 않습니다.';
    return;
  }
  try {
    localStorage.setItem(STORAGE_KEY_APIKEY, key);
    status.textContent = '저장되었습니다.';
  } catch (_e) {
    status.textContent = '저장에 실패했어요. 브라우저 저장 공간을 확인해주세요.';
  }
}

function onTestSlack(container: HTMLElement): void {
  const input = container.querySelector<HTMLInputElement>('#slackWebhookInput');
  const result = container.querySelector<HTMLDivElement>('#slackTestResult');
  if (!input || !result) return;
  const webhook = input.value.trim();
  if (!webhook) {
    result.textContent = 'Webhook URL을 입력하세요.';
    return;
  }
  result.textContent = '테스트 전송 준비 중... (Task 16에서 실제 전송 연결)';
  // Real fetch to Slack is wired up in Task 16 (services/slack.ts). This task does UI only.
}
