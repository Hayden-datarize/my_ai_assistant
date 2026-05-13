/**
 * First-run onboarding: interests (2+) → Gemini API key → done.
 * Renders into the same #app container as tabs. Saves to localStorage key `user`
 * (legacy shape) and `dg_gemini_key` (legacy key) to preserve v2.0 compat.
 * On completion, dispatches DOMContentLoaded-style `dg:onboarded` so main.ts
 * can re-boot into the main app.
 */

import { INTERESTS } from '../utils/categories';
import { escapeHtml } from '../utils/escapeHtml';
import { generateText } from '../services/gemini';
import { getKstDateStr } from '../utils/dates';

const STORAGE_KEY_APIKEY = 'dg_gemini_key';
const STORAGE_KEY_USER = 'user';

/**
 * Derive the user's display name from raw onboarding input.
 *
 * @internal Exported for vitest unit testing only (v3.18.1 H3).
 *           Empty/whitespace input falls back to '사용자' (generic) —
 *           prevents 'Hayden' leak across users (P1 개인정보 leak fix).
 */
export function deriveOnboardingName(raw: string): string {
  return raw.trim() || '사용자';
}

interface OnboardingState {
  step: 1 | 2 | 3;
  picked: Set<string>;
  name: string;
  apiKey: string;
  apiKeyValid: boolean;
}

export function renderOnboarding(container: HTMLElement): void {
  const state: OnboardingState = {
    step: 1,
    picked: new Set(),
    name: '',
    apiKey: '',
    apiKeyValid: false,
  };
  render(container, state);
}

function render(container: HTMLElement, state: OnboardingState): void {
  container.replaceChildren();
  const wrap = document.createElement('section');
  wrap.id = 'onboarding';
  wrap.className = 'onboarding';

  const title = document.createElement('h1');
  title.textContent = '🌱 Daily Growth 시작하기';
  wrap.append(title);

  const steps = document.createElement('div');
  steps.className = 'onboarding-steps';
  steps.textContent = `단계 ${state.step} / 3`;
  wrap.append(steps);

  if (state.step === 1) renderStep1(wrap, state, container);
  else if (state.step === 2) renderStep2(wrap, state, container);
  else renderStep3(wrap, state, container);

  container.append(wrap);
}

function renderStep1(wrap: HTMLElement, state: OnboardingState, container: HTMLElement): void {
  const h = document.createElement('h2');
  h.textContent = '어떤 분야로 성장하고 싶으세요? (2개 이상 선택)';
  wrap.append(h);

  const grid = document.createElement('div');
  grid.className = 'onboarding-grid';
  for (const i of INTERESTS) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'onboarding-chip' + (state.picked.has(i.id) ? ' selected' : '');
    btn.dataset['id'] = i.id;
    btn.textContent = i.label;
    btn.addEventListener('click', () => {
      if (state.picked.has(i.id)) state.picked.delete(i.id);
      else state.picked.add(i.id);
      btn.classList.toggle('selected');
      updateNext();
    });
    grid.append(btn);
  }
  wrap.append(grid);

  const nameLabel = document.createElement('label');
  nameLabel.textContent = '이름 (생략 가능)';
  nameLabel.htmlFor = 'obName';
  wrap.append(nameLabel);

  const nameInput = document.createElement('input');
  nameInput.id = 'obName';
  nameInput.type = 'text';
  nameInput.placeholder = '이름을 입력하세요';
  nameInput.value = state.name;
  nameInput.addEventListener('input', () => { state.name = nameInput.value; });
  wrap.append(nameInput);

  const next = document.createElement('button');
  next.id = 'obNextBtn';
  next.type = 'button';
  next.className = 'btn btn-primary btn-block';
  next.textContent = '다음';
  next.disabled = state.picked.size < 2;
  next.addEventListener('click', () => {
    state.step = 2;
    render(container, state);
  });
  wrap.append(next);

  function updateNext(): void { next.disabled = state.picked.size < 2; }
}

function renderStep2(wrap: HTMLElement, state: OnboardingState, container: HTMLElement): void {
  const h = document.createElement('h2');
  h.textContent = 'Gemini API 키를 입력해 주세요';
  wrap.append(h);

  const help = document.createElement('p');
  help.className = 'onboarding-help';
  help.textContent = '키가 없다면 아래 안내에 따라 무료로 발급할 수 있어요. AI... 로 시작합니다.';
  wrap.append(help);

  // v3.20 H1 (F1): API 키 발급 안내 details (settings.ts:50-58 패턴 차용)
  const details = document.createElement('details');
  details.className = 'onboarding-help-details';
  const summary = document.createElement('summary');
  summary.textContent = 'API 키 발급 받기';
  details.append(summary);
  const ol = document.createElement('ol');
  const li1 = document.createElement('li');
  const link = document.createElement('a');
  link.href = 'https://aistudio.google.com/app/apikey';
  link.target = '_blank';
  link.rel = 'noopener noreferrer';
  link.textContent = 'Google AI Studio';
  li1.append(link, ' 접속 (Google 계정 로그인 필요)');
  const li2 = document.createElement('li');
  const strong = document.createElement('strong');
  strong.textContent = 'Create API key';
  li2.append(strong, ' 클릭');
  const li3 = document.createElement('li');
  li3.textContent = '발급된 키를 복사해서 위에 붙여넣기';
  ol.append(li1, li2, li3);
  details.append(ol);
  const note = document.createElement('p');
  note.className = 'onboarding-help-note';
  note.textContent = '※ API 키는 이 브라우저에만 저장됩니다. Gemini 무료 한도 (분당 60회 요청) 내에서 사용 가능합니다.';
  details.append(note);
  wrap.append(details);

  const input = document.createElement('input');
  input.id = 'obApiKeyInput';
  input.type = 'password';
  input.autocomplete = 'off';
  input.placeholder = 'AIza...';
  input.value = state.apiKey;
  input.addEventListener('input', () => {
    state.apiKey = input.value.trim();
    state.apiKeyValid = false;
    status.textContent = '';
    next.disabled = true;
  });
  wrap.append(input);

  const test = document.createElement('button');
  test.id = 'obKeyTestBtn';
  test.type = 'button';
  test.className = 'btn btn-secondary btn-block';
  test.textContent = '키 테스트';
  test.addEventListener('click', () => void runTest());
  wrap.append(test);

  const status = document.createElement('div');
  status.id = 'obKeyStatus';
  status.className = 'onboarding-status';
  wrap.append(status);

  const row = document.createElement('div');
  row.className = 'onboarding-nav-row';

  const back = document.createElement('button');
  back.type = 'button';
  back.className = 'btn';
  back.textContent = '이전';
  back.addEventListener('click', () => { state.step = 1; render(container, state); });
  row.append(back);

  const next = document.createElement('button');
  next.id = 'obCompleteBtn';
  next.type = 'button';
  next.className = 'btn btn-primary';
  next.textContent = '완료';
  next.disabled = !state.apiKeyValid;
  next.addEventListener('click', () => {
    state.step = 3;
    render(container, state);
  });
  row.append(next);
  wrap.append(row);

  async function runTest(): Promise<void> {
    if (!state.apiKey) { status.textContent = '키를 입력하세요'; return; }
    status.textContent = '키 확인 중…';
    try {
      await generateText({ apiKey: state.apiKey, prompt: 'ping' });
      state.apiKeyValid = true;
      status.textContent = '✅ 유효한 키입니다';
      try { localStorage.setItem(STORAGE_KEY_APIKEY, state.apiKey); } catch { /* ignore */ }
      next.disabled = false;
    } catch (e) {
      state.apiKeyValid = false;
      const msg = e instanceof Error ? e.message : String(e);
      status.textContent = `❌ 키 확인 실패: ${escapeHtml(msg)}`;
      next.disabled = true;
    }
  }
}

function renderStep3(wrap: HTMLElement, state: OnboardingState, container: HTMLElement): void {
  // v3.12 T2 review P2-1: v2 shape 직접 사용 (lazy migrate intermediate write 회피).
  // fresh user는 answers 0개 → T13 invariant `answers >= 1` 자연 통과 → gamificationMigrated=true 안전.
  const today = getKstDateStr();
  const user = {
    name: deriveOnboardingName(state.name),
    interests: [...state.picked],
    onboardedAt: today,
    streak: 0,
    lastActiveDate: '',
    xp: 0,
    earnedBadges: {} as Record<string, number>,
    gamificationMigrated: true,
    schemaVersion: 2 as const,
  };
  try { localStorage.setItem(STORAGE_KEY_USER, JSON.stringify(user)); } catch { /* ignore */ }

  const h = document.createElement('h2');
  h.textContent = '🎉 준비 완료!';
  wrap.append(h);

  const p = document.createElement('p');
  p.textContent = `${user.name}님, 오늘부터 하루 한 질문으로 성장 기록을 시작해 봐요.`;
  wrap.append(p);

  const enter = document.createElement('button');
  enter.id = 'obEnterAppBtn';
  enter.type = 'button';
  enter.className = 'btn btn-primary btn-block';
  enter.textContent = '시작하기';
  enter.addEventListener('click', () => {
    document.dispatchEvent(new CustomEvent('dg:onboarded'));
  });
  wrap.append(enter);
  // Auto-focus for keyboard users
  setTimeout(() => enter.focus(), 50);
  void container; // container already holds wrap
}
