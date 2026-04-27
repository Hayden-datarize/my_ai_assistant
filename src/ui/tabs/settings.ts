import { loadSlackSettings, saveSlackSettings, clearSlackSettings } from '../../state/slack';
import { sendToSlack, buildAnswerBlocks } from '../../services/slack';
import { showToast, showUndoToast } from '../../utils/toast';
import { INTERESTS } from '../../utils/categories';
import { getCap, setCap, getTodayCount } from '../../state/usage';
import { clearAllTranslations } from '../../state/briefings';
import { resetToastDedup } from '../translateToast';
import { clearSessionBlock } from '../../services/translate';
import { MSG } from '../messages';
import { loadAnswers, deleteAllAnswers, saveAnswers } from '../../state/persistence';
import { getSaveErrorMessage } from '../../state/user';

const STORAGE_KEY_APIKEY = 'dg_gemini_key'; // legacy storage key — preserved for cutover compat
const USER_STORAGE = 'user';

interface StoredUser {
  interests?: string[];
}

// Module-level tracking: the most recently rendered settings container.
// Used by the one-time dg:interests:changed listener below to avoid
// accumulating listeners each time the settings tab re-renders (P1-1 fix).
let currentSettingsContainer: HTMLElement | null = null;

// One-time listener registration at module load. If the settings tab
// is re-rendered N times, this listener is still only registered once —
// it always targets the latest container via `currentSettingsContainer`.
document.addEventListener('dg:interests:changed', () => {
  if (currentSettingsContainer) {
    renderCurrentInterests(currentSettingsContainer);
  }
});

export function renderSettings(container: HTMLElement): void {
  // eslint-disable-next-line no-restricted-syntax -- trusted static template, no interpolation
  container.innerHTML = `
    <div class="settings-section" id="settingsTab">
      <h2 style="margin-bottom:16px;">⚙️ 설정</h2>
      <section class="settings-group">
        <div class="settings-group-title">관심 분야</div>
        <div id="currentInterests" class="settings-interests-display"></div>
        <button type="button" id="editInterestsBtn" class="btn btn-outline btn-block" style="margin-top:8px;">수정</button>
      </section>
      <section class="settings-group">
        <div class="settings-group-title">Gemini API 키</div>
        <input type="password" id="apiKeyInput" autocomplete="off" placeholder="AI...로 시작하는 키" style="width:100%;padding:10px;border:1px solid var(--border);border-radius:var(--radius-sm);background:var(--bg-input);color:var(--text-primary);" />
        <button type="button" id="saveApiKeyBtn" class="btn btn-primary btn-block mt-16" style="margin-top:8px;">저장</button>
        <div id="apiKeyStatus" style="margin-top:8px;font-size:0.85rem;"></div>
      </section>
      <section class="settings-group" data-testid="translate-settings">
        <div class="settings-group-title">Gemini 번역</div>
        <label for="translateCap" style="display:block;font-size:0.9rem;margin-bottom:6px;">일일 번역 한도: <span id="translateCapValue" aria-live="polite" style="font-weight:600;"></span></label>
        <input type="range" id="translateCap" min="30" max="500" step="10" style="width:100%;" />
        <div style="font-size:0.85rem;color:var(--text-secondary);margin-top:8px;">오늘 사용량: <span id="translateUsageDisplay" aria-live="polite">0</span>건</div>
        <button type="button" id="clearTranslationCacheBtn" class="btn btn-secondary btn-block" style="margin-top:12px;">번역 캐시 초기화</button>
      </section>
      <section class="settings-group">
        <div class="settings-group-title">Slack Webhook</div>
        <input type="url" id="slackWebhookInput" placeholder="https://hooks.slack.com/services/..." style="width:100%;padding:10px;border:1px solid var(--border);border-radius:var(--radius-sm);background:var(--bg-input);color:var(--text-primary);" />
        <div style="display:flex;gap:8px;margin-top:8px;">
          <button type="button" id="testSlackBtn" class="btn btn-secondary" style="flex:1;">🔗 테스트</button>
          <button type="button" id="saveSlackBtn" class="btn btn-primary" style="flex:1;">💾 저장</button>
        </div>
        <div id="slackAutoRow" style="display:none;align-items:center;justify-content:space-between;margin-top:12px;">
          <label for="slackAutoToggle" style="font-size:0.9rem;">답변 제출 시 자동 전송</label>
          <input type="checkbox" id="slackAutoToggle" />
        </div>
        <button type="button" id="clearSlackBtn" class="btn btn-secondary" style="display:none;margin-top:8px;width:100%;">🗑️ 연결 해제</button>
        <div id="slackTestResult" style="margin-top:8px;font-size:0.85rem;"></div>
        <details style="margin-top:12px;">
          <summary style="cursor:pointer;font-size:0.9rem;">Webhook URL 만들기</summary>
          <ol style="font-size:0.85rem;margin-top:8px;line-height:1.6;padding-left:20px;">
            <li><a href="https://api.slack.com/apps" target="_blank" rel="noopener">Slack API</a>에서 "Create New App" → "From scratch"</li>
            <li>Features → Incoming Webhooks 활성화</li>
            <li>"Add New Webhook to Workspace" → 채널 선택</li>
            <li>생성된 Webhook URL을 위 입력란에 붙여넣기</li>
            <li>"💾 저장" 버튼 클릭</li>
          </ol>
          <p style="font-size:0.8rem;color:var(--text-secondary);margin-top:8px;">※ 이 Webhook URL은 이 브라우저에만 저장됩니다.</p>
        </details>
      </section>
      <section class="settings-group">
        <div class="settings-group-title">데이터 삭제</div>
        <p class="settings-help" style="font-size:0.85rem;color:var(--text-secondary);margin-bottom:12px;">archive 답변을 모두 삭제해요. 삭제 후 5초 안에 되돌릴 수 있어요.</p>
        <button id="deleteAllAnswersBtn" type="button" class="btn btn-secondary btn-block" disabled>
          전체 답변 초기화
        </button>
      </section>
    </div>
  `;
  // Track this container before bindHandlers so it can be used via currentSettingsContainer.
  currentSettingsContainer = container;
  bindHandlers();
  bindSlackHandlers(container);
  bindInterestsHandlers(container);
  wireTranslateSection(container);
}

function wireTranslateSection(container: HTMLElement): void {
  const slider = container.querySelector<HTMLInputElement>('#translateCap');
  const capValue = container.querySelector<HTMLSpanElement>('#translateCapValue');
  const usageEl = container.querySelector<HTMLSpanElement>('#translateUsageDisplay');
  const clearBtn = container.querySelector<HTMLButtonElement>('#clearTranslationCacheBtn');
  if (!slider || !capValue || !usageEl || !clearBtn) return;

  const refresh = (): void => {
    const cap = getCap();
    slider.value = String(cap);
    capValue.textContent = `${cap}건/일`;
    usageEl.textContent = String(getTodayCount());
  };

  slider.addEventListener('input', () => {
    setCap(Number(slider.value));
    refresh();
  });

  clearBtn.addEventListener('click', () => {
    if (!confirm('번역 캐시를 모두 삭제할까요? (브리핑 본문은 유지됩니다)')) return;
    clearAllTranslations();
    showToast('번역 캐시를 초기화했어요.');
  });

  refresh();
}

export function bindHandlers(): void {
  const container = currentSettingsContainer;
  if (!container) return;

  const saveBtn = container.querySelector<HTMLButtonElement>('#saveApiKeyBtn');
  if (saveBtn) saveBtn.addEventListener('click', () => onSaveKey(container));

  const deleteAllBtn = container.querySelector<HTMLButtonElement>('#deleteAllAnswersBtn');
  if (deleteAllBtn) {
    const refresh = () => {
      deleteAllBtn.disabled = loadAnswers().length === 0;
    };
    refresh();

    deleteAllBtn.addEventListener('click', () => {
      const n = loadAnswers().length;
      if (n === 0) return;
      if (!window.confirm(MSG.DELETE_CONFIRM_ALL(n))) return;
      const snapshot = loadAnswers();
      try {
        deleteAllAnswers();
      } catch (err) {
        showToast(getSaveErrorMessage(err));
        return;
      }
      refresh();
      showUndoToast({
        message: MSG.DELETE_UNDO_TOAST,
        actionLabel: MSG.DELETE_UNDO_ACTION,
        onUndo: () => {
          try {
            saveAnswers([...snapshot, ...loadAnswers()]);
            refresh();
            showToast(MSG.DELETE_UNDO_RESTORED);
          } catch (_err) {
            showToast(MSG.DELETE_UNDO_FAILED);
          }
        },
      });
    });
  }
}

function renderCurrentInterests(container: HTMLElement): void {
  const display = container.querySelector<HTMLDivElement>('#currentInterests');
  if (!display) return;
  display.replaceChildren();

  let interests: string[] = [];
  try {
    const raw = localStorage.getItem(USER_STORAGE);
    const user = raw ? (JSON.parse(raw) as StoredUser) : null;
    interests = user?.interests ?? [];
  } catch {
    interests = [];
  }

  if (interests.length === 0) {
    display.textContent = '선택된 관심 분야가 없어요.';
    return;
  }

  for (const id of interests) {
    const chip = document.createElement('span');
    chip.className = 'interest-chip';
    const meta = INTERESTS.find((c) => c.id === id);
    chip.textContent = meta?.label ?? id;
    display.append(chip);
  }
}

function bindInterestsHandlers(container: HTMLElement): void {
  const editBtn = container.querySelector<HTMLButtonElement>('#editInterestsBtn');
  editBtn?.addEventListener('click', () => {
    void import('../modals/interests').then(({ openInterestsModal }) => {
      openInterestsModal();
    });
  });

  // Note: the dg:interests:changed listener is registered ONCE at module
  // load (see top of this file). It reads `currentSettingsContainer`, so
  // re-renders do not accumulate listeners.
  renderCurrentInterests(container);
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
    status.textContent = MSG.SAVE_SUCCESS;
    // 새 키 저장 직후: 이전 401로 인한 세션 차단과 토스트 dedup 메모리를 모두 reset.
    // 사용자가 키를 고친 즉시 번역이 재개되고 새 에러는 다시 알려지도록.
    resetToastDedup();
    clearSessionBlock();
  } catch (_e) {
    status.textContent = '저장에 실패했어요. 브라우저 저장 공간을 확인해주세요.';
  }
}

function isValidWebhookUrl(url: string): boolean {
  return url.startsWith('https://hooks.slack.com/services/');
}

function bindSlackHandlers(container: HTMLElement): void {
  const input = container.querySelector<HTMLInputElement>('#slackWebhookInput');
  const testBtn = container.querySelector<HTMLButtonElement>('#testSlackBtn');
  const saveBtn = container.querySelector<HTMLButtonElement>('#saveSlackBtn');
  const toggle = container.querySelector<HTMLInputElement>('#slackAutoToggle');
  const toggleRow = container.querySelector<HTMLElement>('#slackAutoRow');
  const clearBtn = container.querySelector<HTMLButtonElement>('#clearSlackBtn');
  const result = container.querySelector<HTMLDivElement>('#slackTestResult');
  if (!input || !testBtn || !saveBtn || !toggle || !toggleRow || !clearBtn || !result) return;

  // Hydrate from storage
  const existing = loadSlackSettings();
  if (existing) {
    input.value = existing.webhook;
    toggle.checked = existing.autoSend;
    toggleRow.style.display = 'flex';
    clearBtn.style.display = 'block';
  }

  const setResult = (text: string, kind: 'info' | 'ok' | 'err' = 'info'): void => {
    result.textContent = text;
    result.style.color = kind === 'ok' ? 'var(--accent, #059669)' : kind === 'err' ? 'var(--danger, #dc2626)' : '';
  };

  testBtn.addEventListener('click', () => {
    void (async () => {
      const webhook = input.value.trim();
      if (!webhook) { setResult('Webhook URL을 입력하세요.'); return; }
      if (!isValidWebhookUrl(webhook)) { setResult('Slack Incoming Webhook URL 형식이 아닙니다.', 'err'); return; }
      setResult('전송 중…');
      try {
        await sendToSlack(webhook, buildAnswerBlocks({
          question: '샘플 — Daily Growth Slack 연결 테스트',
          answer: '이 메시지가 보이면 연결이 정상입니다.',
        }));
        setResult('✅ 전송 성공', 'ok');
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        setResult(`❌ 전송 실패 — ${msg}`, 'err');
      }
    })();
  });

  saveBtn.addEventListener('click', () => {
    const webhook = input.value.trim();
    if (!webhook) { showToast('Webhook URL을 입력하세요'); return; }
    if (!isValidWebhookUrl(webhook)) { setResult('Slack Incoming Webhook URL 형식이 아닙니다.', 'err'); return; }
    const prev = loadSlackSettings();
    const nextAutoSend = prev?.autoSend ?? false;
    try {
      saveSlackSettings({ webhook, autoSend: nextAutoSend });
    } catch (_e) {
      setResult('저장 실패 — 브라우저 저장 공간을 확인해주세요.', 'err');
      return;
    }
    toggle.checked = nextAutoSend;
    toggleRow.style.display = 'flex';
    clearBtn.style.display = 'block';
    setResult('');
    showToast(`✅ Slack Webhook ${MSG.SAVE_SUCCESS}`);
  });

  toggle.addEventListener('change', () => {
    const current = loadSlackSettings();
    if (!current) {
      toggle.checked = false;
      showToast('먼저 Webhook URL을 저장하세요');
      return;
    }
    saveSlackSettings({ webhook: current.webhook, autoSend: toggle.checked });
    showToast(toggle.checked ? '✅ 자동 전송 켜짐' : '🔕 자동 전송 꺼짐');
  });

  clearBtn.addEventListener('click', () => {
    clearSlackSettings();
    input.value = '';
    toggle.checked = false;
    toggleRow.style.display = 'none';
    clearBtn.style.display = 'none';
    setResult('');
    showToast('🗑️ Slack 연결 해제됨');
  });
}
