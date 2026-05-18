// v3.38 T1a: ESLint v8 flat config (legacy `.eslintrc.cjs` → `eslint.config.mjs` 마이그레이션)
// 기존 동작 1:1 보존:
//   - eslint:recommended + @typescript-eslint/recommended
//   - 5 no-restricted-syntax selector (innerHTML / outerHTML / insertAdjacentHTML)
//   - no-restricted-imports getDateStr deprecated (overrides: src/utils/dates.ts + tests/unit/dates.spec.ts)
//   - @typescript-eslint/no-explicit-any: warn
//   - ignores: dist/**, node_modules/**, daily-growth.html
//
// T1b 신규 local rule (nfc-template-literal) 인라인 등록 사전 작업.

import js from '@eslint/js';
import tsParser from '@typescript-eslint/parser';
import tsPlugin from '@typescript-eslint/eslint-plugin';

export default [
  {
    ignores: ['dist/**', 'node_modules/**', 'daily-growth.html'],
  },
  {
    files: ['src/**/*.ts', 'tests/**/*.ts'],
    languageOptions: {
      parser: tsParser,
      ecmaVersion: 2020,
      sourceType: 'module',
      globals: {
        // browser
        window: 'readonly',
        document: 'readonly',
        localStorage: 'readonly',
        sessionStorage: 'readonly',
        navigator: 'readonly',
        location: 'readonly',
        history: 'readonly',
        fetch: 'readonly',
        Request: 'readonly',
        Response: 'readonly',
        Headers: 'readonly',
        URL: 'readonly',
        URLSearchParams: 'readonly',
        AbortController: 'readonly',
        AbortSignal: 'readonly',
        Event: 'readonly',
        CustomEvent: 'readonly',
        EventTarget: 'readonly',
        MessageEvent: 'readonly',
        HTMLElement: 'readonly',
        HTMLInputElement: 'readonly',
        HTMLButtonElement: 'readonly',
        HTMLSelectElement: 'readonly',
        HTMLTextAreaElement: 'readonly',
        HTMLFormElement: 'readonly',
        HTMLAnchorElement: 'readonly',
        HTMLImageElement: 'readonly',
        HTMLDivElement: 'readonly',
        HTMLSpanElement: 'readonly',
        HTMLDialogElement: 'readonly',
        HTMLTemplateElement: 'readonly',
        Element: 'readonly',
        Node: 'readonly',
        NodeList: 'readonly',
        NodeFilter: 'readonly',
        Text: 'readonly',
        DocumentFragment: 'readonly',
        ShadowRoot: 'readonly',
        MutationObserver: 'readonly',
        IntersectionObserver: 'readonly',
        ResizeObserver: 'readonly',
        PerformanceObserver: 'readonly',
        FocusEvent: 'readonly',
        KeyboardEvent: 'readonly',
        MouseEvent: 'readonly',
        PointerEvent: 'readonly',
        TouchEvent: 'readonly',
        SubmitEvent: 'readonly',
        DragEvent: 'readonly',
        InputEvent: 'readonly',
        BeforeUnloadEvent: 'readonly',
        FormData: 'readonly',
        FileReader: 'readonly',
        File: 'readonly',
        Blob: 'readonly',
        ImageData: 'readonly',
        ServiceWorker: 'readonly',
        ServiceWorkerContainer: 'readonly',
        ServiceWorkerRegistration: 'readonly',
        Notification: 'readonly',
        BroadcastChannel: 'readonly',
        MessageChannel: 'readonly',
        Storage: 'readonly',
        DOMException: 'readonly',
        DOMParser: 'readonly',
        RequestInit: 'readonly',
        EventListener: 'readonly',
        EventListenerOptions: 'readonly',
        AddEventListenerOptions: 'readonly',
        FocusOptions: 'readonly',
        ParentNode: 'readonly',
        SecurityPolicyViolationEvent: 'readonly',
        HTMLHeadingElement: 'readonly',
        SVGSVGElement: 'readonly',
        SVGElementTagNameMap: 'readonly',
        confirm: 'readonly',
        alert: 'readonly',
        prompt: 'readonly',
        getComputedStyle: 'readonly',
        // timers
        console: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
        setInterval: 'readonly',
        clearInterval: 'readonly',
        requestAnimationFrame: 'readonly',
        cancelAnimationFrame: 'readonly',
        requestIdleCallback: 'readonly',
        cancelIdleCallback: 'readonly',
        queueMicrotask: 'readonly',
        // platform
        crypto: 'readonly',
        Intl: 'readonly',
        performance: 'readonly',
        // node
        process: 'readonly',
        Buffer: 'readonly',
        __dirname: 'readonly',
        __filename: 'readonly',
        global: 'readonly',
        globalThis: 'readonly',
      },
    },
    plugins: {
      '@typescript-eslint': tsPlugin,
    },
    rules: {
      ...js.configs.recommended.rules,
      ...tsPlugin.configs.recommended.rules,
      'no-restricted-syntax': [
        'error',
        {
          selector: "MemberExpression[property.name='innerHTML']",
          message:
            'innerHTML is forbidden — use textContent or render() helper. If HTML is required, escapeHtml all interpolations.',
        },
        {
          selector: "MemberExpression[computed=true][property.value='innerHTML']",
          message:
            "el['innerHTML'] is the same as el.innerHTML — forbidden for the same reason. Use textContent or escapeHtml.",
        },
        {
          selector: "MemberExpression[property.name='outerHTML']",
          message:
            'outerHTML is forbidden — use DOM APIs (createElement, replaceWith). If HTML is required, escapeHtml all interpolations.',
        },
        {
          selector: "MemberExpression[computed=true][property.value='outerHTML']",
          message:
            "el['outerHTML'] is the same as el.outerHTML — forbidden for the same reason.",
        },
        {
          selector: "CallExpression[callee.property.name='insertAdjacentHTML']",
          message:
            'insertAdjacentHTML is a CSP-relevant XSS sink — use DOM APIs or escapeHtml.',
        },
      ],
      // Migration trade-off: tabs/services often need `any` shims while porting from
      // legacy untyped code. Re-tighten to 'error' once migration stabilizes (Task 22+).
      '@typescript-eslint/no-explicit-any': 'warn',
      // v3.22 T5: getDateStr deprecated (머신 TZ). KST anchor 필요 시 getKstDateStr 사용.
      // dates.ts와 dates.spec.ts는 helper 정의/검증이라 overrides에서 제외.
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['**/utils/dates'],
              importNames: ['getDateStr'],
              message:
                'getDateStr is deprecated (v3.22). Use getKstDateStr for KST anchor (Asia/Seoul).',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['src/utils/dates.ts', 'tests/unit/dates.spec.ts'],
    rules: {
      'no-restricted-imports': 'off',
    },
  },
];
