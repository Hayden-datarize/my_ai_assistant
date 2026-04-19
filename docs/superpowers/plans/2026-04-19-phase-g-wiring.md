# Phase G — Functional Wiring Recovery Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restore v2.0 daily-use behavior on the v3.0 Vite/TS module architecture, with three hard gates (typed event map + gap-detector + functional Playwright smoke) so wiring omissions cannot ship again.

**Architecture:** Markup/dispatch in `src/ui/tabs/*.ts` already exists; add `src/ui/events.ts` typed EventMap, `src/ui/handlers/*.ts` receivers, `src/state/*.ts` localStorage access, `src/services/rss.ts`, extended `src/services/gemini.ts`, `src/ui/onboarding.ts`, and bootstrap glue in `src/main.ts`. All external I/O is mocked at Playwright route level for smoke tests.

**Tech Stack:** TypeScript 5, Vite 5, Vitest, Playwright, Firebase Hosting, Gemini API, rss2json.

**Reference spec:** [docs/superpowers/specs/2026-04-19-phase-g-wiring-design.md](../specs/2026-04-19-phase-g-wiring-design.md)
**Legacy source:** `git show 9e82119^:daily-growth.html` (3967 lines, 101 functions)

---

## File Inventory

| File | Status | Responsibility |
|---|---|---|
| `src/ui/events.ts` | NEW | Typed CustomEvent map: names + detail types for 16 events |
| `src/utils/dates.ts` | NEW | `getDateStr(date?)` |
| `src/utils/categories.ts` | NEW | `INTERESTS` metadata + `getCategoryLabel(id)` |
| `src/state/user.ts` | NEW | `loadUserData / saveUser / updateStreakBanner / checkAndUpdateStreak / recordActivity / updateGreeting` |
| `src/state/answers.ts` | NEW | `saveAnswer / listAnswers / findAnswer / setAnswerEvaluation / aggregateStats` |
| `src/state/briefings.ts` | NEW | `loadBriefings / saveBriefings / toggleScrap / setRead / saveMemo` |
| `src/state/chat.ts` | NEW | `saveChatHistory / loadChatHistory` (key `chat_{YYYY-MM-DD}`) |
| `src/services/rss.ts` | NEW | `fetchFeed(url)` with 5s timeout + backup feeds |
| `src/services/gemini.ts` | EXTEND | add `generateQuestion / chat / evaluateAnswer` |
| `src/ui/onboarding.ts` | NEW | 3-step onboarding flow (interests → api key → complete) |
| `src/ui/handlers/home.ts` | NEW | 11 `dg:home:*` listeners |
| `src/ui/handlers/archive.ts` | NEW | 3 `dg:archive:*` listeners |
| `src/ui/handlers/stats.ts` | NEW | 2 `dg:stats:*` listeners |
| `src/ui/handlers/settings.ts` | NEW | settings delegate + modal glue |
| `src/main.ts` | EXTEND | bootstrap: load user → theme → nav → mount handlers → onboarding-or-home init |
| `tests/fixtures/api/gemini.json` | NEW | mocked Gemini responses |
| `tests/fixtures/api/rss.json` | NEW | mocked rss2json payloads |
| `tests/fixtures/v2.0-user-data.json` | NEW | v2.0 localStorage snapshot |
| `tests/helpers/mockApi.ts` | NEW | `mockExternalApis(page)` Playwright helper |
| `tests/lint/wiring-gap.spec.ts` | NEW | gap-detector |
| `tests/smoke/onboarding.spec.ts` | NEW | Gate C #1 |
| `tests/smoke/question-flow.spec.ts` | NEW | Gate C #2 |
| `tests/smoke/briefings.spec.ts` | NEW | Gate C #3 |
| `tests/smoke/archive.spec.ts` | NEW | Gate C #4 |
| `tests/smoke/stats.spec.ts` | NEW | Gate C #5 |
| `tests/smoke/settings.spec.ts` | NEW | Gate C #6 |
| `tests/smoke/theme-persist.spec.ts` | NEW | Gate C #7 |
| `tests/smoke/v20-compat.spec.ts` | NEW | Gate C #8 |

## Dependency Graph

```text
Batch 1 (parallel):     Task 1 (events.ts)   Task 2 (dates)   Task 3 (categories)
Batch 2 (parallel):     Task 4 (gemini fix)  Task 5 (rss fix) Task 6 (v2.0 fix)
                        Task 7 (mockApi helper)              Task 8 (gap-detector)
Batch 3 (parallel, needs Batch 1):
                        Task 9 (state/user)       Task 10 (state/answers)
                        Task 11 (state/briefings) Task 12 (state/chat)
Batch 4 (parallel, needs Batch 1):
                        Task 13 (services/rss)    Task 14 (services/gemini extend)
Batch 5 (parallel, needs Batch 3+4):
                        Task 15 (onboarding + smoke)
                        Task 16 (handlers/home briefings + smoke)
                        Task 17 (handlers/home question+answer+chat + smoke)
                        Task 18 (handlers/archive + smoke)
                        Task 19 (handlers/stats + smoke)
                        Task 20 (handlers/settings name/interests/theme + smoke)
                        Task 21 (handlers/settings apiKey modal + exportData + smoke)
Batch 6 (serial):       Task 22 (main.ts bootstrap)
Batch 7 (serial):       Task 23 (v2.0 compat smoke)  Task 24 (full gate run)
                        Task 25 (Hayden acceptance + deploy)
```

---

## Conventions

- **Package manager:** `pnpm` (matches current repo).
- **Commit format:** Conventional commits (`feat(scope): …`, `test(scope): …`, `chore(scope): …`).
- **Every task ends with a commit.** No "continue in next task" across commits.
- **TDD per task:** write failing test → verify fails → implement → verify passes → commit.
- **ESLint is live:** no `innerHTML`, no inline `on*=` handlers, no unescaped interpolation. Use `src/utils/dom.ts` `qs`/`qsa`/`on` helpers and `src/utils/escapeHtml.ts`.
- **Playwright smoke** always runs against `pnpm build && pnpm preview` (not dev server).
- **Legacy port rule:** match user-visible text, localStorage keys+shapes, and external API shapes exactly. Internal code may diverge.
- **Reference legacy lines:** use `git show 9e82119^:daily-growth.html | sed -n 'N,Mp'` when porting.

---

## Batch 1 — Event map + utilities

Parallel. No dependencies.

### Task 1: Typed CustomEvent map

**Files:**
- Create: `src/ui/events.ts`
- Test: `tests/unit/events.spec.ts`

- [ ] **Step 1: Write failing test**

```ts
// tests/unit/events.spec.ts
import { describe, it, expect, vi } from 'vitest';
import { dispatch, on } from '../../src/ui/events';

describe('events', () => {
  it('dispatches a typed event and invokes the matching listener with detail', () => {
    const handler = vi.fn();
    const off = on('dg:home:submit-answer', handler);
    dispatch('dg:home:submit-answer', { text: 'hello' });
    expect(handler).toHaveBeenCalledWith({ text: 'hello' });
    off();
  });

  it('supports void-detail events', () => {
    const handler = vi.fn();
    const off = on('dg:home:refresh-briefings', handler);
    dispatch('dg:home:refresh-briefings', undefined);
    expect(handler).toHaveBeenCalledTimes(1);
    off();
  });

  it('off() removes the listener', () => {
    const handler = vi.fn();
    const off = on('dg:home:refresh-briefings', handler);
    off();
    dispatch('dg:home:refresh-briefings', undefined);
    expect(handler).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test — verify FAIL**

```bash
pnpm vitest run tests/unit/events.spec.ts
```
Expected: FAIL (module not found).

- [ ] **Step 3: Implement**

```ts
// src/ui/events.ts
export interface EventMap {
  // home (11)
  'dg:home:refresh-briefings': undefined;
  'dg:home:toggle-scrap': { index: number };
  'dg:home:mark-read': { index: number };
  'dg:home:toggle-memo': { index: number };
  'dg:home:save-memo': { index: number; memo: string };
  'dg:home:toggle-hint': undefined;
  'dg:home:submit-answer': { text: string };
  'dg:home:chat-send': { text: string };
  'dg:home:open-api-key-modal': undefined;
  'dg:home:reload-question': undefined;
  'dg:home:char-count-change': { length: number };
  // archive (3)
  'dg:archive:filter': { filter: string };
  'dg:archive:search': { query: string };
  'dg:archive:open-detail': { date: string };
  // stats (2)
  'dg:stats:open-day-detail': { date: string };
  'dg:stats:refresh': undefined;
}

type EventName = keyof EventMap;

export function dispatch<K extends EventName>(name: K, detail: EventMap[K]): void {
  window.dispatchEvent(new CustomEvent(name, { detail }));
}

export function on<K extends EventName>(
  name: K,
  handler: (detail: EventMap[K]) => void,
): () => void {
  const wrapped = (e: Event) => handler((e as CustomEvent<EventMap[K]>).detail);
  window.addEventListener(name, wrapped);
  return () => window.removeEventListener(name, wrapped);
}

export const EVENT_NAMES: EventName[] = [
  'dg:home:refresh-briefings', 'dg:home:toggle-scrap', 'dg:home:mark-read',
  'dg:home:toggle-memo', 'dg:home:save-memo', 'dg:home:toggle-hint',
  'dg:home:submit-answer', 'dg:home:chat-send', 'dg:home:open-api-key-modal',
  'dg:home:reload-question', 'dg:home:char-count-change',
  'dg:archive:filter', 'dg:archive:search', 'dg:archive:open-detail',
  'dg:stats:open-day-detail', 'dg:stats:refresh',
];
```

- [ ] **Step 4: Run — verify PASS**

```bash
pnpm vitest run tests/unit/events.spec.ts
```
Expected: 3/3 PASS.

- [ ] **Step 5: Commit**

```bash
git add src/ui/events.ts tests/unit/events.spec.ts
git commit -m "feat(ui): add typed CustomEvent map with dispatch/on helpers"
```

### Task 2: Date utilities

**Files:**
- Create: `src/utils/dates.ts`
- Test: `tests/unit/dates.spec.ts`

- [ ] **Step 1: Write failing test**

```ts
// tests/unit/dates.spec.ts
import { describe, it, expect } from 'vitest';
import { getDateStr } from '../../src/utils/dates';

describe('getDateStr', () => {
  it('returns YYYY-MM-DD for given Date', () => {
    expect(getDateStr(new Date('2026-04-19T15:30:00Z'))).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
  it('pads single-digit month and day', () => {
    expect(getDateStr(new Date(2026, 0, 3))).toBe('2026-01-03');
  });
  it('defaults to today when no arg', () => {
    expect(getDateStr()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
```

- [ ] **Step 2: Run — FAIL** (`pnpm vitest run tests/unit/dates.spec.ts`)

- [ ] **Step 3: Implement**

```ts
// src/utils/dates.ts
export function getDateStr(date: Date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}
```

- [ ] **Step 4: Run — PASS** (`pnpm vitest run tests/unit/dates.spec.ts`) — 3/3 PASS

- [ ] **Step 5: Commit**

```bash
git add src/utils/dates.ts tests/unit/dates.spec.ts
git commit -m "feat(utils): add getDateStr"
```

### Task 3: Category metadata

**Files:**
- Create: `src/utils/categories.ts`
- Test: `tests/unit/categories.spec.ts`

- [ ] **Step 1: Find legacy values**

```bash
git show 9e82119^:daily-growth.html | grep -A 20 "function getCategoryLabel\|const INTERESTS\|const CATEGORIES"
```

Port the id → label mapping 1:1. Legacy uses string ids like `'business'`, `'tech'`, `'design'`, `'growth'`, `'marketing'`, `'product'`, `'leadership'`, `'communication'` etc. Capture all.

- [ ] **Step 2: Write failing test**

```ts
// tests/unit/categories.spec.ts
import { describe, it, expect } from 'vitest';
import { getCategoryLabel, INTERESTS } from '../../src/utils/categories';

describe('categories', () => {
  it('exposes at least 6 interests each with id + label + emoji', () => {
    expect(INTERESTS.length).toBeGreaterThanOrEqual(6);
    for (const i of INTERESTS) {
      expect(i.id).toMatch(/^[a-z-]+$/);
      expect(i.label.length).toBeGreaterThan(0);
      expect(i.emoji.length).toBeGreaterThan(0);
    }
  });
  it('getCategoryLabel returns label for known id', () => {
    const id = INTERESTS[0].id;
    expect(getCategoryLabel(id)).toBe(INTERESTS[0].label);
  });
  it('getCategoryLabel returns the id when unknown', () => {
    expect(getCategoryLabel('nope-xxx')).toBe('nope-xxx');
  });
});
```

- [ ] **Step 3: Run — FAIL** (`pnpm vitest run tests/unit/categories.spec.ts`)

- [ ] **Step 4: Implement (port legacy labels verbatim)**

```ts
// src/utils/categories.ts
export interface Interest { id: string; label: string; emoji: string; }

export const INTERESTS: readonly Interest[] = [
  // Port from legacy renderInterestGrid — values must match v2.0 exactly.
  // Replace the array below with the exact ids/labels/emojis from git show above.
  { id: 'business', label: '비즈니스', emoji: '💼' },
  { id: 'tech', label: '기술', emoji: '💻' },
  { id: 'design', label: '디자인', emoji: '🎨' },
  { id: 'growth', label: '성장', emoji: '🌱' },
  { id: 'leadership', label: '리더십', emoji: '🎯' },
  { id: 'communication', label: '커뮤니케이션', emoji: '💬' },
  // ...add any additional ids from legacy
];

const MAP = new Map(INTERESTS.map(i => [i.id, i.label] as const));

export function getCategoryLabel(id: string): string {
  return MAP.get(id) ?? id;
}
```

Implementer MUST re-extract `INTERESTS` from legacy source and confirm the set matches 1:1 before committing.

- [ ] **Step 5: Run — PASS** (`pnpm vitest run tests/unit/categories.spec.ts`)

- [ ] **Step 6: Commit**

```bash
git add src/utils/categories.ts tests/unit/categories.spec.ts
git commit -m "feat(utils): port interests catalog + getCategoryLabel from legacy"
```

---

## Batch 2 — Test infrastructure

Parallel. No dependencies.

### Task 4: Gemini mock fixture

**Files:**
- Create: `tests/fixtures/api/gemini.json`

- [ ] **Step 1: Capture shapes from legacy**

Legacy calls `https://generativelanguage.googleapis.com/v1beta/models/gemini-<model>:generateContent`. Responses have `{ candidates: [{ content: { parts: [{ text: string }] } }] }`.

- [ ] **Step 2: Create fixture**

```json
{
  "question": {
    "candidates": [{
      "content": { "parts": [{ "text": "{\"type\":\"reflection\",\"question\":\"오늘 하루 중 가장 몰입했던 순간은 언제였나요?\",\"hint\":\"구체적인 상황과 그때의 감정을 떠올려보세요.\"}" }] }
    }]
  },
  "feedback": {
    "candidates": [{
      "content": { "parts": [{ "text": "좋은 관찰이에요. 한 걸음 더: 그 경험이 앞으로의 결정에 어떻게 작용할 것 같나요?" }] }
    }]
  },
  "chat": {
    "candidates": [{
      "content": { "parts": [{ "text": "더 구체적으로 말해주실 수 있을까요?" }] }
    }]
  },
  "evaluation": {
    "candidates": [{
      "content": { "parts": [{ "text": "{\"score\":4,\"feedback\":\"구체적이고 맥락이 풍부합니다.\"}" }] }
    }]
  },
  "keyTest": {
    "candidates": [{ "content": { "parts": [{ "text": "OK" }] } }]
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add tests/fixtures/api/gemini.json
git commit -m "test(fixture): add Gemini API mock payloads"
```

### Task 5: RSS mock fixture

**Files:**
- Create: `tests/fixtures/api/rss.json`

- [ ] **Step 1: Fixture**

```json
{
  "status": "ok",
  "feed": { "title": "mock-feed" },
  "items": [
    { "title": "AI 생산성을 바꾸는 3가지 습관", "link": "https://example.com/a1", "description": "요약 텍스트 1", "pubDate": "2026-04-19 08:00:00" },
    { "title": "좋은 질문이 팀을 움직인다", "link": "https://example.com/a2", "description": "요약 텍스트 2", "pubDate": "2026-04-19 07:30:00" },
    { "title": "작게 자주 커밋하라", "link": "https://example.com/a3", "description": "요약 텍스트 3", "pubDate": "2026-04-19 07:00:00" }
  ]
}
```

- [ ] **Step 2: Commit**

```bash
git add tests/fixtures/api/rss.json
git commit -m "test(fixture): add rss2json mock payload"
```

### Task 6: v2.0 user-data snapshot

**Files:**
- Create: `tests/fixtures/v2.0-user-data.json`

- [ ] **Step 1: Synthesize a representative v2.0 snapshot (verified against legacy shapes)**

```json
{
  "dg_gemini_key": "TEST_KEY_V2",
  "user": {
    "name": "Hayden",
    "interests": ["business","tech","leadership"],
    "onboardedAt": "2026-03-01",
    "streak": 12,
    "lastActiveDate": "2026-04-18",
    "xp": 640,
    "level": 3
  },
  "answers": [
    { "id": "a1", "date": "2026-04-18", "questionId": "q1", "type": "reflection", "answer": "어제는 팀 1:1에서 비언어적 신호를 의식적으로 살폈다...", "evaluation": { "score": 4, "feedback": "구체적" } },
    { "id": "a2", "date": "2026-04-17", "questionId": "q2", "type": "action", "answer": "30분 블록으로 심층 작업을 시도했다...", "evaluation": { "score": 3, "feedback": "다음엔 결과를 명시" } }
  ],
  "briefings": [
    { "id": "b1", "date": "2026-04-18", "url": "https://example.com/x", "title": "좋은 피드백의 조건", "summary": "사실-관찰-제안 순서로...", "scrapped": true, "read": true, "memo": "매주 회고에 적용" }
  ],
  "theme": "dark",
  "chat_2026-04-18": [
    { "role": "user", "text": "어제 1:1이 좋았어", "at": 1713446400000 },
    { "role": "ai", "text": "무엇이 다르게 느껴졌나요?", "at": 1713446410000 }
  ]
}
```

- [ ] **Step 2: Commit**

```bash
git add tests/fixtures/v2.0-user-data.json
git commit -m "test(fixture): add v2.0 localStorage snapshot for compat smoke"
```

### Task 7: Playwright API mock helper

**Files:**
- Create: `tests/helpers/mockApi.ts`

- [ ] **Step 1: Implement**

```ts
// tests/helpers/mockApi.ts
import type { Page } from '@playwright/test';
import gemini from '../fixtures/api/gemini.json' with { type: 'json' };
import rss from '../fixtures/api/rss.json' with { type: 'json' };

type MockKind = 'question' | 'feedback' | 'chat' | 'evaluation' | 'keyTest';

export async function mockExternalApis(page: Page): Promise<void> {
  // rss2json
  await page.route('**/api.rss2json.com/**', async route => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(rss) });
  });

  // Gemini — rotate response based on prompt substring
  await page.route('**/generativelanguage.googleapis.com/**', async route => {
    const body = route.request().postData() ?? '';
    let kind: MockKind = 'chat';
    if (body.includes('질문') || body.includes('오늘의')) kind = 'question';
    else if (body.includes('피드백') || body.includes('feedback')) kind = 'feedback';
    else if (body.includes('평가') || body.includes('점수')) kind = 'evaluation';
    else if (body.length < 200) kind = 'keyTest';
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify((gemini as Record<string, unknown>)[kind]) });
  });
}

export async function seedLocalStorage(page: Page, data: Record<string, unknown>): Promise<void> {
  await page.addInitScript(payload => {
    for (const [k, v] of Object.entries(payload)) {
      localStorage.setItem(k, typeof v === 'string' ? v : JSON.stringify(v));
    }
  }, data);
}
```

- [ ] **Step 2: Commit**

```bash
git add tests/helpers/mockApi.ts
git commit -m "test(helpers): add mockExternalApis + seedLocalStorage"
```

### Task 8: gap-detector (Gate B)

**Files:**
- Create: `tests/lint/wiring-gap.spec.ts`

- [ ] **Step 1: Write test**

```ts
// tests/lint/wiring-gap.spec.ts
import { describe, it, expect } from 'vitest';
import { readdir, readFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');

async function walk(dir: string): Promise<string[]> {
  const out: string[] = [];
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const p = resolve(dir, e.name);
    if (e.isDirectory()) out.push(...await walk(p));
    else if (e.name.endsWith('.ts') && !e.name.endsWith('.spec.ts')) out.push(p);
  }
  return out;
}

describe('wiring-gap', () => {
  it('every dispatched event name has a listener and vice versa', async () => {
    const srcFiles = await walk(resolve(ROOT, 'src'));
    const dispatched = new Set<string>();
    const listened = new Set<string>();
    const dispatchRe = /dispatch\(\s*['"](dg:[\w:-]+)['"]/g;
    const onRe = /\bon\(\s*['"](dg:[\w:-]+)['"]/g;
    for (const f of srcFiles) {
      const src = await readFile(f, 'utf8');
      for (const m of src.matchAll(dispatchRe)) dispatched.add(m[1]);
      for (const m of src.matchAll(onRe)) listened.add(m[1]);
    }
    const missingListener = [...dispatched].filter(n => !listened.has(n));
    const missingDispatcher = [...listened].filter(n => !dispatched.has(n));
    expect(missingListener, 'events dispatched without listener').toEqual([]);
    expect(missingDispatcher, 'listeners for events never dispatched').toEqual([]);
  });

  it('every #id referenced by handlers is declared in markup', async () => {
    const handlerFiles = await walk(resolve(ROOT, 'src/ui/handlers')).catch(() => [] as string[]);
    const tabFiles = await walk(resolve(ROOT, 'src/ui/tabs'));
    const declared = new Set<string>();
    const tabIdRe = /id\s*=\s*["']([A-Za-z][\w-]*)["']/g;
    for (const f of [...tabFiles, resolve(ROOT, 'index.html')]) {
      const src = await readFile(f, 'utf8').catch(() => '');
      for (const m of src.matchAll(tabIdRe)) declared.add(m[1]);
    }
    const missingIds = new Set<string>();
    const refRe = /(?:qs|getElementById)\(\s*['"]#?([A-Za-z][\w-]*)['"]/g;
    for (const f of handlerFiles) {
      const src = await readFile(f, 'utf8');
      for (const m of src.matchAll(refRe)) {
        if (!declared.has(m[1])) missingIds.add(m[1]);
      }
    }
    expect([...missingIds], 'handler id refs missing from markup').toEqual([]);
  });
});
```

- [ ] **Step 2: Run — PASS early (no handlers yet, so both sets empty)**

```bash
pnpm vitest run tests/lint/wiring-gap.spec.ts
```
Expected: 2/2 PASS (empty set = empty set).

- [ ] **Step 3: Commit**

```bash
git add tests/lint/wiring-gap.spec.ts
git commit -m "test(lint): add gap-detector for event + id wiring"
```

---

## Batch 3 — State modules

Parallel. Depends on Batch 1 (uses `getDateStr` from Task 2).

### Task 9: User state

**Files:**
- Create: `src/state/user.ts`
- Test: `tests/unit/state-user.spec.ts`

- [ ] **Step 1: Define shape matching legacy**

Reference: `git show 9e82119^:daily-growth.html` lines 1803–1862 (`loadUserData`, `saveUser`, `updateGreeting`, `updateStreakBanner`, `checkAndUpdateStreak`, `recordActivity`).

- [ ] **Step 2: Write failing tests**

```ts
// tests/unit/state-user.spec.ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { loadUserData, saveUser, recordActivity, checkAndUpdateStreak } from '../../src/state/user';

describe('state/user', () => {
  beforeEach(() => localStorage.clear());

  it('loadUserData returns null when none saved', () => {
    expect(loadUserData()).toBeNull();
  });

  it('saveUser and loadUserData roundtrip', () => {
    const u = { name: 'H', interests: ['tech'], onboardedAt: '2026-04-19', streak: 0, lastActiveDate: '', xp: 0, level: 1 };
    saveUser(u);
    expect(loadUserData()).toEqual(u);
  });

  it('recordActivity increments xp and levels up per 100 xp', () => {
    saveUser({ name: 'H', interests: [], onboardedAt: '', streak: 0, lastActiveDate: '', xp: 90, level: 1 });
    recordActivity(20);
    const u = loadUserData()!;
    expect(u.xp).toBe(110);
    expect(u.level).toBe(2);
  });

  it('checkAndUpdateStreak bumps streak when last active was yesterday', () => {
    vi.setSystemTime(new Date('2026-04-19'));
    saveUser({ name: 'H', interests: [], onboardedAt: '', streak: 3, lastActiveDate: '2026-04-18', xp: 0, level: 1 });
    checkAndUpdateStreak();
    expect(loadUserData()!.streak).toBe(4);
  });

  it('checkAndUpdateStreak resets to 1 when last active older than 1 day', () => {
    vi.setSystemTime(new Date('2026-04-19'));
    saveUser({ name: 'H', interests: [], onboardedAt: '', streak: 3, lastActiveDate: '2026-04-15', xp: 0, level: 1 });
    checkAndUpdateStreak();
    expect(loadUserData()!.streak).toBe(1);
  });
});
```

- [ ] **Step 3: Run — FAIL**

- [ ] **Step 4: Implement**

```ts
// src/state/user.ts
import { getDateStr } from '../utils/dates';

export interface User {
  name: string;
  interests: string[];
  onboardedAt: string;
  streak: number;
  lastActiveDate: string;
  xp: number;
  level: number;
}

const KEY = 'user';

export function loadUserData(): User | null {
  const raw = localStorage.getItem(KEY);
  if (!raw) return null;
  try { return JSON.parse(raw) as User; } catch { return null; }
}

export function saveUser(u: User): void {
  localStorage.setItem(KEY, JSON.stringify(u));
}

export function recordActivity(xpDelta: number): void {
  const u = loadUserData();
  if (!u) return;
  u.xp += xpDelta;
  u.level = 1 + Math.floor(u.xp / 100);
  u.lastActiveDate = getDateStr();
  saveUser(u);
}

export function checkAndUpdateStreak(): void {
  const u = loadUserData();
  if (!u) return;
  const today = getDateStr();
  if (u.lastActiveDate === today) return;
  const y = new Date(today);
  y.setDate(y.getDate() - 1);
  const yesterday = getDateStr(y);
  u.streak = u.lastActiveDate === yesterday ? u.streak + 1 : 1;
  u.lastActiveDate = today;
  saveUser(u);
}

export function updateGreeting(rootId = 'greeting'): void {
  const el = document.getElementById(rootId);
  const u = loadUserData();
  if (!el || !u) return;
  const h = new Date().getHours();
  const period = h < 5 ? '늦은 밤' : h < 12 ? '좋은 아침' : h < 18 ? '좋은 오후' : '좋은 저녁';
  el.textContent = `${period}, ${u.name}`;
}

export function updateStreakBanner(rootId = 'streakBanner'): void {
  const el = document.getElementById(rootId);
  const u = loadUserData();
  if (!el || !u) return;
  el.textContent = u.streak > 0 ? `🔥 ${u.streak}일 연속 성장 중` : '오늘부터 다시 시작해봐요';
}
```

- [ ] **Step 5: Run — PASS**

- [ ] **Step 6: Commit**

```bash
git add src/state/user.ts tests/unit/state-user.spec.ts
git commit -m "feat(state): add user state (load/save/streak/xp/greeting)"
```

### Task 10: Answers state

**Files:**
- Create: `src/state/answers.ts`
- Test: `tests/unit/state-answers.spec.ts`

- [ ] **Step 1: Write tests**

```ts
// tests/unit/state-answers.spec.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { saveAnswer, listAnswers, findAnswer, setAnswerEvaluation, aggregateStats } from '../../src/state/answers';

describe('state/answers', () => {
  beforeEach(() => localStorage.clear());

  it('saveAnswer persists and returns id', () => {
    const id = saveAnswer({ date: '2026-04-19', questionId: 'q1', type: 'reflection', answer: 'text' });
    expect(id).toBeTruthy();
    expect(listAnswers()).toHaveLength(1);
  });

  it('setAnswerEvaluation attaches score/feedback', () => {
    const id = saveAnswer({ date: '2026-04-19', questionId: 'q1', type: 'reflection', answer: 'text' });
    setAnswerEvaluation(id, { score: 4, feedback: 'ok' });
    expect(findAnswer(id)?.evaluation).toEqual({ score: 4, feedback: 'ok' });
  });

  it('aggregateStats returns totals + weak-type pick', () => {
    saveAnswer({ date: '2026-04-19', questionId: 'q1', type: 'reflection', answer: 'a' });
    saveAnswer({ date: '2026-04-18', questionId: 'q2', type: 'action', answer: 'b' });
    saveAnswer({ date: '2026-04-17', questionId: 'q3', type: 'reflection', answer: 'c' });
    const s = aggregateStats();
    expect(s.total).toBe(3);
    expect(s.byType.reflection).toBe(2);
    expect(s.weakestType).toBe('action');
  });
});
```

- [ ] **Step 2: Run — FAIL**

- [ ] **Step 3: Implement**

```ts
// src/state/answers.ts
export interface Answer {
  id: string;
  date: string;
  questionId: string;
  type: string;
  answer: string;
  evaluation?: { score: number; feedback: string };
}

const KEY = 'answers';
const TYPES = ['reflection', 'action', 'observation', 'planning'] as const;

function read(): Answer[] {
  try { return JSON.parse(localStorage.getItem(KEY) ?? '[]') as Answer[]; } catch { return []; }
}
function write(list: Answer[]): void { localStorage.setItem(KEY, JSON.stringify(list)); }

export function saveAnswer(input: Omit<Answer, 'id'>): string {
  const id = `a_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const list = read();
  list.unshift({ ...input, id });
  write(list);
  return id;
}

export function listAnswers(): Answer[] { return read(); }

export function findAnswer(id: string): Answer | undefined {
  return read().find(a => a.id === id);
}

export function setAnswerEvaluation(id: string, evaluation: { score: number; feedback: string }): void {
  const list = read();
  const idx = list.findIndex(a => a.id === id);
  if (idx >= 0) { list[idx].evaluation = evaluation; write(list); }
}

export function aggregateStats(): { total: number; byType: Record<string, number>; weakestType: string } {
  const list = read();
  const byType: Record<string, number> = {};
  for (const t of TYPES) byType[t] = 0;
  for (const a of list) byType[a.type] = (byType[a.type] ?? 0) + 1;
  const weakestType = TYPES.reduce((min, t) => (byType[t] < byType[min] ? t : min), TYPES[0]);
  return { total: list.length, byType, weakestType };
}
```

- [ ] **Step 4: Run — PASS**

- [ ] **Step 5: Commit**

```bash
git add src/state/answers.ts tests/unit/state-answers.spec.ts
git commit -m "feat(state): add answers CRUD + evaluation + aggregate"
```

### Task 11: Briefings state

**Files:**
- Create: `src/state/briefings.ts`
- Test: `tests/unit/state-briefings.spec.ts`

- [ ] **Step 1: Write tests**

```ts
// tests/unit/state-briefings.spec.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { saveBriefings, loadBriefings, toggleScrap, setRead, saveMemo } from '../../src/state/briefings';

describe('state/briefings', () => {
  beforeEach(() => localStorage.clear());

  it('save/load roundtrip', () => {
    saveBriefings([{ id: 'b1', date: '2026-04-19', url: 'u', title: 't', summary: 's', scrapped: false, read: false, memo: '' }]);
    expect(loadBriefings()).toHaveLength(1);
  });
  it('toggleScrap flips the flag', () => {
    saveBriefings([{ id: 'b1', date: '2026-04-19', url: 'u', title: 't', summary: 's', scrapped: false, read: false, memo: '' }]);
    toggleScrap(0);
    expect(loadBriefings()[0].scrapped).toBe(true);
    toggleScrap(0);
    expect(loadBriefings()[0].scrapped).toBe(false);
  });
  it('setRead and saveMemo', () => {
    saveBriefings([{ id: 'b1', date: '2026-04-19', url: 'u', title: 't', summary: 's', scrapped: false, read: false, memo: '' }]);
    setRead(0);
    saveMemo(0, 'hello');
    const b = loadBriefings()[0];
    expect(b.read).toBe(true);
    expect(b.memo).toBe('hello');
  });
});
```

- [ ] **Step 2: Run — FAIL**

- [ ] **Step 3: Implement**

```ts
// src/state/briefings.ts
export interface Briefing {
  id: string; date: string; url: string; title: string; summary: string;
  scrapped: boolean; read: boolean; memo: string;
}

const KEY = 'briefings';

export function loadBriefings(): Briefing[] {
  try { return JSON.parse(localStorage.getItem(KEY) ?? '[]') as Briefing[]; } catch { return []; }
}
export function saveBriefings(list: Briefing[]): void {
  localStorage.setItem(KEY, JSON.stringify(list));
}

function mutate(index: number, fn: (b: Briefing) => void): void {
  const list = loadBriefings();
  if (!list[index]) return;
  fn(list[index]);
  saveBriefings(list);
}

export function toggleScrap(index: number): void { mutate(index, b => { b.scrapped = !b.scrapped; }); }
export function setRead(index: number): void { mutate(index, b => { b.read = true; }); }
export function saveMemo(index: number, memo: string): void { mutate(index, b => { b.memo = memo; }); }
```

- [ ] **Step 4: Run — PASS**

- [ ] **Step 5: Commit**

```bash
git add src/state/briefings.ts tests/unit/state-briefings.spec.ts
git commit -m "feat(state): add briefings persistence + scrap/read/memo mutators"
```

### Task 12: Chat state

**Files:**
- Create: `src/state/chat.ts`
- Test: `tests/unit/state-chat.spec.ts`

- [ ] **Step 1: Tests**

```ts
// tests/unit/state-chat.spec.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { loadChatHistory, saveChatHistory, appendChatMessage } from '../../src/state/chat';

describe('state/chat', () => {
  beforeEach(() => localStorage.clear());
  it('returns [] when empty', () => {
    expect(loadChatHistory('2026-04-19')).toEqual([]);
  });
  it('appendChatMessage writes to per-day key', () => {
    appendChatMessage('2026-04-19', { role: 'user', text: 'hi', at: 1 });
    appendChatMessage('2026-04-19', { role: 'ai', text: 'hello', at: 2 });
    expect(loadChatHistory('2026-04-19')).toHaveLength(2);
    expect(localStorage.getItem('chat_2026-04-19')).toContain('hello');
  });
});
```

- [ ] **Step 2: FAIL → Implement → PASS**

```ts
// src/state/chat.ts
export interface ChatMessage { role: 'user' | 'ai'; text: string; at: number; }

const prefix = (date: string) => `chat_${date}`;

export function loadChatHistory(date: string): ChatMessage[] {
  try { return JSON.parse(localStorage.getItem(prefix(date)) ?? '[]') as ChatMessage[]; } catch { return []; }
}
export function saveChatHistory(date: string, history: ChatMessage[]): void {
  localStorage.setItem(prefix(date), JSON.stringify(history));
}
export function appendChatMessage(date: string, msg: ChatMessage): void {
  const hist = loadChatHistory(date);
  hist.push(msg);
  saveChatHistory(date, hist);
}
```

- [ ] **Step 3: Commit**

```bash
git add src/state/chat.ts tests/unit/state-chat.spec.ts
git commit -m "feat(state): add per-day chat history persistence"
```

---

## Batch 4 — Services

Parallel. Depends on Batch 1.

### Task 13: RSS service

**Files:**
- Create: `src/services/rss.ts`
- Test: `tests/unit/rss.spec.ts`

Legacy reference: line 1229 (`rss` helper) + line 1864 (`loadBriefings` fetch logic) + line 1933 (`summarizeArticles`). Timeout 5s, backup feeds if empty.

- [ ] **Step 1: Tests**

```ts
// tests/unit/rss.spec.ts
import { describe, it, expect, vi, afterEach } from 'vitest';
import { fetchFeed } from '../../src/services/rss';

afterEach(() => vi.restoreAllMocks());

describe('services/rss', () => {
  it('returns items on 200', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ status: 'ok', items: [{ title: 't', link: 'u', description: 'd', pubDate: '2026-04-19' }] }),
    }));
    const res = await fetchFeed('https://example.com/feed');
    expect(res).toHaveLength(1);
    expect(res[0].title).toBe('t');
  });
  it('returns [] on timeout (controller abort)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockImplementation(() => new Promise((_, rej) => setTimeout(() => rej(new Error('aborted')), 10))));
    const res = await fetchFeed('https://example.com/feed', { timeoutMs: 5 });
    expect(res).toEqual([]);
  });
  it('returns [] on non-ok', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, json: async () => ({}) }));
    expect(await fetchFeed('x')).toEqual([]);
  });
});
```

- [ ] **Step 2: Implement**

```ts
// src/services/rss.ts
export interface FeedItem { title: string; link: string; description: string; pubDate: string; }

export async function fetchFeed(feedUrl: string, opts: { timeoutMs?: number } = {}): Promise<FeedItem[]> {
  const controller = new AbortController();
  const to = setTimeout(() => controller.abort(), opts.timeoutMs ?? 5000);
  try {
    const u = `https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(feedUrl)}`;
    const r = await fetch(u, { signal: controller.signal });
    if (!r.ok) return [];
    const data = await r.json() as { items?: FeedItem[] };
    return Array.isArray(data.items) ? data.items : [];
  } catch {
    return [];
  } finally {
    clearTimeout(to);
  }
}
```

- [ ] **Step 3: PASS → Commit**

```bash
git add src/services/rss.ts tests/unit/rss.spec.ts
git commit -m "feat(services): add rss2json fetcher with timeout"
```

### Task 14: Gemini service extensions

**Files:**
- Modify: `src/services/gemini.ts`
- Test: add cases to `src/services/gemini.spec.ts`

- [ ] **Step 1: Read current gemini.ts and identify single-call helper**

```bash
cat src/services/gemini.ts
```

- [ ] **Step 2: Add tests for new methods**

```ts
// src/services/gemini.spec.ts (append)
import { generateQuestion, chat, evaluateAnswer } from './gemini';

describe('gemini extensions', () => {
  it('generateQuestion parses JSON text from candidates', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ candidates: [{ content: { parts: [{ text: '{"type":"reflection","question":"Q?","hint":"H"}' }] } }] }),
    }));
    const q = await generateQuestion('apiKey', ['tech'], 'reflection');
    expect(q.question).toBe('Q?');
    expect(q.type).toBe('reflection');
  });

  it('chat returns plain text reply', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ candidates: [{ content: { parts: [{ text: '답변입니다' }] } }] }),
    }));
    const reply = await chat('apiKey', [{ role: 'user', text: 'hi' }]);
    expect(reply).toBe('답변입니다');
  });

  it('evaluateAnswer parses JSON score + feedback', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ candidates: [{ content: { parts: [{ text: '{"score":4,"feedback":"ok"}' }] } }] }),
    }));
    const e = await evaluateAnswer('apiKey', 'Q', 'A');
    expect(e).toEqual({ score: 4, feedback: 'ok' });
  });
});
```

- [ ] **Step 3: Implement (add to gemini.ts)**

```ts
// src/services/gemini.ts (append)
const MODEL = 'gemini-2.0-flash-lite';

async function call(apiKey: string, prompt: string): Promise<string> {
  const u = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${encodeURIComponent(apiKey)}`;
  const r = await fetch(u, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
  });
  if (!r.ok) throw new Error(`gemini ${r.status}`);
  const data = await r.json() as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> };
  return data.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
}

function parseJsonText<T>(text: string): T {
  const m = text.match(/\{[\s\S]*\}/);
  if (!m) throw new Error('no json object');
  const cleaned = m[0].replace(/[\u0000-\u001F]/g, '').replace(/,\s*([}\]])/g, '$1');
  return JSON.parse(cleaned) as T;
}

export interface QuestionOut { type: string; question: string; hint: string; }
export async function generateQuestion(apiKey: string, interests: string[], preferType: string): Promise<QuestionOut> {
  const prompt = `관심사: ${interests.join(', ')}. 오늘의 질문을 JSON으로 반환: {"type":"${preferType}","question":"...","hint":"..."}`;
  return parseJsonText<QuestionOut>(await call(apiKey, prompt));
}

export interface ChatTurn { role: 'user' | 'ai'; text: string; }
export async function chat(apiKey: string, turns: ChatTurn[]): Promise<string> {
  const prompt = turns.map(t => `${t.role === 'user' ? '사용자' : 'AI'}: ${t.text}`).join('\n') + '\nAI:';
  return call(apiKey, prompt);
}

export async function evaluateAnswer(apiKey: string, question: string, answer: string): Promise<{ score: number; feedback: string }> {
  const prompt = `질문: ${question}\n답변: ${answer}\n1-5점 평가와 한 문장 피드백을 JSON으로: {"score":N,"feedback":"..."}`;
  return parseJsonText(await call(apiKey, prompt));
}
```

- [ ] **Step 4: PASS → Commit**

```bash
git add src/services/gemini.ts src/services/gemini.spec.ts
git commit -m "feat(services): add generateQuestion/chat/evaluateAnswer to gemini"
```

---

## Batch 5 — Onboarding + Handlers + Smoke

Parallel. Depends on Batches 3+4.

Each of Tasks 15–21 commits both the handler/module AND its Playwright smoke in the SAME commit. **This is the primary defense against Phase D recurrence.**

### Task 15: Onboarding flow + smoke

**Files:**
- Create: `src/ui/onboarding.ts`
- Create: `tests/smoke/onboarding.spec.ts`
- Modify: `src/main.ts` (only the onboarding route check; full bootstrap is Task 22)

Legacy ref: lines 1676–1802 (`initApp`, `initTheme`, `renderInterestGrid`, `toggleInterest`, `goToStep`, `testApiKey`, `completeOnboarding`).

- [ ] **Step 1: Implement `src/ui/onboarding.ts`**

```ts
// src/ui/onboarding.ts
import { INTERESTS } from '../utils/categories';
import { saveUser, loadUserData } from '../state/user';
import { escapeHtml } from '../utils/escapeHtml';
import { qs, on as domOn } from '../utils/dom';

type Step = 1 | 2 | 3;

export function startOnboarding(rootId = 'onboarding'): void {
  const root = document.getElementById(rootId);
  if (!root) return;
  let step: Step = 1;
  let picked = new Set<string>();
  render();

  function render(): void {
    if (step === 1) renderStep1();
    else if (step === 2) renderStep2();
    else renderStep3();
  }

  function renderStep1(): void {
    root!.replaceChildren();
    const h = document.createElement('h2'); h.textContent = '관심 분야를 선택해 주세요 (2개 이상)';
    const grid = document.createElement('div'); grid.className = 'interest-grid';
    for (const i of INTERESTS) {
      const btn = document.createElement('button');
      btn.type = 'button'; btn.className = 'interest-chip'; btn.dataset.id = i.id;
      btn.textContent = `${i.emoji} ${i.label}`;
      btn.addEventListener('click', () => { picked.has(i.id) ? picked.delete(i.id) : picked.add(i.id); btn.classList.toggle('selected'); });
      grid.append(btn);
    }
    const next = document.createElement('button'); next.textContent = '다음'; next.id = 'obNext';
    next.addEventListener('click', () => { if (picked.size >= 2) { step = 2; render(); } });
    root!.append(h, grid, next);
  }

  function renderStep2(): void {
    root!.replaceChildren();
    const h = document.createElement('h2'); h.textContent = 'Gemini API 키 입력';
    const input = document.createElement('input'); input.id = 'obApiKey'; input.type = 'password'; input.placeholder = 'AIza…';
    const status = document.createElement('div'); status.id = 'obKeyStatus';
    const test = document.createElement('button'); test.textContent = '키 테스트'; test.id = 'obKeyTest';
    const next = document.createElement('button'); next.textContent = '완료'; next.id = 'obComplete'; next.disabled = true;
    test.addEventListener('click', async () => {
      const ok = await testApiKey(input.value);
      status.textContent = ok ? '✅ 유효합니다' : '❌ 다시 확인해 주세요';
      next.disabled = !ok;
      if (ok) localStorage.setItem('dg_gemini_key', input.value);
    });
    next.addEventListener('click', () => { step = 3; render(); });
    root!.append(h, input, test, status, next);
  }

  function renderStep3(): void {
    const name = loadUserData()?.name ?? 'Hayden';
    saveUser({ name, interests: [...picked], onboardedAt: new Date().toISOString().slice(0, 10), streak: 0, lastActiveDate: '', xp: 0, level: 1 });
    window.dispatchEvent(new CustomEvent('dg:onboarded'));
  }
}

export async function testApiKey(key: string): Promise<boolean> {
  if (!key) return false;
  try {
    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-lite:generateContent?key=${encodeURIComponent(key)}`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ contents: [{ parts: [{ text: 'ping' }] }] }),
    });
    return r.ok;
  } catch { return false; }
}
```

- [ ] **Step 2: Playwright smoke**

```ts
// tests/smoke/onboarding.spec.ts
import { test, expect } from '@playwright/test';
import { mockExternalApis } from '../helpers/mockApi';

test('new user completes onboarding and lands on home', async ({ page }) => {
  await mockExternalApis(page);
  await page.addInitScript(() => localStorage.clear());
  await page.goto('/');

  // Step 1: pick 2 interests
  const chips = page.locator('.interest-chip');
  await expect(chips.first()).toBeVisible();
  await chips.nth(0).click();
  await chips.nth(1).click();
  await page.locator('#obNext').click();

  // Step 2: api key
  await page.locator('#obApiKey').fill('AIza_TEST_KEY');
  await page.locator('#obKeyTest').click();
  await expect(page.locator('#obKeyStatus')).toContainText('유효');
  await page.locator('#obComplete').click();

  // landed on home
  await expect(page.locator('[data-tab="home"]')).toBeVisible();
  const user = await page.evaluate(() => JSON.parse(localStorage.getItem('user') ?? 'null'));
  expect(user?.interests?.length).toBeGreaterThanOrEqual(2);
});
```

- [ ] **Step 3: Run vitest + playwright → PASS**

```bash
pnpm vitest run && pnpm build && pnpm playwright test tests/smoke/onboarding.spec.ts
```

- [ ] **Step 4: Commit**

```bash
git add src/ui/onboarding.ts tests/smoke/onboarding.spec.ts
git commit -m "feat(onboarding): restore 3-step onboarding flow + smoke"
```

### Task 16: Home handlers — briefings + smoke

**Files:**
- Create: `src/ui/handlers/home.ts` (briefings events only in this task)
- Create: `tests/smoke/briefings.spec.ts`

Legacy ref: lines 1864–2098 (loadBriefings, summarizeArticles, renderBriefings, toggleScrap, markBriefingRead, toggleMemo, saveMemo).

- [ ] **Step 1: Implement briefings portion of handlers/home.ts**

```ts
// src/ui/handlers/home.ts
import { on } from '../events';
import { escapeHtml } from '../../utils/escapeHtml';
import { loadBriefings, saveBriefings, toggleScrap, setRead, saveMemo } from '../../state/briefings';
import { fetchFeed } from '../../services/rss';
import { loadUserData } from '../../state/user';
import { getDateStr } from '../../utils/dates';

const FEEDS_BY_INTEREST: Record<string, string[]> = {
  business: ['https://www.wanted.co.kr/events/tech/rss'],
  tech: ['https://techblog.woowahan.com/feed/'],
  design: ['https://brunch.co.kr/rss/magazine-design'],
  growth: ['https://blog.usepanda.com/feed/'],
  leadership: ['https://hbr.org/feed'],
  communication: ['https://www.mindful.org/feed/'],
  // 기타 interest id ↔ feed url 매핑 유지
};

export function mountHomeHandlers(): void {
  on('dg:home:refresh-briefings', () => void refreshBriefings());
  on('dg:home:toggle-scrap', ({ index }) => { toggleScrap(index); renderBriefings(); });
  on('dg:home:mark-read', ({ index }) => { setRead(index); renderBriefings(); });
  on('dg:home:toggle-memo', ({ index }) => { const el = document.getElementById(`memoBox-${index}`); el?.classList.toggle('hidden'); });
  on('dg:home:save-memo', ({ index, memo }) => { saveMemo(index, memo); renderBriefings(); });
}

async function refreshBriefings(): Promise<void> {
  const u = loadUserData();
  if (!u) return;
  const today = getDateStr();
  const feeds = u.interests.flatMap(i => FEEDS_BY_INTEREST[i] ?? []);
  const out = [];
  for (const url of feeds.slice(0, 5)) {
    const items = await fetchFeed(url, { timeoutMs: 5000 });
    for (const it of items.slice(0, 1)) {
      out.push({ id: `b_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`, date: today, url: it.link, title: it.title, summary: stripTags(it.description).slice(0, 180), scrapped: false, read: false, memo: '' });
    }
  }
  saveBriefings(out);
  renderBriefings();
}

function stripTags(s: string): string { return s.replace(/<[^>]*>/g, '').trim(); }

export function renderBriefings(rootId = 'briefingsList'): void {
  const root = document.getElementById(rootId);
  if (!root) return;
  root.replaceChildren();
  const list = loadBriefings();
  if (list.length === 0) {
    const empty = document.createElement('div'); empty.textContent = '관심 분야 기사를 불러오는 중…';
    root.append(empty);
    return;
  }
  list.forEach((b, i) => root.append(renderCard(b, i)));
}

function renderCard(b: ReturnType<typeof loadBriefings>[number], i: number): HTMLElement {
  const card = document.createElement('article'); card.className = 'briefing-card';
  const title = document.createElement('a'); title.href = b.url; title.target = '_blank'; title.rel = 'noopener'; title.textContent = b.title;
  const sum = document.createElement('p'); sum.textContent = b.summary;
  const scrap = document.createElement('button'); scrap.textContent = b.scrapped ? '⭐ 스크랩됨' : '☆ 스크랩';
  scrap.addEventListener('click', () => window.dispatchEvent(new CustomEvent('dg:home:toggle-scrap', { detail: { index: i } })));
  const memoBtn = document.createElement('button'); memoBtn.textContent = '메모';
  memoBtn.addEventListener('click', () => window.dispatchEvent(new CustomEvent('dg:home:toggle-memo', { detail: { index: i } })));
  const memoBox = document.createElement('div'); memoBox.id = `memoBox-${i}`; memoBox.className = b.memo ? '' : 'hidden';
  const memoInput = document.createElement('textarea'); memoInput.value = b.memo;
  const memoSave = document.createElement('button'); memoSave.textContent = '저장';
  memoSave.addEventListener('click', () => window.dispatchEvent(new CustomEvent('dg:home:save-memo', { detail: { index: i, memo: memoInput.value } })));
  memoBox.append(memoInput, memoSave);
  card.append(title, sum, scrap, memoBtn, memoBox);
  return card;
}
```

- [ ] **Step 2: Smoke**

```ts
// tests/smoke/briefings.spec.ts
import { test, expect } from '@playwright/test';
import { mockExternalApis, seedLocalStorage } from '../helpers/mockApi';

test('refresh → 3 cards render, scrap persists, memo saves', async ({ page }) => {
  await mockExternalApis(page);
  await seedLocalStorage(page, {
    user: { name: 'H', interests: ['tech','business'], onboardedAt: '2026-04-01', streak: 0, lastActiveDate: '', xp: 0, level: 1 },
    dg_gemini_key: 'AIza_TEST',
  });
  await page.goto('/');

  await page.locator('[data-tab="home"]').click();
  await page.locator('#refreshBriefingsBtn').click();
  const cards = page.locator('.briefing-card');
  await expect(cards).toHaveCount(3, { timeout: 10_000 });

  // scrap
  await cards.nth(0).locator('button', { hasText: '스크랩' }).click();
  await expect(cards.nth(0).locator('button', { hasText: '스크랩됨' })).toBeVisible();
  const scrapped = await page.evaluate(() => JSON.parse(localStorage.getItem('briefings') ?? '[]')[0].scrapped);
  expect(scrapped).toBe(true);

  // memo
  await cards.nth(0).locator('button', { hasText: '메모' }).click();
  await cards.nth(0).locator('textarea').fill('test-memo');
  await cards.nth(0).locator('button', { hasText: '저장' }).click();
  const memo = await page.evaluate(() => JSON.parse(localStorage.getItem('briefings') ?? '[]')[0].memo);
  expect(memo).toBe('test-memo');
});
```

- [ ] **Step 3: Ensure tabs/home.ts exposes required markup**

Open `src/ui/tabs/home.ts` and confirm the home markup contains (add if missing — keep inside the existing home section container):

```ts
// inside the tabs/home.ts render function, within the briefings section
const briefingsSection = document.createElement('section');
briefingsSection.id = 'briefingsSection';

const refreshBtn = document.createElement('button');
refreshBtn.id = 'refreshBriefingsBtn';
refreshBtn.textContent = '새로고침';
refreshBtn.addEventListener('click', () =>
  window.dispatchEvent(new CustomEvent('dg:home:refresh-briefings')),
);

const list = document.createElement('div');
list.id = 'briefingsList';

briefingsSection.append(refreshBtn, list);
// ...append briefingsSection to the home root
```

- [ ] **Step 4: Run smoke**

```bash
pnpm vitest run && pnpm build && pnpm playwright test tests/smoke/briefings.spec.ts
```

- [ ] **Step 4: Commit**

```bash
git add src/ui/handlers/home.ts src/ui/tabs/home.ts tests/smoke/briefings.spec.ts
git commit -m "feat(home): restore briefings fetch/scrap/memo wiring + smoke"
```

### Task 17: Home handlers — question + answer + chat + smoke

**Files:**
- Modify: `src/ui/handlers/home.ts` (add question/answer/chat mount + logic)
- Create: `tests/smoke/question-flow.spec.ts`

Legacy ref: lines 2100–2468 (`loadTodayQuestion`, `selectAdaptiveQuestionType`, `renderQuestion`, `submitAnswer`, `getAIFeedback`, `sendChatMessage`, `addChatBubble`, `evaluateAnswerQuality`, `saveChatHistory`, `loadChatHistory`).

- [ ] **Step 1: Extend handlers/home.ts**

```ts
// src/ui/handlers/home.ts (append)
import { generateQuestion, chat as geminiChat, evaluateAnswer } from '../../services/gemini';
import { saveAnswer, setAnswerEvaluation, aggregateStats } from '../../state/answers';
import { appendChatMessage, loadChatHistory } from '../../state/chat';
import { recordActivity } from '../../state/user';

export function mountHomeQuestionHandlers(): void {
  on('dg:home:submit-answer', ({ text }) => void handleSubmit(text));
  on('dg:home:chat-send', ({ text }) => void handleChatSend(text));
  on('dg:home:reload-question', () => void loadTodayQuestion());
  on('dg:home:toggle-hint', () => { document.getElementById('questionHint')?.classList.toggle('hidden'); });
  on('dg:home:char-count-change', ({ length }) => { const el = document.getElementById('charCount'); if (el) el.textContent = String(length); });
}

export async function loadTodayQuestion(): Promise<void> {
  const content = document.getElementById('questionContent');
  const u = loadUserData();
  const key = localStorage.getItem('dg_gemini_key');
  if (!content || !u || !key) { if (content) content.textContent = '먼저 설정에서 API 키를 입력하세요.'; return; }
  const stats = aggregateStats();
  const preferType = stats.weakestType;
  try {
    const q = await generateQuestion(key, u.interests, preferType);
    content.dataset.questionId = `q_${Date.now()}`;
    content.dataset.type = q.type;
    content.textContent = q.question;
    const hint = document.getElementById('questionHint'); if (hint) hint.textContent = q.hint;
  } catch {
    content.textContent = renderFallbackQuestion(preferType);
  }
}

function renderFallbackQuestion(type: string): string {
  const map: Record<string, string> = {
    reflection: '오늘 하루 중 가장 깊이 느낀 순간은 언제였나요?',
    action: '내일 한 가지 실험한다면 무엇을 바꿔보시겠어요?',
    observation: '최근 일주일 새로 알아차린 것이 있나요?',
    planning: '이번 주말 가장 집중할 일 하나는 무엇인가요?',
  };
  return map[type] ?? map.reflection;
}

async function handleSubmit(text: string): Promise<void> {
  const content = document.getElementById('questionContent');
  const qId = content?.dataset.questionId ?? 'q_unknown';
  const type = content?.dataset.type ?? 'reflection';
  const id = saveAnswer({ date: getDateStr(), questionId: qId, type, answer: text });
  recordActivity(10);
  const key = localStorage.getItem('dg_gemini_key') ?? '';
  const feedback = await geminiChat(key, [{ role: 'user', text: `질문: ${content?.textContent ?? ''}\n답변: ${text}\n짧은 피드백을 한국어로:` }]);
  addChatBubble('ai', feedback);
  appendChatMessage(getDateStr(), { role: 'ai', text: feedback, at: Date.now() });
  // background evaluation
  void evaluateAnswer(key, content?.textContent ?? '', text).then(ev => setAnswerEvaluation(id, ev)).catch(() => {});
}

async function handleChatSend(text: string): Promise<void> {
  addChatBubble('user', text);
  appendChatMessage(getDateStr(), { role: 'user', text, at: Date.now() });
  const key = localStorage.getItem('dg_gemini_key') ?? '';
  const hist = loadChatHistory(getDateStr()).map(m => ({ role: m.role, text: m.text }));
  const reply = await geminiChat(key, hist);
  addChatBubble('ai', reply);
  appendChatMessage(getDateStr(), { role: 'ai', text: reply, at: Date.now() });
}

function addChatBubble(role: 'user' | 'ai', text: string): void {
  const chat = document.getElementById('chatArea');
  if (!chat) return;
  const b = document.createElement('div');
  b.className = `bubble bubble-${role}`;
  b.textContent = text;
  chat.append(b);
  chat.scrollTop = chat.scrollHeight;
}
```

- [ ] **Step 2: Smoke**

```ts
// tests/smoke/question-flow.spec.ts
import { test, expect } from '@playwright/test';
import { mockExternalApis, seedLocalStorage } from '../helpers/mockApi';

test('question → answer submit → AI feedback → follow-up', async ({ page }) => {
  await mockExternalApis(page);
  await seedLocalStorage(page, {
    user: { name: 'H', interests: ['tech'], onboardedAt: '2026-04-01', streak: 0, lastActiveDate: '', xp: 0, level: 1 },
    dg_gemini_key: 'AIza_TEST',
  });
  await page.goto('/');

  await expect(page.locator('#questionContent')).toContainText(/.+/, { timeout: 10_000 });

  await page.locator('#answerInput').fill('오늘은 1:1에서 비언어 단서를 더 적극적으로 살폈다. 듣는 데 시간을 많이 썼고 맥락을 더 정확히 잡았다.');
  await page.locator('#submitAnswerBtn').click();
  await expect(page.locator('.bubble-ai')).toHaveCount(1, { timeout: 10_000 });

  await page.locator('#chatInput').fill('더 구체적인 예시가 궁금해요');
  await page.locator('#chatSendBtn').click();
  await expect(page.locator('.bubble-user')).toHaveCount(1);
  await expect(page.locator('.bubble-ai')).toHaveCount(2, { timeout: 10_000 });

  const answers = await page.evaluate(() => JSON.parse(localStorage.getItem('answers') ?? '[]'));
  expect(answers.length).toBe(1);
});
```

- [ ] **Step 3: Ensure tabs/home.ts exposes required markup for question/answer/chat**

Confirm (add if missing) inside `src/ui/tabs/home.ts`:

```ts
// question section
const q = document.createElement('section');
const qContent = document.createElement('div'); qContent.id = 'questionContent';
const qHint = document.createElement('div'); qHint.id = 'questionHint'; qHint.className = 'hidden';
const hintBtn = document.createElement('button'); hintBtn.textContent = '힌트';
hintBtn.addEventListener('click', () =>
  window.dispatchEvent(new CustomEvent('dg:home:toggle-hint')),
);
const reloadBtn = document.createElement('button'); reloadBtn.textContent = '새 질문';
reloadBtn.addEventListener('click', () =>
  window.dispatchEvent(new CustomEvent('dg:home:reload-question')),
);
q.append(qContent, qHint, hintBtn, reloadBtn);

// answer section
const aSec = document.createElement('section');
const answerInput = document.createElement('textarea'); answerInput.id = 'answerInput';
const charCount = document.createElement('span'); charCount.id = 'charCount'; charCount.textContent = '0';
answerInput.addEventListener('input', () =>
  window.dispatchEvent(new CustomEvent('dg:home:char-count-change', { detail: { length: answerInput.value.length } })),
);
const submit = document.createElement('button'); submit.id = 'submitAnswerBtn'; submit.textContent = '제출';
submit.addEventListener('click', () =>
  window.dispatchEvent(new CustomEvent('dg:home:submit-answer', { detail: { text: answerInput.value } })),
);
aSec.append(answerInput, charCount, submit);

// chat section
const cSec = document.createElement('section');
const chatArea = document.createElement('div'); chatArea.id = 'chatArea';
const chatInput = document.createElement('input'); chatInput.id = 'chatInput';
const chatSend = document.createElement('button'); chatSend.id = 'chatSendBtn'; chatSend.textContent = '전송';
chatSend.addEventListener('click', () => {
  const text = chatInput.value.trim(); if (!text) return;
  window.dispatchEvent(new CustomEvent('dg:home:chat-send', { detail: { text } }));
  chatInput.value = '';
});
cSec.append(chatArea, chatInput, chatSend);
// ...append q, aSec, cSec to the home root
```

- [ ] **Step 4: Run smoke**

```bash
pnpm build && pnpm playwright test tests/smoke/question-flow.spec.ts
```

- [ ] **Step 5: Commit**

```bash
git add src/ui/handlers/home.ts src/ui/tabs/home.ts tests/smoke/question-flow.spec.ts
git commit -m "feat(home): restore question/answer/chat wiring + smoke"
```

### Task 18: Archive handlers + smoke

**Files:**
- Create: `src/ui/handlers/archive.ts`
- Create: `tests/smoke/archive.spec.ts`

Legacy ref: lines 2840–2984.

- [ ] **Step 1: Implement**

```ts
// src/ui/handlers/archive.ts
import { on } from '../events';
import { listAnswers } from '../../state/answers';
import { getCategoryLabel } from '../../utils/categories';

export function mountArchiveHandlers(): void {
  on('dg:archive:filter', ({ filter }) => renderList(filter));
  on('dg:archive:search', ({ query }) => renderList(currentFilter, query));
  on('dg:archive:open-detail', ({ date }) => openDetail(date));
}

let currentFilter = 'all';

function renderList(filter: string = 'all', query: string = ''): void {
  currentFilter = filter;
  const root = document.getElementById('archiveList');
  if (!root) return;
  root.replaceChildren();
  let items = listAnswers();
  if (filter !== 'all') items = items.filter(a => a.type === filter);
  if (query) items = items.filter(a => a.answer.toLowerCase().includes(query.toLowerCase()));
  if (items.length === 0) {
    const empty = document.createElement('div'); empty.textContent = '저장된 답변이 없어요.';
    root.append(empty);
    return;
  }
  for (const a of items) {
    const card = document.createElement('article'); card.className = 'archive-card'; card.dataset.date = a.date;
    const meta = document.createElement('div'); meta.className = 'archive-meta';
    meta.textContent = `${a.date} · ${getCategoryLabel(a.type)}`;
    const body = document.createElement('p'); body.textContent = a.answer.slice(0, 120);
    card.addEventListener('click', () => window.dispatchEvent(new CustomEvent('dg:archive:open-detail', { detail: { date: a.date } })));
    card.append(meta, body);
    root.append(card);
  }
}

function openDetail(date: string): void {
  const overlay = document.getElementById('modalOverlay');
  const modal = document.getElementById('archiveDetailModal');
  if (!overlay || !modal) return;
  const items = listAnswers().filter(a => a.date === date);
  modal.replaceChildren();
  const h = document.createElement('h3'); h.textContent = date;
  modal.append(h);
  for (const a of items) {
    const p = document.createElement('p'); p.textContent = a.answer;
    modal.append(p);
  }
  overlay.classList.add('show');
  modal.classList.add('show');
}

export function renderArchiveInitial(): void { renderList('all'); }
```

- [ ] **Step 2: Smoke**

```ts
// tests/smoke/archive.spec.ts
import { test, expect } from '@playwright/test';
import { mockExternalApis, seedLocalStorage } from '../helpers/mockApi';

test('archive filter + search + detail modal', async ({ page }) => {
  await mockExternalApis(page);
  await seedLocalStorage(page, {
    user: { name: 'H', interests: ['tech'], onboardedAt: '2026-04-01', streak: 0, lastActiveDate: '', xp: 0, level: 1 },
    dg_gemini_key: 'AIza_TEST',
    answers: [
      { id: 'a1', date: '2026-04-18', questionId: 'q', type: 'reflection', answer: '성찰 테스트 하나' },
      { id: 'a2', date: '2026-04-17', questionId: 'q', type: 'action', answer: '행동 테스트 둘' },
      { id: 'a3', date: '2026-04-16', questionId: 'q', type: 'reflection', answer: '성찰 테스트 셋' },
    ],
  });
  await page.goto('/');
  await page.locator('[data-tab="archive"]').click();
  await expect(page.locator('.archive-card')).toHaveCount(3);

  await page.locator('[data-filter="action"]').click();
  await expect(page.locator('.archive-card')).toHaveCount(1);

  await page.locator('[data-filter="all"]').click();
  await page.locator('#archiveSearch').fill('하나');
  await expect(page.locator('.archive-card')).toHaveCount(1);

  await page.locator('#archiveSearch').fill('');
  await page.locator('.archive-card').first().click();
  await expect(page.locator('#archiveDetailModal.show')).toBeVisible();
});
```

- [ ] **Step 3: Adjust `src/ui/tabs/archive.ts` to dispatch filter + search events**

Confirm (add if missing):

```ts
// archive filter chips
const FILTERS = [
  { id: 'all', label: '전체' },
  { id: 'reflection', label: '성찰' },
  { id: 'action', label: '행동' },
  { id: 'observation', label: '관찰' },
  { id: 'planning', label: '계획' },
];
const chipBar = document.createElement('div'); chipBar.className = 'filter-bar';
for (const f of FILTERS) {
  const btn = document.createElement('button');
  btn.className = 'filter-chip'; btn.dataset.filter = f.id; btn.textContent = f.label;
  btn.addEventListener('click', () =>
    window.dispatchEvent(new CustomEvent('dg:archive:filter', { detail: { filter: f.id } })),
  );
  chipBar.append(btn);
}

// search
const searchInput = document.createElement('input'); searchInput.id = 'archiveSearch'; searchInput.type = 'search';
searchInput.addEventListener('input', () =>
  window.dispatchEvent(new CustomEvent('dg:archive:search', { detail: { query: searchInput.value } })),
);

// list container
const list = document.createElement('div'); list.id = 'archiveList';
// ...append chipBar, searchInput, list to the archive root
```

- [ ] **Step 4: Run smoke**

```bash
pnpm build && pnpm playwright test tests/smoke/archive.spec.ts
```

- [ ] **Step 5: Commit**

```bash
git add src/ui/handlers/archive.ts src/ui/tabs/archive.ts tests/smoke/archive.spec.ts
git commit -m "feat(archive): restore filter/search/detail wiring + smoke"
```

### Task 19: Stats handlers + smoke

**Files:**
- Create: `src/ui/handlers/stats.ts`
- Create: `tests/smoke/stats.spec.ts`

Legacy ref: lines 2987–3192.

- [ ] **Step 1: Implement**

```ts
// src/ui/handlers/stats.ts
import { on } from '../events';
import { listAnswers, aggregateStats } from '../../state/answers';
import { loadUserData } from '../../state/user';

export function mountStatsHandlers(): void {
  on('dg:stats:refresh', () => renderAll());
  on('dg:stats:open-day-detail', ({ date }) => showDayDetail(date));
}

export function renderAll(): void { renderLevel(); renderHeatmap(); renderBadges(); }

function renderLevel(): void {
  const el = document.getElementById('levelCard');
  const u = loadUserData();
  const s = aggregateStats();
  if (!el || !u) return;
  el.replaceChildren();
  const h = document.createElement('h3'); h.textContent = `Level ${u.level}`;
  const meta = document.createElement('p'); meta.textContent = `총 답변 ${s.total}개 · 스트릭 ${u.streak}일 · XP ${u.xp}`;
  el.append(h, meta);
}

function renderHeatmap(): void {
  const root = document.getElementById('heatmap');
  if (!root) return;
  root.replaceChildren();
  const days = listAnswers().reduce<Record<string, number>>((acc, a) => { acc[a.date] = (acc[a.date] ?? 0) + 1; return acc; }, {});
  const today = new Date();
  for (let i = 83; i >= 0; i--) {
    const d = new Date(today); d.setDate(today.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    const cell = document.createElement('button');
    cell.className = `heatmap-cell level-${Math.min(4, days[key] ?? 0)}`;
    cell.dataset.date = key;
    cell.title = `${key} · ${days[key] ?? 0}개`;
    cell.addEventListener('click', () => window.dispatchEvent(new CustomEvent('dg:stats:open-day-detail', { detail: { date: key } })));
    root.append(cell);
  }
}

function renderBadges(): void {
  const root = document.getElementById('badgeRow');
  if (!root) return;
  root.replaceChildren();
  const u = loadUserData(); if (!u) return;
  const s = aggregateStats();
  const earned: string[] = [];
  if (s.total >= 1) earned.push('🌱 첫 답변');
  if (s.total >= 10) earned.push('📚 10개 돌파');
  if (u.streak >= 7) earned.push('🔥 7일 스트릭');
  if (u.level >= 5) earned.push('⭐ Level 5');
  for (const b of earned) {
    const span = document.createElement('span'); span.className = 'badge'; span.textContent = b;
    root.append(span);
  }
}

function showDayDetail(date: string): void {
  const overlay = document.getElementById('modalOverlay');
  const modal = document.getElementById('dayDetailModal');
  if (!overlay || !modal) return;
  modal.replaceChildren();
  const h = document.createElement('h3'); h.textContent = date;
  const list = listAnswers().filter(a => a.date === date);
  modal.append(h);
  if (list.length === 0) {
    const p = document.createElement('p'); p.textContent = '이 날은 답변이 없어요.';
    modal.append(p);
  } else {
    for (const a of list) {
      const p = document.createElement('p'); p.textContent = a.answer;
      modal.append(p);
    }
  }
  overlay.classList.add('show');
  modal.classList.add('show');
}
```

- [ ] **Step 2: Smoke**

```ts
// tests/smoke/stats.spec.ts
import { test, expect } from '@playwright/test';
import { mockExternalApis, seedLocalStorage } from '../helpers/mockApi';

test('stats level + heatmap + day detail modal', async ({ page }) => {
  await mockExternalApis(page);
  await seedLocalStorage(page, {
    user: { name: 'H', interests: ['tech'], onboardedAt: '2026-04-01', streak: 3, lastActiveDate: '2026-04-18', xp: 220, level: 3 },
    dg_gemini_key: 'AIza_TEST',
    answers: [
      { id: 'a1', date: '2026-04-18', questionId: 'q', type: 'reflection', answer: 'x' },
      { id: 'a2', date: '2026-04-17', questionId: 'q', type: 'action', answer: 'y' },
    ],
  });
  await page.goto('/');
  await page.locator('[data-tab="stats"]').click();
  await expect(page.locator('#levelCard')).toContainText('Level 3');
  await expect(page.locator('.heatmap-cell.level-1')).toHaveCount(2);
  await expect(page.locator('.badge', { hasText: '첫 답변' })).toBeVisible();

  // click a filled cell
  await page.locator('.heatmap-cell.level-1').first().click();
  await expect(page.locator('#dayDetailModal.show')).toBeVisible();
});
```

- [ ] **Step 3: Commit**

```bash
git add src/ui/handlers/stats.ts src/ui/tabs/stats.ts tests/smoke/stats.spec.ts
git commit -m "feat(stats): restore level/heatmap/badges/day-detail wiring + smoke"
```

### Task 20: Settings handlers — name/interests/theme + smoke

**Files:**
- Create: `src/ui/handlers/settings.ts`
- Create: `tests/smoke/theme-persist.spec.ts` (minimal, theme-only)

Legacy ref: lines 1700–1734 (theme), 3193–3246 (name/interests), 3316–3341 (modal helpers).

- [ ] **Step 1: Implement the settings mount + simple delegate pattern**

```ts
// src/ui/handlers/settings.ts
import { on as domOn } from '../../utils/dom';
import { loadUserData, saveUser } from '../../state/user';
import { INTERESTS } from '../../utils/categories';

export function mountSettingsHandlers(): void {
  const theme = document.getElementById('themeToggle');
  theme?.addEventListener('click', () => toggleTheme());
  applyTheme();

  const nameBtn = document.getElementById('editNameBtn');
  nameBtn?.addEventListener('click', () => editName());

  const interestsBtn = document.getElementById('editInterestsBtn');
  interestsBtn?.addEventListener('click', () => editInterests());

  updateSettingsDisplay();
}

export function toggleTheme(): void {
  const cur = localStorage.getItem('theme') === 'dark' ? 'light' : 'dark';
  localStorage.setItem('theme', cur);
  applyTheme();
}

export function applyTheme(): void {
  const t = localStorage.getItem('theme') ?? 'light';
  document.documentElement.dataset.theme = t;
  document.body.classList.toggle('dark', t === 'dark');
}

function editName(): void {
  const u = loadUserData(); if (!u) return;
  const name = prompt('이름을 입력하세요', u.name);
  if (name && name.trim()) { u.name = name.trim(); saveUser(u); updateSettingsDisplay(); }
}

function editInterests(): void {
  const overlay = document.getElementById('modalOverlay');
  const modal = document.getElementById('interestsModal');
  if (!overlay || !modal) return;
  modal.replaceChildren();
  const u = loadUserData(); if (!u) return;
  const picked = new Set(u.interests);
  const grid = document.createElement('div'); grid.className = 'interest-grid';
  for (const i of INTERESTS) {
    const btn = document.createElement('button'); btn.className = 'interest-chip' + (picked.has(i.id) ? ' selected' : '');
    btn.textContent = `${i.emoji} ${i.label}`; btn.dataset.id = i.id;
    btn.addEventListener('click', () => { picked.has(i.id) ? picked.delete(i.id) : picked.add(i.id); btn.classList.toggle('selected'); });
    grid.append(btn);
  }
  const save = document.createElement('button'); save.textContent = '저장'; save.id = 'saveInterestsBtn';
  save.addEventListener('click', () => {
    u.interests = [...picked]; saveUser(u); overlay.classList.remove('show'); modal.classList.remove('show'); updateSettingsDisplay();
  });
  modal.append(grid, save);
  overlay.classList.add('show'); modal.classList.add('show');
}

export function updateSettingsDisplay(): void {
  const u = loadUserData(); if (!u) return;
  const nameEl = document.getElementById('settingsName'); if (nameEl) nameEl.textContent = u.name;
  const intEl = document.getElementById('settingsInterests'); if (intEl) intEl.textContent = u.interests.join(', ');
}
```

- [ ] **Step 2: Smoke — theme-persist**

```ts
// tests/smoke/theme-persist.spec.ts
import { test, expect } from '@playwright/test';
import { mockExternalApis, seedLocalStorage } from '../helpers/mockApi';

test('theme toggle persists across reload', async ({ page }) => {
  await mockExternalApis(page);
  await seedLocalStorage(page, {
    user: { name: 'H', interests: ['tech'], onboardedAt: '2026-04-01', streak: 0, lastActiveDate: '', xp: 0, level: 1 },
    dg_gemini_key: 'AIza_TEST',
  });
  await page.goto('/');
  await page.locator('[data-tab="settings"]').click();
  await page.locator('#themeToggle').click();
  await expect(page.locator('body.dark')).toBeVisible();
  await page.reload();
  await expect(page.locator('body.dark')).toBeVisible();

  await page.locator('[data-tab="settings"]').click();
  await page.locator('#themeToggle').click();
  await page.reload();
  await expect(page.locator('body.dark')).toHaveCount(0);
});
```

- [ ] **Step 3: Commit**

```bash
git add src/ui/handlers/settings.ts src/ui/tabs/settings.ts tests/smoke/theme-persist.spec.ts
git commit -m "feat(settings): restore theme/name/interests wiring + theme-persist smoke"
```

### Task 21: Settings handlers — apiKey modal + exportData + smoke

**Files:**
- Modify: `src/ui/handlers/settings.ts` (append)
- Modify: `src/ui/modals/apiKey.ts` if needed
- Create: `tests/smoke/settings.spec.ts`

Legacy ref: lines 3246–3315.

- [ ] **Step 1: Append settings.ts**

```ts
// src/ui/handlers/settings.ts (append)
import { testApiKey as runKeyTest } from '../onboarding';

export function wireApiKeyModal(): void {
  const open = document.getElementById('openApiKeyModalBtn');
  open?.addEventListener('click', () => {
    const overlay = document.getElementById('modalOverlay');
    const modal = document.getElementById('apiKeyModal');
    if (!overlay || !modal) return;
    overlay.classList.add('show'); modal.classList.add('show');
    const input = document.getElementById('apiKeyInput') as HTMLInputElement | null;
    if (input) input.value = localStorage.getItem('dg_gemini_key') ?? '';
    const status = document.getElementById('apiKeyStatus'); if (status) status.textContent = '';
  });
  const test = document.getElementById('apiKeyTestBtn');
  test?.addEventListener('click', async () => {
    const input = document.getElementById('apiKeyInput') as HTMLInputElement | null;
    const status = document.getElementById('apiKeyStatus');
    if (!input || !status) return;
    const ok = await runKeyTest(input.value);
    status.textContent = ok ? '✅ 유효' : '❌ 실패';
    (document.getElementById('apiKeySaveBtn') as HTMLButtonElement | null)!.disabled = !ok;
  });
  const save = document.getElementById('apiKeySaveBtn');
  save?.addEventListener('click', () => {
    const input = document.getElementById('apiKeyInput') as HTMLInputElement | null;
    if (input?.value) localStorage.setItem('dg_gemini_key', input.value);
    document.getElementById('modalOverlay')?.classList.remove('show');
    document.getElementById('apiKeyModal')?.classList.remove('show');
  });
}

export function wireExport(): void {
  const btn = document.getElementById('exportDataBtn');
  btn?.addEventListener('click', () => exportData());
}

function exportData(): void {
  const keys = ['dg_gemini_key','user','answers','briefings','theme'];
  const payload: Record<string, unknown> = {};
  for (const k of keys) {
    const raw = localStorage.getItem(k); if (raw == null) continue;
    try { payload[k] = JSON.parse(raw); } catch { payload[k] = raw; }
  }
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i); if (!k?.startsWith('chat_')) continue;
    const raw = localStorage.getItem(k); if (raw) { try { payload[k] = JSON.parse(raw); } catch { payload[k] = raw; } }
  }
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = `dg-backup-${new Date().toISOString().slice(0,10)}.json`;
  document.body.append(a); a.click(); a.remove(); URL.revokeObjectURL(url);
}
```

Update `mountSettingsHandlers()` in Task 20 to call `wireApiKeyModal()` and `wireExport()` at the end.

- [ ] **Step 2: Smoke**

```ts
// tests/smoke/settings.spec.ts
import { test, expect } from '@playwright/test';
import { mockExternalApis, seedLocalStorage } from '../helpers/mockApi';

test('settings: name, interests, apiKey modal, export', async ({ page }) => {
  await mockExternalApis(page);
  await seedLocalStorage(page, {
    user: { name: 'H', interests: ['tech'], onboardedAt: '2026-04-01', streak: 0, lastActiveDate: '', xp: 0, level: 1 },
    dg_gemini_key: 'OLD_KEY',
  });
  await page.goto('/');
  await page.locator('[data-tab="settings"]').click();

  // name via prompt
  page.on('dialog', d => d.accept('Hayden-New'));
  await page.locator('#editNameBtn').click();
  await expect(page.locator('#settingsName')).toHaveText('Hayden-New');

  // api key modal
  await page.locator('#openApiKeyModalBtn').click();
  await page.locator('#apiKeyInput').fill('AIza_NEW');
  await page.locator('#apiKeyTestBtn').click();
  await expect(page.locator('#apiKeyStatus')).toContainText('유효');
  await page.locator('#apiKeySaveBtn').click();
  const saved = await page.evaluate(() => localStorage.getItem('dg_gemini_key'));
  expect(saved).toBe('AIza_NEW');

  // export triggers a download
  const [ download ] = await Promise.all([
    page.waitForEvent('download'),
    page.locator('#exportDataBtn').click(),
  ]);
  expect(download.suggestedFilename()).toMatch(/dg-backup-\d{4}-\d{2}-\d{2}\.json/);
});
```

- [ ] **Step 3: Commit**

```bash
git add src/ui/handlers/settings.ts src/ui/tabs/settings.ts tests/smoke/settings.spec.ts
git commit -m "feat(settings): restore api key modal + export data + smoke"
```

---

## Batch 6 — Bootstrap

Serial. Depends on Batch 5.

### Task 22: main.ts bootstrap + nav wiring

**Files:**
- Modify: `src/main.ts`

- [ ] **Step 1: Read current main.ts for baseline**

```bash
cat src/main.ts
```

- [ ] **Step 2: Replace bootstrap with full wiring**

```ts
// src/main.ts
import './styles/main.css';
import { mountNav } from './ui/nav';
import { mountHomeHandlers, mountHomeQuestionHandlers, renderBriefings, loadTodayQuestion } from './ui/handlers/home';
import { mountArchiveHandlers, renderArchiveInitial } from './ui/handlers/archive';
import { mountStatsHandlers, renderAll as renderStatsAll } from './ui/handlers/stats';
import { mountSettingsHandlers } from './ui/handlers/settings';
import { startOnboarding } from './ui/onboarding';
import { loadUserData, updateGreeting, updateStreakBanner, checkAndUpdateStreak } from './state/user';

async function bootstrap(): Promise<void> {
  const user = loadUserData();
  if (!user || !user.interests?.length) {
    document.getElementById('onboarding')?.classList.remove('hidden');
    document.getElementById('app')?.classList.add('hidden');
    startOnboarding();
    window.addEventListener('dg:onboarded', () => location.reload());
    return;
  }
  document.getElementById('onboarding')?.classList.add('hidden');
  document.getElementById('app')?.classList.remove('hidden');

  checkAndUpdateStreak();
  updateGreeting();
  updateStreakBanner();

  mountNav();
  mountHomeHandlers();
  mountHomeQuestionHandlers();
  mountArchiveHandlers();
  mountStatsHandlers();
  mountSettingsHandlers();

  renderBriefings();
  renderArchiveInitial();
  renderStatsAll();
  await loadTodayQuestion();
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => void bootstrap());
else void bootstrap();
```

- [ ] **Step 3: Ensure `index.html` has onboarding/app wrappers**

Open `index.html` and confirm the `<body>` root structure matches:

```html
<body>
  <div id="onboarding" class="hidden"></div>
  <div id="app">
    <header>
      <div id="greeting"></div>
      <div id="streakBanner"></div>
    </header>
    <main id="tabRoot"></main>
    <nav id="bottomNav"></nav>
    <div id="modalOverlay">
      <div id="apiKeyModal" class="modal"></div>
      <div id="interestsModal" class="modal"></div>
      <div id="archiveDetailModal" class="modal"></div>
      <div id="dayDetailModal" class="modal"></div>
    </div>
    <div id="toast"></div>
  </div>
  <script type="module" src="/src/main.ts"></script>
</body>
```

Key rules:
- `.hidden { display: none; }` class must exist in `src/styles/main.css` (add if missing).
- `#modalOverlay` must have `display: none` by default and become visible via `.show` class toggle. The existing Phase C modal infrastructure handles this — do NOT remove the Phase E CSP adjustments.
- `src/ui/nav.ts` `mountNav` should append tab buttons into `#bottomNav` and route markup into `#tabRoot`.

- [ ] **Step 4: Run full suite**

```bash
pnpm vitest run && pnpm build && pnpm playwright test
```

- [ ] **Step 5: Commit**

```bash
git add src/main.ts index.html
git commit -m "feat(bootstrap): wire full main.ts (user check → handlers mount → initial renders)"
```

---

## Batch 7 — Compat + Deploy

Serial.

### Task 23: v2.0 compat smoke

**Files:**
- Create: `tests/smoke/v20-compat.spec.ts`

- [ ] **Step 1: Smoke**

```ts
// tests/smoke/v20-compat.spec.ts
import { test, expect } from '@playwright/test';
import { mockExternalApis, seedLocalStorage } from '../helpers/mockApi';
import fixture from '../fixtures/v2.0-user-data.json' with { type: 'json' };

test('v2.0 localStorage snapshot renders losslessly in v3.1', async ({ page }) => {
  await mockExternalApis(page);
  await seedLocalStorage(page, fixture);
  await page.goto('/');

  // greeting
  await expect(page.locator('#greeting')).toContainText('Hayden');
  await expect(page.locator('#streakBanner')).toContainText(String((fixture as any).user.streak));

  // archive has 2 answers
  await page.locator('[data-tab="archive"]').click();
  await expect(page.locator('.archive-card')).toHaveCount(2);

  // stats level matches
  await page.locator('[data-tab="stats"]').click();
  await expect(page.locator('#levelCard')).toContainText(`Level ${(fixture as any).user.level}`);
  await expect(page.locator('.badge', { hasText: '첫 답변' })).toBeVisible();

  // theme = dark was seeded
  await expect(page.locator('body.dark')).toBeVisible();
});
```

- [ ] **Step 2: Run → PASS**

```bash
pnpm build && pnpm playwright test tests/smoke/v20-compat.spec.ts
```

- [ ] **Step 3: Commit**

```bash
git add tests/smoke/v20-compat.spec.ts
git commit -m "test(smoke): v2.0 localStorage compat — renders losslessly in v3.1"
```

### Task 24: Full gate run

- [ ] **Step 1: All vitest**

```bash
pnpm vitest run
```
Expected: all green including `tests/lint/wiring-gap.spec.ts`.

- [ ] **Step 2: Build + full Playwright**

```bash
pnpm build && pnpm playwright test
```
Expected: 8/8 smoke green.

- [ ] **Step 3: Lint**

```bash
pnpm lint
```
Expected: 0 errors.

- [ ] **Step 4: tsc**

```bash
pnpm tsc --noEmit
```
Expected: 0 errors.

- [ ] **Step 5: If any gate fails, fix in a feature branch — do NOT proceed to deploy.**

No commit; this is a verification gate.

### Task 25: Hayden acceptance + deploy

- [ ] **Step 1: Local preview**

```bash
pnpm build && pnpm preview --port 4173
```

Open `http://localhost:4173` with real `dg_gemini_key` in localStorage (use browser devtools to paste Hayden's actual key). Run the 7 user-facing scenarios:

1. Onboarding (use a throwaway browser profile with cleared localStorage; pick 2 interests; enter real key; complete). ✅
2. Question flow: loads, write 80+ char answer, submit, see AI feedback, send 1 follow-up. ✅
3. Briefings: refresh, scrap 1, memo 1, persists on reload. ✅
4. Archive: filter + search + open detail. ✅
5. Stats: level + heatmap + day detail modal. ✅
6. Settings: name edit, interests edit, api key test + save, export download. ✅
7. Theme: toggle dark → reload → stays. ✅

If ANY fails, fix + re-run Task 24 before proceeding.

- [ ] **Step 2: Record current release id**

```bash
firebase hosting:releases:list --site my-ai-assistant-904f3 --limit 3 > .release-backup.txt
cat .release-backup.txt
```

Commit:
```bash
git add .release-backup.txt
git commit -m "chore(deploy): record pre-v3.1 release ids for rollback"
```

- [ ] **Step 3: Deploy**

```bash
firebase deploy --only hosting
```

- [ ] **Step 4: Post-deploy re-verification (3 of 7)**

Open `https://my-ai-assistant-904f3.web.app` in a fresh browser profile. Confirm:
- Onboarding completes (scenario 1)
- Question loads + answer submit + AI feedback (scenario 2)
- Theme toggle persists (scenario 7)

- [ ] **Step 5: If broken — instant rollback**

```bash
# take prev release id from .release-backup.txt (the one before the just-deployed)
firebase hosting:clone my-ai-assistant-904f3:<prev-release-id> my-ai-assistant-904f3:live
```

Then investigate in a feature branch.

- [ ] **Step 6: Tag v3.1**

```bash
git tag v3.1
git push origin v3.1  # only if user explicitly asks to push
```

- [ ] **Step 7: Update auto-memory**

Append to `memory/project_daily_growth_phase5.md`:
> 2026-04-19 — Phase G deployed. v3.1 restores 54 daily-use functions. 8 functional smoke + gap-detector as regression gates. v3.2 scope = weekly report, growth analysis, insight cards, Notion, Slack, push, backup reminder, scrap view.

---

## Rollback Plan

Any gate (24) failure OR any scenario failure in Task 25 Step 1/4 halts deploy. If prod goes live and fails:

```bash
firebase hosting:clone my-ai-assistant-904f3:<prev-release-id> my-ai-assistant-904f3:live
```

Previous release id is in `.release-backup.txt` captured in Task 25 Step 2. This restores the previous hosting release within ~1 minute. Then root-cause in a feature branch.

---

## Open Questions / Deferred

- RSS feed URL map (`FEEDS_BY_INTEREST` in Task 16): populate from legacy source during implementation; do NOT ship with only the placeholder list in this plan.
- Interest catalog (Task 3): re-extract from legacy `renderInterestGrid`; ensure ids match 1:1 with any pre-existing user data keyed by id.
- Sentry / observability: remains deferred (Phase 5 TD-3).
- v3.2 scope items listed in spec §3.2 — separate plan after v3.1 ships.
