export type LangState = 'en' | 'ko';

export interface LangToggleOptions {
  initialState: LangState;
  onToggle: (next: LangState) => void;
  disabled?: boolean;
  disabledReason?: string;
}

export interface LangToggleEl extends HTMLButtonElement {
  setLangState(next: LangState): void;
}

const LABELS: Record<LangState, string> = {
  en: '🌐 한글로 보기',
  ko: '🌐 영문으로 보기',
};

const ARIA: Record<LangState, string> = {
  en: '한글로 보기',
  ko: '영문으로 보기',
};

export function createLangToggle(opts: LangToggleOptions): LangToggleEl {
  const btn = document.createElement('button') as LangToggleEl;
  btn.type = 'button';
  btn.className = 'card-lang-toggle';
  let state: LangState = opts.initialState;

  const render = (): void => {
    btn.textContent = LABELS[state];
    btn.setAttribute('aria-label', ARIA[state]);
  };

  if (opts.disabled) {
    btn.disabled = true;
    btn.setAttribute('aria-disabled', 'true');
    if (opts.disabledReason) btn.title = opts.disabledReason;
  }

  btn.addEventListener('click', (ev) => {
    ev.stopPropagation();
    if (btn.disabled) return;
    state = state === 'en' ? 'ko' : 'en';
    render();
    opts.onToggle(state);
  });

  btn.setLangState = (next: LangState): void => {
    state = next;
    render();
  };

  render();
  return btn;
}
