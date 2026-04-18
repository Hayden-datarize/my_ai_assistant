# Phase 5 TD Foundations — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 단일 HTML(`daily-growth.html`, 3967 lines, 69 inline onclick) → Vite + TypeScript 모듈 구조로 전환하면서 CSP/escapeHtml 강화 및 Sentry 도입까지 완료. 이 작업이 Phase 5 모든 후속 워크스트림의 전제.

**Architecture:** Vite 빌드 + Vanilla TS 모듈 + Vitest 단위 테스트 + Playwright E2E 스모크. 기능 단위 디렉터리 구조(state/ui/services/utils/observability). 마이그레이션은 좌→우(엔트리부터)가 아닌 아래→위(공통 유틸→상태→탭→엔트리) 순서. 각 탭 추출 후 legacy HTML 동일 동작 보장(스모크 통과)을 cutover 조건으로 둔다. CSP는 nonce가 아닌 strict 모드(no `unsafe-inline`)로 출발하기 위해 모든 inline handler 제거를 cutover 직전 게이트로 둔다.

**Tech Stack:** Vite 5, TypeScript 5, Vitest 1, Playwright 1 (smoke only), @sentry/browser 7, ESLint + Prettier.

**Scope (atoms):** TD-1 (모듈화+Vite, L) · TD-2 (CSP+escapeHtml+inline 제거, M) · TD-3 (Sentry, S) · P5-X1 (schemaVersion 부착) · P5-X2 (CSP lint 게이트) · P5-X3 (Sentry PII 스크럽).

**Out of scope:** Firebase Auth/Functions/Firestore (W1), Slack (W2), 신규 기능. 단, schema 타입에는 Phase 6/7 대비 placeholder 필드 허용.

---

## File Structure (target)

```
my_ai_assistance/
├── package.json                   ← create
├── vite.config.ts                 ← create
├── tsconfig.json                  ← create
├── tsconfig.node.json             ← create
├── playwright.config.ts           ← create
├── .eslintrc.cjs                  ← create
├── .gitignore                     ← modify (add dist/, node_modules/, .sentry/)
├── index.html                     ← create (Vite entry, replaces daily-growth.html)
├── public/
│   ├── manifest.json              ← move from root
│   ├── sw.js                      ← move from root
│   └── icons/                     ← move from root
├── src/
│   ├── main.ts                    ← bootstrap
│   ├── styles/
│   │   └── main.css               ← extracted from <style>
│   ├── state/
│   │   ├── schema.ts              ← Types + schemaVersion (P5-X1)
│   │   ├── migration.ts           ← v0(legacy) → v1 migrator
│   │   ├── persistence.ts         ← localStorage I/O (Phase 5 후반 W1에서 Firestore로 교체)
│   │   └── store.ts               ← In-memory store + subscribers
│   ├── ui/
│   │   ├── nav.ts                 ← bottom-nav + tab router
│   │   ├── tabs/
│   │   │   ├── home.ts
│   │   │   ├── archive.ts
│   │   │   ├── stats.ts
│   │   │   ├── insights.ts
│   │   │   └── settings.ts
│   │   ├── modals/
│   │   │   ├── apiKey.ts
│   │   │   ├── slack.ts
│   │   │   └── shared.ts          ← modal open/close infra
│   │   └── render.ts              ← createElement helpers
│   ├── services/
│   │   ├── gemini.ts              ← wraps fetch (W1-b will replace with proxy)
│   │   └── slack.ts               ← wraps fetch (W2-a will refactor)
│   ├── utils/
│   │   ├── escapeHtml.ts
│   │   └── dom.ts                 ← qs/qsa/on helpers
│   └── observability/
│       ├── sentry.ts              ← init + beforeSend (P5-X3)
│       └── piiScrub.ts            ← PII regex + answer redactor
├── tests/
│   ├── unit/
│   │   ├── escapeHtml.spec.ts
│   │   ├── schema.spec.ts
│   │   ├── migration.spec.ts
│   │   ├── persistence.spec.ts
│   │   └── piiScrub.spec.ts
│   ├── lint/
│   │   └── no-inline-handlers.spec.ts  ← P5-X2 CSP lint gate
│   └── smoke/
│       └── boot.spec.ts                ← Playwright: 페이지 로드, 탭 전환, 답변 저장 1회
└── daily-growth.html              ← LEGACY, deleted at Task 22 cutover
```

**Decomposition rationale:**
- `state/` 단일 디렉터리 — schemaVersion이 모든 레코드에 부착되므로 type/migration/persistence가 한 곳에서 변하면 같이 변한다.
- `ui/tabs/` 한 파일당 한 탭 — 현 HTML의 5개 탭 영역과 1:1. 탭별 추출이 독립적으로 테스트 가능.
- `ui/modals/shared.ts` — 모달 open/close, 백드롭, ESC 닫기 인프라 공통화. Phase 6 i18n 도입 시 한 곳만 변경.
- `services/` 외부 의존성 — Phase 5 후반 W1(proxy)·W2(slack)에서 함수만 교체.
- `observability/` 별도 — Sentry init이 다른 모듈에 새지 않도록 격리. piiScrub은 단위 테스트 가능.

**Cutover principle:** Legacy `daily-growth.html`은 Task 22까지 보존. 각 탭/모달 추출이 끝나면 Vite dev server에서 동일 동작 확인 후에만 다음 탭으로 진행.

---

## Phase A — Scaffold & Safety Net (Tasks 1-3)

### Task 1: Project scaffold (Vite + TS + Vitest)

**Files:**
- Create: `package.json`, `vite.config.ts`, `tsconfig.json`, `tsconfig.node.json`, `.gitignore` (modify if exists)

- [ ] **Step 1: Create `package.json`**

```json
{
  "name": "daily-growth",
  "private": true,
  "version": "2.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "preview": "vite preview",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:smoke": "playwright test",
    "lint": "eslint src tests --ext .ts"
  },
  "devDependencies": {
    "@playwright/test": "^1.42.0",
    "@types/node": "^20.11.0",
    "@typescript-eslint/eslint-plugin": "^7.0.0",
    "@typescript-eslint/parser": "^7.0.0",
    "eslint": "^8.57.0",
    "jsdom": "^24.0.0",
    "prettier": "^3.2.0",
    "typescript": "^5.4.0",
    "vite": "^5.2.0",
    "vitest": "^1.4.0"
  }
}
```

- [ ] **Step 2: Create `vite.config.ts`**

```typescript
import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    target: 'es2020',
    sourcemap: true,
  },
  test: {
    environment: 'jsdom',
    include: ['tests/**/*.spec.ts'],
    exclude: ['tests/smoke/**'],
  },
});
```

- [ ] **Step 3: Create `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "types": ["vitest/globals"],
    "isolatedModules": true,
    "resolveJsonModule": true,
    "verbatimModuleSyntax": true
  },
  "include": ["src/**/*", "tests/**/*"],
  "references": [{ "path": "./tsconfig.node.json" }]
}
```

- [ ] **Step 4: Create `tsconfig.node.json`**

```json
{
  "compilerOptions": {
    "composite": true,
    "module": "ESNext",
    "moduleResolution": "bundler",
    "allowSyntheticDefaultImports": true
  },
  "include": ["vite.config.ts", "playwright.config.ts"]
}
```

- [ ] **Step 5: Update `.gitignore`**

Append:
```
node_modules/
dist/
.vite/
playwright-report/
test-results/
.sentry/
*.tsbuildinfo
```

- [ ] **Step 6: Install + verify build pipeline**

Run: `npm install && npm run build`
Expected: Fails with "Could not resolve entry module 'index.html'" — this is correct, fixed in Task 4.

- [ ] **Step 7: Commit**

```bash
git add package.json vite.config.ts tsconfig.json tsconfig.node.json .gitignore
git commit -m "build: add Vite + TypeScript + Vitest scaffold"
```

---

### Task 2: Smoke test for legacy HTML (capture current behavior)

**Files:**
- Create: `playwright.config.ts`, `tests/smoke/boot.spec.ts`

- [ ] **Step 1: Create `playwright.config.ts`**

```typescript
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/smoke',
  timeout: 30_000,
  use: {
    baseURL: 'http://localhost:8080',
    trace: 'retain-on-failure',
  },
  webServer: {
    command: 'npx http-server . -p 8080 -c-1',
    url: 'http://localhost:8080/daily-growth.html',
    reuseExistingServer: !process.env.CI,
    timeout: 10_000,
  },
});
```

- [ ] **Step 2: Install playwright browsers + http-server**

Run: `npm install -D http-server && npx playwright install chromium`
Expected: Chromium downloaded, http-server installed.

- [ ] **Step 3: Write smoke test against legacy HTML**

`tests/smoke/boot.spec.ts`:
```typescript
import { test, expect } from '@playwright/test';

test('legacy daily-growth.html boots and shows home tab', async ({ page }) => {
  await page.goto('/daily-growth.html');
  // Home tab visible by default
  await expect(page.locator('#homeTab')).toBeVisible();
  await expect(page.locator('#questionContent')).toBeVisible();
});

test('archive tab switch works', async ({ page }) => {
  await page.goto('/daily-growth.html');
  await page.locator('.bottom-nav button').nth(1).click();
  await expect(page.locator('#archiveList')).toBeVisible();
});

test('settings tab opens api key status', async ({ page }) => {
  await page.goto('/daily-growth.html');
  await page.locator('.bottom-nav button').last().click();
  await expect(page.locator('#apiKeyStatus')).toBeVisible();
});
```

- [ ] **Step 4: Run smoke against legacy**

Run: `npm run test:smoke`
Expected: All 3 tests PASS against legacy HTML.

> **If a test fails:** the test is wrong — adjust selector to match actual legacy markup (use `npx playwright codegen http://localhost:8080/daily-growth.html` to inspect). Do NOT modify legacy HTML.

- [ ] **Step 5: Commit**

```bash
git add playwright.config.ts tests/smoke/boot.spec.ts package.json
git commit -m "test: add Playwright smoke covering legacy boot/tabs"
```

---

### Task 3: ESLint config (catches `innerHTML` and inline-handler regressions later)

**Files:**
- Create: `.eslintrc.cjs`

- [ ] **Step 1: Create `.eslintrc.cjs`**

```javascript
module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  plugins: ['@typescript-eslint'],
  extends: ['eslint:recommended', 'plugin:@typescript-eslint/recommended'],
  parserOptions: { ecmaVersion: 2020, sourceType: 'module' },
  env: { browser: true, es2020: true, node: true },
  rules: {
    'no-restricted-syntax': [
      'error',
      {
        selector: "MemberExpression[property.name='innerHTML']",
        message: 'innerHTML is forbidden — use textContent or render() helper. If HTML is required, escapeHtml all interpolations.',
      },
      {
        selector: "MemberExpression[property.name='outerHTML']",
        message: 'outerHTML is forbidden — use DOM APIs.',
      },
    ],
  },
  ignorePatterns: ['dist/', 'node_modules/', 'daily-growth.html'],
};
```

> **Allowlist note:** A few render helpers in `src/ui/render.ts` legitimately need `innerHTML` (e.g., trusted template). They use `// eslint-disable-next-line no-restricted-syntax` with a one-liner WHY comment.

- [ ] **Step 2: Run lint on empty src**

Run: `npm run lint`
Expected: PASS (no files yet).

- [ ] **Step 3: Commit**

```bash
git add .eslintrc.cjs
git commit -m "lint: forbid innerHTML/outerHTML to enforce escapeHtml discipline"
```

---

## Phase B — Shared Utilities & State Layer (Tasks 4-7)

### Task 4: escapeHtml utility + tests

**Files:**
- Create: `src/utils/escapeHtml.ts`, `tests/unit/escapeHtml.spec.ts`

- [ ] **Step 1: Write failing test**

`tests/unit/escapeHtml.spec.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import { escapeHtml } from '../../src/utils/escapeHtml';

describe('escapeHtml', () => {
  it('escapes the five HTML special characters', () => {
    expect(escapeHtml('<script>')).toBe('&lt;script&gt;');
    expect(escapeHtml('a & b')).toBe('a &amp; b');
    expect(escapeHtml('"hi"')).toBe('&quot;hi&quot;');
    expect(escapeHtml("'hi'")).toBe('&#39;hi&#39;');
  });
  it('handles empty string and non-string falsy', () => {
    expect(escapeHtml('')).toBe('');
    expect(escapeHtml(null as unknown as string)).toBe('');
    expect(escapeHtml(undefined as unknown as string)).toBe('');
  });
  it('preserves safe content', () => {
    expect(escapeHtml('hello world 123')).toBe('hello world 123');
  });
});
```

- [ ] **Step 2: Run, verify FAIL**

Run: `npm test -- escapeHtml`
Expected: FAIL with "Cannot find module".

- [ ] **Step 3: Implement**

`src/utils/escapeHtml.ts`:
```typescript
const MAP: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

export function escapeHtml(input: string | null | undefined): string {
  if (input == null) return '';
  return String(input).replace(/[&<>"']/g, (c) => MAP[c] ?? c);
}
```

- [ ] **Step 4: Run, verify PASS**

Run: `npm test -- escapeHtml`
Expected: PASS, 3/3.

- [ ] **Step 5: Commit**

```bash
git add src/utils/escapeHtml.ts tests/unit/escapeHtml.spec.ts
git commit -m "feat(utils): add escapeHtml with full character set"
```

---

### Task 5: DOM helpers (qs/qsa/on)

**Files:**
- Create: `src/utils/dom.ts`

- [ ] **Step 1: Implement (no test — these are thin wrappers)**

`src/utils/dom.ts`:
```typescript
export function qs<T extends HTMLElement = HTMLElement>(
  sel: string,
  root: ParentNode = document,
): T {
  const el = root.querySelector<T>(sel);
  if (!el) throw new Error(`qs: element not found: ${sel}`);
  return el;
}

export function qsa<T extends HTMLElement = HTMLElement>(
  sel: string,
  root: ParentNode = document,
): T[] {
  return Array.from(root.querySelectorAll<T>(sel));
}

export function on<K extends keyof HTMLElementEventMap>(
  el: HTMLElement,
  event: K,
  handler: (e: HTMLElementEventMap[K]) => void,
): () => void {
  el.addEventListener(event, handler);
  return () => el.removeEventListener(event, handler);
}
```

- [ ] **Step 2: Compile check**

Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/utils/dom.ts
git commit -m "feat(utils): add qs/qsa/on DOM helpers"
```

---

### Task 6: Schema types + schemaVersion (P5-X1)

**Files:**
- Create: `src/state/schema.ts`, `tests/unit/schema.spec.ts`

- [ ] **Step 1: Write failing test**

`tests/unit/schema.spec.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import { CURRENT_SCHEMA_VERSION, makeAnswer, makeUserSettings, isVersioned } from '../../src/state/schema';

describe('schema', () => {
  it('CURRENT_SCHEMA_VERSION is 1', () => {
    expect(CURRENT_SCHEMA_VERSION).toBe(1);
  });
  it('makeAnswer attaches schemaVersion=1 and createdAt ISO', () => {
    const a = makeAnswer({ id: 'a1', questionId: 'q1', text: 'hello', authorId: 'u1' });
    expect(a.schemaVersion).toBe(1);
    expect(a.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(a.text).toBe('hello');
  });
  it('makeUserSettings attaches schemaVersion=1', () => {
    const s = makeUserSettings({ userId: 'u1' });
    expect(s.schemaVersion).toBe(1);
    expect(s.optIns).toEqual({});
  });
  it('isVersioned narrows correctly', () => {
    expect(isVersioned({ schemaVersion: 1 })).toBe(true);
    expect(isVersioned({})).toBe(false);
    expect(isVersioned(null)).toBe(false);
  });
});
```

- [ ] **Step 2: Run, verify FAIL**

Run: `npm test -- schema`
Expected: FAIL with "Cannot find module".

- [ ] **Step 3: Implement**

`src/state/schema.ts`:
```typescript
export const CURRENT_SCHEMA_VERSION = 1 as const;

export type SchemaVersion = 0 | 1;

export interface Versioned {
  schemaVersion: SchemaVersion;
}

export interface Answer extends Versioned {
  id: string;
  questionId: string;
  text: string;
  authorId: string;
  createdAt: string;
}

export interface UserSettings extends Versioned {
  userId: string;
  optIns: Record<string, boolean>;
  policyVersion?: string;
}

export interface ArchiveEntry extends Versioned {
  id: string;
  date: string;
  category: string;
  payload: Record<string, unknown>;
}

export function makeAnswer(input: Omit<Answer, 'schemaVersion' | 'createdAt'>): Answer {
  return { ...input, schemaVersion: CURRENT_SCHEMA_VERSION, createdAt: new Date().toISOString() };
}

export function makeUserSettings(input: { userId: string }): UserSettings {
  return { userId: input.userId, optIns: {}, schemaVersion: CURRENT_SCHEMA_VERSION };
}

export function makeArchiveEntry(input: Omit<ArchiveEntry, 'schemaVersion'>): ArchiveEntry {
  return { ...input, schemaVersion: CURRENT_SCHEMA_VERSION };
}

export function isVersioned(value: unknown): value is Versioned {
  return typeof value === 'object' && value !== null && typeof (value as Versioned).schemaVersion === 'number';
}
```

- [ ] **Step 4: Run, verify PASS**

Run: `npm test -- schema`
Expected: PASS, 4/4.

- [ ] **Step 5: Commit**

```bash
git add src/state/schema.ts tests/unit/schema.spec.ts
git commit -m "feat(state): add schemaVersion v1 types (P5-X1)"
```

---

### Task 7: Migration (legacy v0 → v1)

**Files:**
- Create: `src/state/migration.ts`, `tests/unit/migration.spec.ts`

- [ ] **Step 1: Write failing test**

`tests/unit/migration.spec.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import { migrateAnswer, migrateUserSettings, migrateUnknown } from '../../src/state/migration';

describe('migration v0 → v1', () => {
  it('migrates legacy answer (no schemaVersion) to v1', () => {
    const legacy = { id: 'a1', questionId: 'q1', text: 'old', authorId: 'u1', createdAt: '2025-12-01T00:00:00Z' };
    const v1 = migrateAnswer(legacy);
    expect(v1.schemaVersion).toBe(1);
    expect(v1.id).toBe('a1');
    expect(v1.createdAt).toBe('2025-12-01T00:00:00Z');
  });
  it('passes through v1 answer unchanged', () => {
    const already = { id: 'a1', questionId: 'q1', text: 'new', authorId: 'u1', createdAt: '2026-04-18T00:00:00Z', schemaVersion: 1 as const };
    expect(migrateAnswer(already)).toEqual(already);
  });
  it('migrates legacy user settings, defaulting optIns to {}', () => {
    const legacy = { userId: 'u1' };
    expect(migrateUserSettings(legacy)).toEqual({ userId: 'u1', optIns: {}, schemaVersion: 1 });
  });
  it('migrateUnknown stamps unknown shapes as v1 without losing fields', () => {
    expect(migrateUnknown({ foo: 'bar' })).toEqual({ foo: 'bar', schemaVersion: 1 });
  });
});
```

- [ ] **Step 2: Run, verify FAIL**

Run: `npm test -- migration`
Expected: FAIL.

- [ ] **Step 3: Implement**

`src/state/migration.ts`:
```typescript
import { CURRENT_SCHEMA_VERSION, isVersioned, type Answer, type UserSettings } from './schema';

export function migrateAnswer(raw: unknown): Answer {
  const r = (raw ?? {}) as Partial<Answer> & Record<string, unknown>;
  if (isVersioned(r) && r.schemaVersion === CURRENT_SCHEMA_VERSION) return r as Answer;
  return {
    id: String(r.id ?? ''),
    questionId: String(r.questionId ?? ''),
    text: String(r.text ?? ''),
    authorId: String(r.authorId ?? ''),
    createdAt: String(r.createdAt ?? new Date().toISOString()),
    schemaVersion: CURRENT_SCHEMA_VERSION,
  };
}

export function migrateUserSettings(raw: unknown): UserSettings {
  const r = (raw ?? {}) as Partial<UserSettings> & Record<string, unknown>;
  if (isVersioned(r) && r.schemaVersion === CURRENT_SCHEMA_VERSION) return r as UserSettings;
  return {
    userId: String(r.userId ?? ''),
    optIns: (r.optIns as Record<string, boolean> | undefined) ?? {},
    policyVersion: r.policyVersion as string | undefined,
    schemaVersion: CURRENT_SCHEMA_VERSION,
  };
}

export function migrateUnknown<T extends Record<string, unknown>>(raw: T): T & { schemaVersion: typeof CURRENT_SCHEMA_VERSION } {
  return { ...raw, schemaVersion: CURRENT_SCHEMA_VERSION };
}
```

- [ ] **Step 4: Run, verify PASS**

Run: `npm test -- migration`
Expected: PASS, 4/4.

- [ ] **Step 5: Commit**

```bash
git add src/state/migration.ts tests/unit/migration.spec.ts
git commit -m "feat(state): add v0→v1 migration helpers"
```

---

### Task 8: Persistence (localStorage I/O with migration)

**Files:**
- Create: `src/state/persistence.ts`, `tests/unit/persistence.spec.ts`

- [ ] **Step 1: Write failing test**

`tests/unit/persistence.spec.ts`:
```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { loadAnswers, saveAnswers, loadUserSettings, saveUserSettings } from '../../src/state/persistence';

beforeEach(() => localStorage.clear());

describe('persistence', () => {
  it('round-trips answers', () => {
    const answers = [{ id: 'a1', questionId: 'q1', text: 'hi', authorId: 'u1', createdAt: '2026-04-18T00:00:00Z', schemaVersion: 1 as const }];
    saveAnswers(answers);
    expect(loadAnswers()).toEqual(answers);
  });
  it('migrates legacy answers stored without schemaVersion', () => {
    localStorage.setItem('dg.answers', JSON.stringify([{ id: 'a1', questionId: 'q1', text: 'old', authorId: 'u1', createdAt: '2025-12-01T00:00:00Z' }]));
    const loaded = loadAnswers();
    expect(loaded[0]?.schemaVersion).toBe(1);
  });
  it('returns empty array on missing key', () => {
    expect(loadAnswers()).toEqual([]);
  });
  it('returns default settings on missing key', () => {
    expect(loadUserSettings('u1')).toEqual({ userId: 'u1', optIns: {}, schemaVersion: 1 });
  });
  it('round-trips user settings', () => {
    const s = { userId: 'u1', optIns: { topicCloud: true }, schemaVersion: 1 as const };
    saveUserSettings(s);
    expect(loadUserSettings('u1')).toEqual(s);
  });
});
```

- [ ] **Step 2: Run, verify FAIL**

Run: `npm test -- persistence`
Expected: FAIL.

- [ ] **Step 3: Implement**

`src/state/persistence.ts`:
```typescript
import { migrateAnswer, migrateUserSettings } from './migration';
import { makeUserSettings, type Answer, type UserSettings } from './schema';

const KEYS = {
  answers: 'dg.answers',
  userSettings: (userId: string) => `dg.userSettings.${userId}`,
} as const;

function readJson<T>(key: string, fallback: T): T {
  const raw = localStorage.getItem(key);
  if (raw == null) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function loadAnswers(): Answer[] {
  const raw = readJson<unknown[]>(KEYS.answers, []);
  return Array.isArray(raw) ? raw.map(migrateAnswer) : [];
}

export function saveAnswers(answers: Answer[]): void {
  localStorage.setItem(KEYS.answers, JSON.stringify(answers));
}

export function loadUserSettings(userId: string): UserSettings {
  const raw = readJson<unknown>(KEYS.userSettings(userId), null);
  if (raw == null) return makeUserSettings({ userId });
  return migrateUserSettings(raw);
}

export function saveUserSettings(settings: UserSettings): void {
  localStorage.setItem(KEYS.userSettings(settings.userId), JSON.stringify(settings));
}
```

- [ ] **Step 4: Run, verify PASS**

Run: `npm test -- persistence`
Expected: PASS, 5/5.

- [ ] **Step 5: Commit**

```bash
git add src/state/persistence.ts tests/unit/persistence.spec.ts
git commit -m "feat(state): add localStorage persistence with auto-migration"
```

---

## Phase C — Tab/Modal Extraction (Tasks 9-15)

> **Pattern note:** Each tab task follows the same shape — read source lines from `daily-growth.html`, extract markup template + handlers into the new module, replace inline `onclick` with `addEventListener`, write a Vitest unit test that mounts the rendered DOM into a jsdom container and asserts a key element exists.
>
> Each task lists the **exact source line range** to migrate. Read `daily-growth.html` with the Read tool to confirm before extraction.

### Task 9: index.html (Vite entry) + extract <style> to src/styles/main.css

**Files:**
- Create: `index.html`, `src/styles/main.css`, `src/main.ts` (stub)
- Read: `daily-growth.html` lines 1-200 (style block + initial body markup)

- [ ] **Step 1: Inspect legacy `<style>` boundary**

Run: `grep -n -E "^\s*<(style|/style)" /Users/hayden/Hayden_AX_Project/my_ai_assistance/daily-growth.html`
Record the start/end line numbers of the `<style>` block.

- [ ] **Step 2: Create `index.html` (clean Vite entry)**

```html
<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <meta name="theme-color" content="#4F46E5">
  <meta name="mobile-web-app-capable" content="yes">
  <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
  <title>Daily Growth</title>
  <link rel="manifest" href="/manifest.json">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@300;400;500;600;700&family=Outfit:wght@300;400;500;600;700&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="/src/styles/main.css">
</head>
<body>
  <main id="app"></main>
  <nav class="bottom-nav" id="bottomNav"></nav>
  <div id="modalRoot"></div>
  <script type="module" src="/src/main.ts"></script>
</body>
</html>
```

- [ ] **Step 3: Extract `<style>` to `src/styles/main.css`**

Use Edit/Read on `daily-growth.html`. Copy CSS rules between `<style>` and `</style>` into `src/styles/main.css`. Strip the `<style>` tags.

- [ ] **Step 4: Stub `src/main.ts`**

```typescript
console.log('daily-growth main module loaded');
```

- [ ] **Step 5: Move PWA assets**

Run: `mkdir -p public && mv manifest.json sw.js public/ && mv icons public/`

- [ ] **Step 6: Verify dev server boots**

Run: `npm run dev` (background) then visit http://localhost:5173.
Expected: Empty page with bottom-nav skeleton + console log "daily-growth main module loaded". Stop server with Ctrl+C.

- [ ] **Step 7: Commit**

```bash
git add index.html src/styles/main.css src/main.ts public/
git commit -m "refactor: extract styles + create Vite index.html entry"
```

---

### Task 10: Extract Home tab

**Files:**
- Create: `src/ui/tabs/home.ts`, `tests/unit/tabs/home.spec.ts`
- Read: `daily-growth.html` — the section containing `<div id="homeTab">` (use grep to find line range)

- [ ] **Step 1: Locate Home tab markup in legacy**

Run: `grep -n -E "id=\"homeTab\"|id=\"questionContent\"|id=\"answerInput\"" /Users/hayden/Hayden_AX_Project/my_ai_assistance/daily-growth.html`
Record line range encompassing the `homeTab` div and all its inline handlers.

- [ ] **Step 2: Write failing test**

`tests/unit/tabs/home.spec.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import { renderHome } from '../../../src/ui/tabs/home';

describe('renderHome', () => {
  it('mounts homeTab container with question content placeholder', () => {
    const root = document.createElement('div');
    renderHome(root);
    expect(root.querySelector('#homeTab')).not.toBeNull();
    expect(root.querySelector('#questionContent')).not.toBeNull();
  });
});
```

- [ ] **Step 3: Run, verify FAIL**

Run: `npm test -- tabs/home`
Expected: FAIL.

- [ ] **Step 4: Implement `renderHome`**

`src/ui/tabs/home.ts`:
```typescript
import { qs } from '../../utils/dom';

export function renderHome(container: HTMLElement): void {
  container.innerHTML = `
    <div id="homeTab">
      <div id="questionContent"></div>
      <textarea id="answerInput" placeholder="오늘 답변을 적어주세요..."></textarea>
      <button id="saveAnswerBtn" type="button">저장</button>
      <div id="growthSummary"></div>
    </div>
  `;
  // eslint-disable-next-line no-restricted-syntax -- trusted static template, no interpolation
  const saveBtn = qs<HTMLButtonElement>('#saveAnswerBtn', container);
  saveBtn.addEventListener('click', () => onSaveAnswerClick());
}

function onSaveAnswerClick(): void {
  // Placeholder for now — full save flow restored after services/gemini.ts in Task 16
  document.dispatchEvent(new CustomEvent('dg:save-answer'));
}
```

> **Note:** The lint exception comment is required because we use `innerHTML` for a static trusted template with zero user interpolation. Each `innerHTML` use in this codebase MUST have such an exception with WHY rationale.

- [ ] **Step 5: Run, verify PASS**

Run: `npm test -- tabs/home`
Expected: PASS, 1/1.

- [ ] **Step 6: Migrate dynamic content (question text, archive list, etc.)**

Read the full Home tab section from legacy HTML (line range from Step 1). For each piece of dynamic data the original used (today's question text, growth summary, category breakdown):
- Add a function `updateHomeQuestion(text: string): void` etc. in `src/ui/tabs/home.ts`
- Use `escapeHtml()` from `src/utils/escapeHtml` for any user-derived string
- Replace any inline `onclick="..."` handler from legacy with an `addEventListener` registered after `renderHome` mounts

- [ ] **Step 7: Run all tests**

Run: `npm test`
Expected: ALL PASS.

- [ ] **Step 8: Commit**

```bash
git add src/ui/tabs/home.ts tests/unit/tabs/home.spec.ts
git commit -m "refactor: extract Home tab from legacy HTML"
```

---

### Task 11: Extract Archive tab

**Files:**
- Create: `src/ui/tabs/archive.ts`, `tests/unit/tabs/archive.spec.ts`
- Read: `daily-growth.html` — section containing `<div id="archiveList">` and surrounding tab wrapper

- [ ] **Step 1: Locate**

Run: `grep -n "archiveList\|archiveTab" /Users/hayden/Hayden_AX_Project/my_ai_assistance/daily-growth.html`
Record line range.

- [ ] **Step 2: Write failing test**

`tests/unit/tabs/archive.spec.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import { renderArchive } from '../../../src/ui/tabs/archive';

describe('renderArchive', () => {
  it('mounts archive container', () => {
    const root = document.createElement('div');
    renderArchive(root);
    expect(root.querySelector('#archiveTab')).not.toBeNull();
    expect(root.querySelector('#archiveList')).not.toBeNull();
  });
  it('renders empty state with friendly message when no entries', () => {
    const root = document.createElement('div');
    renderArchive(root);
    const list = root.querySelector('#archiveList');
    expect(list?.textContent).toMatch(/아직 저장된 답변이 없어요|empty/i);
  });
});
```

- [ ] **Step 3: Run, verify FAIL**

Run: `npm test -- tabs/archive`
Expected: FAIL.

- [ ] **Step 4: Implement `renderArchive`**

`src/ui/tabs/archive.ts`:
```typescript
import { loadAnswers } from '../../state/persistence';
import { escapeHtml } from '../../utils/escapeHtml';

export function renderArchive(container: HTMLElement): void {
  const answers = loadAnswers();
  // eslint-disable-next-line no-restricted-syntax -- static skeleton; dynamic items appended below with escapeHtml
  container.innerHTML = `
    <div id="archiveTab">
      <h2>아카이브</h2>
      <div id="archiveList"></div>
    </div>
  `;
  const list = container.querySelector<HTMLDivElement>('#archiveList');
  if (!list) return;
  if (answers.length === 0) {
    list.textContent = '아직 저장된 답변이 없어요. 첫 답변을 남겨보세요.';
    return;
  }
  for (const a of answers) {
    const card = document.createElement('article');
    card.className = 'archive-card';
    const date = document.createElement('div');
    date.className = 'archive-date';
    date.textContent = new Date(a.createdAt).toLocaleDateString('ko-KR');
    const text = document.createElement('div');
    text.className = 'archive-text';
    text.textContent = a.text; // textContent is XSS-safe
    card.append(date, text);
    list.append(card);
  }
}
```

- [ ] **Step 5: Run, verify PASS**

Run: `npm test -- tabs/archive`
Expected: PASS, 2/2.

- [ ] **Step 6: Migrate any inline onclick from legacy archive section**

For each `onclick="..."` in the legacy archive section, attach an `addEventListener` after the card is created. Use `data-id` attribute + event delegation if many cards.

- [ ] **Step 7: Commit**

```bash
git add src/ui/tabs/archive.ts tests/unit/tabs/archive.spec.ts
git commit -m "refactor: extract Archive tab with empty state"
```

---

### Task 12: Extract Stats tab

**Files:**
- Create: `src/ui/tabs/stats.ts`, `tests/unit/tabs/stats.spec.ts`
- Read: `daily-growth.html` — section containing `<div id="categoryBreakdown">` and stats markup

- [ ] **Step 1: Locate**

Run: `grep -n "categoryBreakdown\|statsTab\|growthSummary" /Users/hayden/Hayden_AX_Project/my_ai_assistance/daily-growth.html`

- [ ] **Step 2: Write failing test**

`tests/unit/tabs/stats.spec.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import { renderStats } from '../../../src/ui/tabs/stats';

describe('renderStats', () => {
  it('mounts stats container with categoryBreakdown', () => {
    const root = document.createElement('div');
    renderStats(root);
    expect(root.querySelector('#statsTab')).not.toBeNull();
    expect(root.querySelector('#categoryBreakdown')).not.toBeNull();
  });
});
```

- [ ] **Step 3: Run, verify FAIL → implement → verify PASS**

`src/ui/tabs/stats.ts`:
```typescript
import { loadAnswers } from '../../state/persistence';

export function renderStats(container: HTMLElement): void {
  // eslint-disable-next-line no-restricted-syntax -- static skeleton
  container.innerHTML = `
    <div id="statsTab">
      <h2>통계</h2>
      <div id="categoryBreakdown"></div>
      <div id="growthSummary"></div>
    </div>
  `;
  const total = loadAnswers().length;
  const breakdown = container.querySelector<HTMLDivElement>('#categoryBreakdown');
  if (breakdown) breakdown.textContent = `누적 답변 ${total}개`;
}
```

Run: `npm test -- tabs/stats`
Expected: PASS.

- [ ] **Step 4: Migrate full breakdown logic from legacy** (if more complex than count, port using same pattern as Archive — DOM APIs, escapeHtml for any string interpolation).

- [ ] **Step 5: Commit**

```bash
git add src/ui/tabs/stats.ts tests/unit/tabs/stats.spec.ts
git commit -m "refactor: extract Stats tab with category breakdown"
```

---

### Task 13: Extract Insights tab

**Files:**
- Create: `src/ui/tabs/insights.ts`, `tests/unit/tabs/insights.spec.ts`
- Read: `daily-growth.html` — section with insights/growth summary

- [ ] **Step 1: Locate**

Run: `grep -n "insightsTab\|insightContent" /Users/hayden/Hayden_AX_Project/my_ai_assistance/daily-growth.html`

- [ ] **Step 2: Write failing test**

`tests/unit/tabs/insights.spec.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import { renderInsights } from '../../../src/ui/tabs/insights';

describe('renderInsights', () => {
  it('mounts insights container', () => {
    const root = document.createElement('div');
    renderInsights(root);
    expect(root.querySelector('#insightsTab')).not.toBeNull();
  });
});
```

- [ ] **Step 3: Implement (start minimal, port logic from legacy after green)**

`src/ui/tabs/insights.ts`:
```typescript
export function renderInsights(container: HTMLElement): void {
  // eslint-disable-next-line no-restricted-syntax -- static skeleton
  container.innerHTML = `
    <div id="insightsTab">
      <h2>인사이트</h2>
      <div id="insightContent">아직 인사이트가 없어요.</div>
    </div>
  `;
}
```

- [ ] **Step 4: Port legacy insight rendering** — Read legacy section, migrate any `innerHTML` interpolation to either `textContent` or escapeHtml-wrapped templates. Replace inline handlers.

- [ ] **Step 5: Run all tests + commit**

Run: `npm test`
```bash
git add src/ui/tabs/insights.ts tests/unit/tabs/insights.spec.ts
git commit -m "refactor: extract Insights tab"
```

---

### Task 14: Extract Settings tab + API key flow

**Files:**
- Create: `src/ui/tabs/settings.ts`, `tests/unit/tabs/settings.spec.ts`
- Read: `daily-growth.html` — section with `apiKeyStatus`, settings inputs, slack test

- [ ] **Step 1: Locate**

Run: `grep -n "apiKeyStatus\|settingsTab\|slackTest" /Users/hayden/Hayden_AX_Project/my_ai_assistance/daily-growth.html`

- [ ] **Step 2: Write failing test**

`tests/unit/tabs/settings.spec.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import { renderSettings } from '../../../src/ui/tabs/settings';

describe('renderSettings', () => {
  it('mounts settings container with apiKeyStatus and slack input', () => {
    const root = document.createElement('div');
    renderSettings(root);
    expect(root.querySelector('#settingsTab')).not.toBeNull();
    expect(root.querySelector('#apiKeyStatus')).not.toBeNull();
    expect(root.querySelector('#slackWebhookInput')).not.toBeNull();
  });
});
```

- [ ] **Step 3: Implement**

`src/ui/tabs/settings.ts`:
```typescript
import { qs } from '../../utils/dom';
import { escapeHtml } from '../../utils/escapeHtml';

export function renderSettings(container: HTMLElement): void {
  // eslint-disable-next-line no-restricted-syntax -- static skeleton, no user interpolation
  container.innerHTML = `
    <div id="settingsTab">
      <h2>설정</h2>
      <section>
        <h3>Gemini API 키</h3>
        <input type="password" id="apiKeyInput" autocomplete="off" />
        <button type="button" id="saveApiKeyBtn">저장</button>
        <div id="apiKeyStatus"></div>
      </section>
      <section>
        <h3>Slack Webhook</h3>
        <input type="url" id="slackWebhookInput" placeholder="https://hooks.slack.com/..." />
        <button type="button" id="testSlackBtn">테스트</button>
        <div id="slackTestResult"></div>
      </section>
    </div>
  `;
  qs<HTMLButtonElement>('#saveApiKeyBtn', container).addEventListener('click', () => onSaveKey(container));
  qs<HTMLButtonElement>('#testSlackBtn', container).addEventListener('click', () => onTestSlack(container));
}

function onSaveKey(container: HTMLElement): void {
  const key = qs<HTMLInputElement>('#apiKeyInput', container).value.trim();
  const status = qs<HTMLDivElement>('#apiKeyStatus', container);
  if (key.length < 20) {
    status.textContent = '키 형식이 올바르지 않습니다.';
    return;
  }
  localStorage.setItem('dg.apiKey', key);
  status.textContent = '저장되었습니다.';
}

function onTestSlack(container: HTMLElement): void {
  const webhook = qs<HTMLInputElement>('#slackWebhookInput', container).value.trim();
  const result = qs<HTMLDivElement>('#slackTestResult', container);
  result.textContent = webhook ? '테스트 전송 중...' : 'Webhook URL을 입력하세요.';
  // Real send wired up in Task 16 (services/slack.ts); this is the UI-only extraction.
}
```

> **Phase 5 caveat:** The Gemini API key is still in localStorage at this stage. W1-b (Cloud Functions proxy) removes it from the client entirely. This task does not regress that — it preserves current behavior so the smoke test stays green during cutover.

- [ ] **Step 4: Run + commit**

Run: `npm test -- tabs/settings`
```bash
git add src/ui/tabs/settings.ts tests/unit/tabs/settings.spec.ts
git commit -m "refactor: extract Settings tab with key/slack inputs"
```

---

### Task 15: Modal infra + extract apiKey/slack modals

**Files:**
- Create: `src/ui/modals/shared.ts`, `src/ui/modals/apiKey.ts`, `src/ui/modals/slack.ts`, `tests/unit/modals/shared.spec.ts`

- [ ] **Step 1: Write failing test**

`tests/unit/modals/shared.spec.ts`:
```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { openModal, closeModal } from '../../../src/ui/modals/shared';

beforeEach(() => {
  document.body.innerHTML = '<div id="modalRoot"></div>';
});

describe('modal shared infra', () => {
  it('opens a modal with title and body', () => {
    openModal({ title: 'Test', bodyHtml: '<p>hello</p>' });
    expect(document.querySelector('.dg-modal')).not.toBeNull();
    expect(document.querySelector('.dg-modal-title')?.textContent).toBe('Test');
  });
  it('closes modal on Escape key', () => {
    openModal({ title: 'X', bodyHtml: '' });
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(document.querySelector('.dg-modal')).toBeNull();
  });
  it('closeModal removes the active modal', () => {
    openModal({ title: 'X', bodyHtml: '' });
    closeModal();
    expect(document.querySelector('.dg-modal')).toBeNull();
  });
});
```

- [ ] **Step 2: Implement `shared.ts`**

`src/ui/modals/shared.ts`:
```typescript
export interface ModalConfig {
  title: string;
  bodyHtml: string; // caller is responsible for escaping any interpolation
}

let active: HTMLDivElement | null = null;
let escHandler: ((e: KeyboardEvent) => void) | null = null;

export function openModal(cfg: ModalConfig): void {
  closeModal();
  const root = document.getElementById('modalRoot') ?? document.body;
  const wrap = document.createElement('div');
  wrap.className = 'dg-modal';
  wrap.setAttribute('role', 'dialog');
  wrap.setAttribute('aria-modal', 'true');
  // eslint-disable-next-line no-restricted-syntax -- caller-controlled trusted HTML; documented in ModalConfig
  wrap.innerHTML = `
    <div class="dg-modal-backdrop"></div>
    <div class="dg-modal-card">
      <header class="dg-modal-header">
        <h3 class="dg-modal-title"></h3>
        <button type="button" class="dg-modal-close" aria-label="닫기">×</button>
      </header>
      <div class="dg-modal-body"></div>
    </div>
  `;
  const titleEl = wrap.querySelector<HTMLHeadingElement>('.dg-modal-title');
  if (titleEl) titleEl.textContent = cfg.title;
  const bodyEl = wrap.querySelector<HTMLDivElement>('.dg-modal-body');
  // eslint-disable-next-line no-restricted-syntax -- caller-supplied bodyHtml; caller MUST escape interpolations
  if (bodyEl) bodyEl.innerHTML = cfg.bodyHtml;
  wrap.querySelector('.dg-modal-close')?.addEventListener('click', closeModal);
  wrap.querySelector('.dg-modal-backdrop')?.addEventListener('click', closeModal);
  root.append(wrap);
  active = wrap;
  escHandler = (e) => { if (e.key === 'Escape') closeModal(); };
  document.addEventListener('keydown', escHandler);
}

export function closeModal(): void {
  if (active) {
    active.remove();
    active = null;
  }
  if (escHandler) {
    document.removeEventListener('keydown', escHandler);
    escHandler = null;
  }
}
```

- [ ] **Step 3: Run, verify PASS**

Run: `npm test -- modals/shared`
Expected: PASS, 3/3.

- [ ] **Step 4: Implement apiKey + slack modals using shared**

`src/ui/modals/apiKey.ts`:
```typescript
import { openModal } from './shared';
import { escapeHtml } from '../../utils/escapeHtml';

export function openApiKeyModal(currentKeyMasked: string): void {
  openModal({
    title: 'Gemini API 키 관리',
    bodyHtml: `
      <p>현재 키: <code>${escapeHtml(currentKeyMasked)}</code></p>
      <input type="password" id="modalApiKeyInput" />
      <div id="modalApiKeyStatus"></div>
    `,
  });
}
```

`src/ui/modals/slack.ts`:
```typescript
import { openModal } from './shared';

export function openSlackModal(): void {
  openModal({
    title: 'Slack 연동',
    bodyHtml: `
      <input type="url" id="modalSlackWebhook" placeholder="https://hooks.slack.com/..." />
      <button type="button" id="modalSlackTestBtn">테스트</button>
      <div id="modalSlackResult"></div>
    `,
  });
}
```

- [ ] **Step 5: Commit**

```bash
git add src/ui/modals/ tests/unit/modals/
git commit -m "refactor: extract modal infra + apiKey/slack modals"
```

---

### Task 16: Extract Gemini and Slack services

**Files:**
- Create: `src/services/gemini.ts`, `src/services/slack.ts`, `tests/unit/services/gemini.spec.ts`
- Read: `daily-growth.html` — fetch calls to `generativelanguage.googleapis.com` and Slack webhooks

- [ ] **Step 1: Locate fetch calls**

Run: `grep -n -E "fetch\(|generativelanguage|hooks\.slack" /Users/hayden/Hayden_AX_Project/my_ai_assistance/daily-growth.html | head -20`

- [ ] **Step 2: Write failing test for gemini**

`tests/unit/services/gemini.spec.ts`:
```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { generateText } from '../../../src/services/gemini';

beforeEach(() => {
  global.fetch = vi.fn();
});

describe('gemini.generateText', () => {
  it('throws if no api key', async () => {
    await expect(generateText({ apiKey: '', prompt: 'hi' })).rejects.toThrow(/api key/i);
  });
  it('posts to Gemini endpoint with prompt body', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({ candidates: [{ content: { parts: [{ text: 'response' }] } }] }),
    });
    const out = await generateText({ apiKey: 'k', prompt: 'hi' });
    expect(out).toBe('response');
    expect(global.fetch).toHaveBeenCalledOnce();
  });
  it('returns empty string on malformed response', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({}),
    });
    expect(await generateText({ apiKey: 'k', prompt: 'hi' })).toBe('');
  });
});
```

- [ ] **Step 3: Implement gemini service**

`src/services/gemini.ts`:
```typescript
const ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent';

export interface GenerateTextInput {
  apiKey: string;
  prompt: string;
}

interface GeminiResponse {
  candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
}

export async function generateText({ apiKey, prompt }: GenerateTextInput): Promise<string> {
  if (!apiKey) throw new Error('Gemini api key missing');
  const res = await fetch(`${ENDPOINT}?key=${encodeURIComponent(apiKey)}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
  });
  if (!res.ok) throw new Error(`Gemini ${res.status}`);
  const data = (await res.json()) as GeminiResponse;
  return data.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
}
```

> W1-b will replace the direct API call with a Cloud Functions proxy (`/api/gemini`). This module's signature stays the same so tabs don't change.

- [ ] **Step 4: Implement slack service**

`src/services/slack.ts`:
```typescript
export interface SendSlackInput {
  webhookUrl: string;
  text: string;
}

export async function sendSlack({ webhookUrl, text }: SendSlackInput): Promise<void> {
  const res = await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ text }),
  });
  if (!res.ok) throw new Error(`Slack webhook ${res.status}`);
}
```

- [ ] **Step 5: Run, verify all PASS + commit**

Run: `npm test`
```bash
git add src/services/ tests/unit/services/
git commit -m "refactor: extract gemini + slack services"
```

---

## Phase D — Bootstrap & Cutover (Tasks 17-19)

### Task 17: Bottom nav + tab router

**Files:**
- Create: `src/ui/nav.ts`, `tests/unit/nav.spec.ts`

- [ ] **Step 1: Write failing test**

`tests/unit/nav.spec.ts`:
```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { mountNav, switchTab } from '../../src/ui/nav';

beforeEach(() => {
  document.body.innerHTML = '<main id="app"></main><nav id="bottomNav"></nav>';
});

describe('nav', () => {
  it('mounts 5 tab buttons', () => {
    mountNav();
    expect(document.querySelectorAll('#bottomNav button').length).toBe(5);
  });
  it('switchTab("home") renders Home into #app', () => {
    mountNav();
    switchTab('home');
    expect(document.querySelector('#homeTab')).not.toBeNull();
  });
  it('switchTab("archive") renders Archive into #app', () => {
    mountNav();
    switchTab('archive');
    expect(document.querySelector('#archiveTab')).not.toBeNull();
  });
});
```

- [ ] **Step 2: Run, verify FAIL**

Run: `npm test -- nav`
Expected: FAIL.

- [ ] **Step 3: Implement nav**

`src/ui/nav.ts`:
```typescript
import { qs } from '../utils/dom';
import { renderHome } from './tabs/home';
import { renderArchive } from './tabs/archive';
import { renderStats } from './tabs/stats';
import { renderInsights } from './tabs/insights';
import { renderSettings } from './tabs/settings';

export type TabId = 'home' | 'archive' | 'stats' | 'insights' | 'settings';

const TABS: Array<{ id: TabId; label: string; render: (c: HTMLElement) => void }> = [
  { id: 'home', label: '홈', render: renderHome },
  { id: 'archive', label: '아카이브', render: renderArchive },
  { id: 'stats', label: '통계', render: renderStats },
  { id: 'insights', label: '인사이트', render: renderInsights },
  { id: 'settings', label: '설정', render: renderSettings },
];

export function mountNav(): void {
  const nav = qs<HTMLElement>('#bottomNav');
  nav.replaceChildren();
  for (const t of TABS) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.textContent = t.label;
    btn.dataset.tabId = t.id;
    btn.addEventListener('click', () => switchTab(t.id));
    nav.append(btn);
  }
}

export function switchTab(id: TabId): void {
  const tab = TABS.find((t) => t.id === id);
  if (!tab) throw new Error(`Unknown tab: ${id}`);
  const app = qs<HTMLElement>('#app');
  app.replaceChildren();
  tab.render(app);
}
```

- [ ] **Step 4: Run, verify PASS + commit**

Run: `npm test -- nav`
```bash
git add src/ui/nav.ts tests/unit/nav.spec.ts
git commit -m "feat(ui): add bottom-nav with tab router"
```

---

### Task 18: Wire up `src/main.ts` (full bootstrap)

**Files:**
- Modify: `src/main.ts`

- [ ] **Step 1: Replace stub with bootstrap**

`src/main.ts`:
```typescript
import { mountNav, switchTab } from './ui/nav';

function boot(): void {
  mountNav();
  switchTab('home');
  registerServiceWorker();
}

function registerServiceWorker(): void {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js').catch((err) => {
      console.warn('SW registration failed', err);
    });
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}
```

- [ ] **Step 2: Verify dev server**

Run: `npm run dev` (background) → visit http://localhost:5173.
Expected: Home tab visible by default. All 5 tabs switchable. Console clean.
Stop with Ctrl+C.

- [ ] **Step 3: Update Playwright smoke to point at Vite preview**

Modify `playwright.config.ts`:
```typescript
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/smoke',
  timeout: 30_000,
  use: {
    baseURL: 'http://localhost:4173',
    trace: 'retain-on-failure',
  },
  webServer: {
    command: 'npm run build && npm run preview -- --port 4173',
    url: 'http://localhost:4173',
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
```

Modify `tests/smoke/boot.spec.ts` — change `/daily-growth.html` → `/`:
```typescript
import { test, expect } from '@playwright/test';

test('app boots and shows home tab', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#homeTab')).toBeVisible();
});

test('archive tab switch works', async ({ page }) => {
  await page.goto('/');
  await page.locator('#bottomNav button[data-tab-id="archive"]').click();
  await expect(page.locator('#archiveTab')).toBeVisible();
});

test('settings tab opens api key status', async ({ page }) => {
  await page.goto('/');
  await page.locator('#bottomNav button[data-tab-id="settings"]').click();
  await expect(page.locator('#apiKeyStatus')).toBeVisible();
});
```

- [ ] **Step 4: Run smoke against new build**

Run: `npm run test:smoke`
Expected: All 3 PASS.

- [ ] **Step 5: Commit**

```bash
git add src/main.ts playwright.config.ts tests/smoke/boot.spec.ts
git commit -m "feat: wire bootstrap and migrate smoke to Vite build"
```

---

### Task 19: Cutover — delete legacy `daily-growth.html`

**Files:**
- Delete: `daily-growth.html`
- Modify: `firebase.json` (if it references daily-growth.html as entry)

- [ ] **Step 1: Pre-flight — confirm no remaining references**

Run: `grep -rn "daily-growth.html" /Users/hayden/Hayden_AX_Project/my_ai_assistance --include="*.ts" --include="*.json" --include="*.html" --include="*.md" 2>&1 | grep -v "node_modules\|dist\|docs/"`
Expected: Only references are in `firebase.json` (entry rewrite) and possibly `manifest.json`.

- [ ] **Step 2: Update `firebase.json` rewrites**

If it points at `daily-growth.html`, change to `/index.html`:
```json
{
  "hosting": {
    "public": "dist",
    "rewrites": [{ "source": "**", "destination": "/index.html" }]
  }
}
```

- [ ] **Step 3: Update `public/manifest.json` start_url**

Change `start_url` from `daily-growth.html` to `/`.

- [ ] **Step 4: Delete legacy + verify smoke**

```bash
rm daily-growth.html
npm run build && npm run test:smoke
```
Expected: build succeeds, all smoke tests PASS.

- [ ] **Step 5: Commit**

```bash
git add -u daily-growth.html firebase.json public/manifest.json
git commit -m "refactor: cutover to Vite build, remove legacy daily-growth.html"
```

---

## Phase E — CSP Lint Gate (Tasks 20-21)

### Task 20: CSP lint gate test (P5-X2)

**Files:**
- Create: `tests/lint/no-inline-handlers.spec.ts`

- [ ] **Step 1: Write the gate test**

`tests/lint/no-inline-handlers.spec.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = new URL('../..', import.meta.url).pathname;
const SCAN_DIRS = ['src', 'index.html'];

const INLINE_HANDLER_RE = /\son[a-z]+\s*=\s*["']/i;
const JAVASCRIPT_URL_RE = /\bjavascript:/i;

function* walk(dir: string): Generator<string> {
  const full = join(ROOT, dir);
  const stats = statSync(full);
  if (stats.isFile()) {
    yield full;
    return;
  }
  for (const entry of readdirSync(full)) {
    if (entry === 'node_modules' || entry === 'dist' || entry.startsWith('.')) continue;
    yield* walk(join(dir, entry));
  }
}

describe('CSP lint gate (P5-X2)', () => {
  it('contains zero inline event handlers in source', () => {
    const offenders: string[] = [];
    for (const target of SCAN_DIRS) {
      for (const file of walk(target)) {
        if (!/\.(html|ts|tsx|js)$/.test(file)) continue;
        const text = readFileSync(file, 'utf8');
        if (INLINE_HANDLER_RE.test(text)) offenders.push(`${file}: inline on*= handler`);
        if (JAVASCRIPT_URL_RE.test(text)) offenders.push(`${file}: javascript: URL`);
      }
    }
    expect(offenders, offenders.join('\n')).toEqual([]);
  });
});
```

- [ ] **Step 2: Run gate**

Run: `npm test -- no-inline-handlers`
Expected: PASS (cutover already removed legacy HTML; if anything fails, fix the offending file).

> **If the gate fails**, do not weaken the regex — find every offender and convert to `addEventListener`. This is the entire point of P5-X2.

- [ ] **Step 3: Commit**

```bash
git add tests/lint/no-inline-handlers.spec.ts
git commit -m "test(lint): add CSP no-inline-handler gate (P5-X2)"
```

---

### Task 21: Add strict CSP header

**Files:**
- Modify: `index.html`, `firebase.json`

- [ ] **Step 1: Add CSP meta to `index.html` `<head>`**

Insert after the `<meta name="theme-color">` line:
```html
<meta http-equiv="Content-Security-Policy" content="default-src 'self'; script-src 'self'; style-src 'self' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; connect-src 'self' https://generativelanguage.googleapis.com https://hooks.slack.com https://*.firebaseio.com https://*.googleapis.com https://*.sentry.io; img-src 'self' data:; manifest-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self';">
```

> **Note:** CSP is also configured at the Firebase Hosting layer in Step 2 for defense-in-depth. The meta tag covers local dev preview; the response header covers production.

- [ ] **Step 2: Add CSP response header in `firebase.json`**

Modify `firebase.json` hosting block:
```json
{
  "hosting": {
    "public": "dist",
    "rewrites": [{ "source": "**", "destination": "/index.html" }],
    "headers": [
      {
        "source": "**",
        "headers": [
          { "key": "Content-Security-Policy", "value": "default-src 'self'; script-src 'self'; style-src 'self' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; connect-src 'self' https://generativelanguage.googleapis.com https://hooks.slack.com https://*.firebaseio.com https://*.googleapis.com https://*.sentry.io; img-src 'self' data:; manifest-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'" },
          { "key": "X-Content-Type-Options", "value": "nosniff" },
          { "key": "Referrer-Policy", "value": "strict-origin-when-cross-origin" },
          { "key": "Permissions-Policy", "value": "geolocation=(), microphone=(), camera=()" }
        ]
      }
    ]
  }
}
```

- [ ] **Step 3: Build + smoke under CSP**

Run: `npm run build && npm run test:smoke`
Expected: All PASS. Open the preview URL in a browser, confirm DevTools Console has zero CSP violations on home/archive/settings tabs.

> **If a CSP violation appears,** the offending resource (likely a font, inline style, or third-party fetch) needs to be either added to the relevant directive or removed. Do NOT add `'unsafe-inline'` — that defeats P5-X2.

- [ ] **Step 4: Commit**

```bash
git add index.html firebase.json
git commit -m "feat(security): add strict CSP header (no unsafe-inline)"
```

---

## Phase F — Sentry (Tasks 22-23)

### Task 22: Sentry SDK + init + PII scrub (TD-3, P5-X3)

**Files:**
- Modify: `package.json`, `src/main.ts`
- Create: `src/observability/sentry.ts`, `src/observability/piiScrub.ts`, `tests/unit/piiScrub.spec.ts`, `.env.example`

- [ ] **Step 1: Install Sentry**

Run: `npm install @sentry/browser`

- [ ] **Step 2: Write failing test for PII scrub**

`tests/unit/piiScrub.spec.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import { scrubPii, scrubEvent } from '../../src/observability/piiScrub';

describe('scrubPii', () => {
  it('redacts email addresses', () => {
    expect(scrubPii('Contact me at jane.doe@datarize.ai please'))
      .toBe('Contact me at [REDACTED_EMAIL] please');
  });
  it('redacts phone numbers (KR + intl)', () => {
    expect(scrubPii('전화 010-1234-5678 입니다')).toBe('전화 [REDACTED_PHONE] 입니다');
    expect(scrubPii('call +82 10 1234 5678')).toMatch(/\[REDACTED_PHONE\]/);
  });
  it('redacts apparent API keys (AIza... and 32+ alnum runs)', () => {
    expect(scrubPii('key=AIzaSyABCDEFG_HIJKLMN-OPQRSTUVWXYZ12345')).toMatch(/\[REDACTED_KEY\]/);
  });
});

describe('scrubEvent', () => {
  it('strips answer text from breadcrumb messages', () => {
    const e = {
      message: 'user wrote: my private answer here',
      breadcrumbs: [{ message: 'answer-input: confidential text' }],
    };
    const out = scrubEvent(e);
    expect(out.message).not.toContain('private answer');
    expect(out.breadcrumbs?.[0]?.message).not.toContain('confidential');
  });
});
```

- [ ] **Step 3: Implement piiScrub**

`src/observability/piiScrub.ts`:
```typescript
const EMAIL_RE = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
const PHONE_RE = /(?:\+?\d{1,3}[\s-]?)?(?:0?1[016789])[\s-]?\d{3,4}[\s-]?\d{4}/g;
const KEY_RE = /AIza[0-9A-Za-z_-]{30,}|[A-Za-z0-9_-]{32,}/g;
const ANSWER_PHRASE_RE = /(answer-input|user wrote|user answered|content)\s*[:=]\s*[^\n]+/gi;

export function scrubPii(input: string): string {
  return input
    .replace(EMAIL_RE, '[REDACTED_EMAIL]')
    .replace(PHONE_RE, '[REDACTED_PHONE]')
    .replace(KEY_RE, '[REDACTED_KEY]')
    .replace(ANSWER_PHRASE_RE, '[REDACTED_ANSWER]');
}

export interface ScrubbableEvent {
  message?: string;
  breadcrumbs?: Array<{ message?: string }>;
  request?: { url?: string };
}

export function scrubEvent<T extends ScrubbableEvent>(event: T): T {
  if (event.message) event.message = scrubPii(event.message);
  if (event.breadcrumbs) {
    for (const b of event.breadcrumbs) if (b.message) b.message = scrubPii(b.message);
  }
  if (event.request?.url) event.request.url = scrubPii(event.request.url);
  return event;
}
```

- [ ] **Step 4: Run, verify PASS**

Run: `npm test -- piiScrub`
Expected: PASS, 4/4.

- [ ] **Step 5: Implement Sentry init**

`src/observability/sentry.ts`:
```typescript
import * as Sentry from '@sentry/browser';
import { scrubEvent } from './piiScrub';

export function initSentry(): void {
  const dsn = import.meta.env.VITE_SENTRY_DSN;
  if (!dsn) return; // disabled in dev when env not set
  Sentry.init({
    dsn,
    release: import.meta.env.VITE_RELEASE ?? 'dev',
    environment: import.meta.env.MODE,
    tracesSampleRate: 0.1,
    sendDefaultPii: false,
    beforeSend: (event) => scrubEvent(event as Parameters<typeof scrubEvent>[0]) as typeof event,
    beforeBreadcrumb: (crumb) => {
      if (crumb.category === 'console' && crumb.message) {
        return { ...crumb, message: '[scrubbed]' };
      }
      return crumb;
    },
  });
}
```

- [ ] **Step 6: Wire into `src/main.ts`**

Modify `src/main.ts`:
```typescript
import { initSentry } from './observability/sentry';
import { mountNav, switchTab } from './ui/nav';

function boot(): void {
  initSentry();
  mountNav();
  switchTab('home');
  registerServiceWorker();
}

function registerServiceWorker(): void {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js').catch((err) => {
      console.warn('SW registration failed', err);
    });
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}
```

- [ ] **Step 7: Add `.env.example`**

```
# Sentry — leave empty in dev to disable
VITE_SENTRY_DSN=
VITE_RELEASE=phase5-dev
```

> **CSP note:** `connect-src` already lists `https://*.sentry.io` from Task 21. No CSP edit needed.

- [ ] **Step 8: Run all tests + smoke + commit**

Run: `npm test && npm run test:smoke`
Expected: ALL PASS.
```bash
git add src/observability/ src/main.ts .env.example tests/unit/piiScrub.spec.ts package.json package-lock.json
git commit -m "feat(observability): add Sentry with PII scrub (TD-3, P5-X3)"
```

---

### Task 23: Final verification + lessons doc

**Files:**
- Modify: `tasks/lessons.md` (create if missing — per global CLAUDE.md)

- [ ] **Step 1: Run full verification suite**

Run all in order:
```bash
npm run lint && npm test && npm run build && npm run test:smoke
```
Expected: all green.

- [ ] **Step 2: Manual browser check**

Run: `npm run preview` (background)
Open http://localhost:4173 in browser.
DevTools console: zero errors, zero CSP violations.
Click through all 5 tabs.
Stop server.

- [ ] **Step 3: Create or append `tasks/lessons.md`**

If `tasks/lessons.md` does not exist, create it. Append a new entry for this TD migration:

```markdown
## 2026-XX-XX — Phase 5 TD Foundations 완료

**무엇:** 단일 HTML(3967 lines, 69 inline onclick) → Vite + TS 모듈로 전환. CSP strict 모드 + Sentry + schemaVersion 도입.

**잘 됐던 것:**
- E2E 스모크 테스트를 첫날 작성 → 탭별 추출 시 안전망 역할.
- ESLint `no-restricted-syntax` 로 innerHTML 금지 → escapeHtml 누락 미연 방지.
- CSP 게이트 테스트(P5-X2) 자동화 → 회귀 차단.

**힘들었던 것:**
- (이 자리는 실제 구현 후 채울 것 — 인라인 핸들러 마이그 함정, CSP 충돌 등)

**Phase 6 이후 잊지 말 것:**
- W1-b 도입 시 `services/gemini.ts` 의 fetch 대상만 프록시로 교체. signature는 유지.
- W3-c k≥5 집계는 schema v2 가능성 있음 → migration.ts 패턴 그대로 확장.
- Sentry 무료 한도 (5K events/mo) 모니터링. 50명 파일럿이면 충분하지만 Phase 6 확장 시 재평가.
```

- [ ] **Step 4: Final commit**

```bash
git add tasks/lessons.md
git commit -m "docs: record Phase 5 TD migration lessons"
```

- [ ] **Step 5: Tag the milestone**

Run: `git tag -a phase5-td-foundations -m "Phase 5 TD Foundations complete"`

---

## Definition of Done (TD sub-plan)

- [ ] `npm run lint` exits 0 with `no-restricted-syntax` rule active
- [ ] `npm test` shows ≥30 unit tests passing (escapeHtml, schema, migration, persistence, 5 tabs, modal infra, services, nav, piiScrub, csp-lint-gate)
- [ ] `npm run build` produces `dist/` with no errors
- [ ] `npm run test:smoke` passes against `dist/` preview
- [ ] No file in `src/` or `index.html` contains `on*=` inline handler or `javascript:` URL (P5-X2 gate)
- [ ] CSP header configured in both `index.html` meta and `firebase.json` response headers
- [ ] Sentry initializes only when `VITE_SENTRY_DSN` is set; PII scrub unit tests pass
- [ ] Every record produced by `state/` has `schemaVersion: 1` (P5-X1 verified by schema.spec.ts)
- [ ] `daily-growth.html` deleted; `firebase.json` and `public/manifest.json` no longer reference it
- [ ] `tasks/lessons.md` updated with retrospective notes

---

## Handoff to next sub-plan

Once all 23 tasks check, the codebase has the scaffolding W1 needs. The next sub-plan is `2026-XX-XX-phase5-w1-zerotrust.md` — Firebase Auth (SSO) + Cloud Functions proxy + Firestore audit log + export/delete + permission labels. It will swap `services/gemini.ts` from direct call to proxy call (signature unchanged) and replace `state/persistence.ts` localStorage I/O with Firestore (with the same migration pattern, just one more level of versioning).
