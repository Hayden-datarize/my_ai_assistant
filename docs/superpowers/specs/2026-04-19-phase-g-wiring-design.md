# Phase G — Functional Wiring Recovery (v3.1)

> **Date**: 2026-04-19
> **Status**: Design approved (user sign-off pending on written spec)
> **Predecessor**: Phase 5 TD (v3.0) — deployed broken; markup ported, listeners missing.
> **Deliverable**: v3.1 restores legacy `daily-growth.html` daily-use behavior on the new Vite/TS module architecture.

---

## 1. Context

Phase D cutover (commit `9e82119`) replaced single-file `daily-growth.html` (3967 lines, 101 functions) with a Vite-built module app. Markup and event dispatch (`dg:home:*`, `dg:archive:*`, `dg:stats:*`) were ported, but **no receivers exist** in `src/`. Production URL `https://my-ai-assistant-904f3.web.app` is live but every feature except tab switching is dead. User (Hayden) has stopped using the app. Standard code review and markup-level Playwright smoke passed; neither caught the functional gap.

Root cause: Plan task for bootstrap (Task 17-18) said "wire bootstrap" without requiring listener implementation or functional smoke. Lesson stored in auto-memory: "마크업 이식 ≠ 기능 작동".

## 2. Goal

Restore the **daily-use path** of the v2.0 app on the v3.0 module architecture, with three hard gates that would have caught yesterday's failure:

1. **Typed event map** — dispatch/listener name and payload agreement enforced at compile time.
2. **Gap-detector test** — no dispatched event can ship without a listener; no handler can reference a DOM id not present in markup.
3. **Functional Playwright smoke** — each MVP scenario must produce a real DOM/localStorage/network effect, not just "tab visible".

## 3. Scope — v3.1 MVP (54 functions)

Function names match legacy `daily-growth.html` (recoverable via `git show 9e82119^:daily-growth.html`).

### 3.1 Included

| Bucket | Functions |
|---|---|
| Onboarding | initApp, initTheme, toggleTheme, renderInterestGrid, toggleInterest, goToStep, testApiKey, completeOnboarding |
| User state | loadUserData, saveUser, updateGreeting, updateStreakBanner, checkAndUpdateStreak, recordActivity |
| Today's question | loadTodayQuestion, selectAdaptiveQuestionType, renderFallbackQuestion, renderQuestion, updateCharCount, toggleHint |
| Answer + AI chat | submitAnswer, getAIFeedback, sendChatMessage, addChatBubble, addTypingIndicator, removeTypingIndicator, saveChatHistory, loadChatHistory, evaluateAnswerQuality |
| Briefings | loadBriefings, summarizeArticles, renderBriefings, refreshBriefings, renderBriefingsEmpty, toggleScrap, markBriefingRead, toggleMemo, saveMemo |
| Archive (basic) | renderArchive, filterArchive, searchArchive, showArchiveDetail |
| Stats (basic) | renderStats, renderHeatmap, showDayDetail, renderBadges |
| Settings (basic) + modals | updateSettingsDisplay, editName, editInterests, saveInterests, editApiKey, testModalApiKey, saveApiKey, switchTab, openModal, closeModal, showToast |
| Utils | getDateStr, escapeHtml, stripHtml, getCategoryLabel |
| Safety net | exportData |

### 3.2 Deferred to v3.2+ (~47 functions)

Weekly report (showWeeklyReport, copyWeeklyReport, sendWeeklyToSlack, sendWeeklyToNotion); Growth analysis (showGrowthAnalysis, copyGrowthAnalysis); Insight cards (generateInsightCard, copyInsightCard, shareInsightCard, downloadInsightImage, wrapCanvasText); Chat summary (summarizeChat, generateActionSuggestion); Notion integration (7 funcs); Slack integration (9 funcs); Push notifications (6 funcs); Backup reminder (checkBackupReminder, dismissBackupBanner); Scrap view (renderScrapView).

## 4. Architecture

### 4.1 Module structure

```text
src/
├── services/          # External I/O — mockable at Playwright route level
│   ├── gemini.ts      existing; extend with generateQuestion, evaluateAnswer, chat
│   ├── slack.ts       existing (unused in v3.1)
│   └── rss.ts         NEW — rss2json fetcher with 5s timeout and backup feeds
├── state/             # localStorage access; schema v1 (migration.ts handles v0→v1)
│   ├── schema.ts      existing
│   ├── migration.ts   existing
│   ├── persistence.ts existing readJson/writeJson helpers
│   ├── user.ts        NEW — loadUserData, saveUser, streak/greeting/banner
│   ├── answers.ts     NEW — answer CRUD, quality score writeback, stats aggregates
│   ├── briefings.ts   NEW — scrap/memo/read flags, article cache
│   └── chat.ts        NEW — chat history per day
├── ui/
│   ├── events.ts      NEW — typed CustomEvent map (single source of truth)
│   ├── tabs/          existing markup-only files (home, archive, stats, insights, settings)
│   │                  note: insights tab stays as shell in v3.1; wired in v3.2 (growth analysis, weekly report, insight cards)
│   ├── handlers/      NEW — CustomEvent listeners; call services + state; update DOM
│   │   ├── home.ts        dg:home:* handlers (11 events)
│   │   ├── archive.ts     dg:archive:* handlers (3 events)
│   │   ├── stats.ts       dg:stats:* handlers (2 events)
│   │   └── settings.ts    dg:settings:* handlers (local delegation — few or no events)
│   ├── modals/        existing shared + apiKey + slack; add dayDetail, archiveDetail, interestsEdit
│   ├── nav.ts         existing mountNav / switchTab
│   └── onboarding.ts  NEW — first-run flow only (initApp stays in main.ts)
├── utils/
│   ├── dom.ts         existing
│   ├── escapeHtml.ts  existing
│   ├── dates.ts       NEW — getDateStr
│   └── categories.ts  NEW — getCategoryLabel + interest metadata
└── main.ts            existing; extend to call bootstrap (loadUserData → initTheme → mountNav → mountHandlers → if onboarded: loadBriefings+loadTodayQuestion else route to onboarding)
```

### 4.2 Event wiring pattern

**Decision: typed CustomEvent dispatch — *kept* from Phase D, *strengthened* with a typed map.**

`src/ui/events.ts` defines:

```ts
export interface EventMap {
  'dg:home:refresh-briefings': void;
  'dg:home:submit-answer': { text: string };
  'dg:home:toggle-scrap': { index: number };
  // ...all ~16 events
}
export function dispatch<K extends keyof EventMap>(name: K, detail: EventMap[K]): void { ... }
export function on<K extends keyof EventMap>(name: K, handler: (detail: EventMap[K]) => void): () => void { ... }
```

- Tabs (`src/ui/tabs/*.ts`) import `dispatch` and call with a checked name + shape.
- Handlers (`src/ui/handlers/*.ts`) import `on` and register with a checked handler signature.
- TypeScript surface breakage is caught by `tsc --noEmit`, not by runtime.

Rationale: markup/dispatch is already written for ~16 events across 3 tabs; rewriting to direct imports would cost ~2 days of churn for marginal structural gain. Typed map closes the safety gap.

### 4.3 Data contracts

| localStorage key | Owner | v2.0 shape preserved |
|---|---|---|
| `dg_gemini_key` | state/user | string (plain API key) |
| `user` | state/user | `{ name, interests: string[], onboardedAt, streak, lastActiveDate, xp, level }` |
| `answers` | state/answers | `{ id, date, questionId, type, answer, evaluation?: { score, feedback } }[]` |
| `briefings` | state/briefings | `{ id, date, url, title, summary, scrapped, read, memo }[]` |
| `chat_{YYYY-MM-DD}` | state/chat | `{ role: 'user' \| 'ai', text, at }[]` |
| `theme` | state/user | `'light' \| 'dark'` |

**"Legacy 1:1" defined**: user-visible UI strings, localStorage keys + record shapes, and external API request shapes (Gemini, rss2json) are structurally compatible with v2.0; `migration.ts` handles any v0→v1 schema bumps so v2.0 data renders without loss. Internal code structure is free to diverge.

### 4.3-bis Existing landscape (Phase B carryover) + 3-layer schema mapping

**Revision 2026-04-19 (post-Task 14):** The original §4.3 omitted the fact that Phase B (prior session) already shipped `src/state/{schema,migration,persistence}.ts` with a **namespaced `dg.*` key scheme + Phase B shape**. The archive tab (`src/ui/tabs/archive.ts`) already consumes Phase B via `loadAnswers()` (reads `a.text`, `a.createdAt`). This means THREE concepts of "answer" coexist in the codebase. The authoritative reconciliation rule, adopted in Phase G-2, is:

**All runtime state goes through Phase B `src/state/persistence.ts`. Legacy keys (if present) are migrated on first load.**

#### Key-by-key plan

| Storage Key | v2.0 (legacy) shape | Phase B (current) shape | v3.1 target | Migration |
|---|---|---|---|---|
| `answers` (legacy) | `{id, date, type, answer, evaluation?}[]` | — | read once, migrate to `dg.answers`, delete | `persistence.ts` auto on first load |
| `dg.answers` | — | `{id, questionId, text, authorId, createdAt, schemaVersion}[]` | Phase B shape **+ optional `type`, `evaluation`, `date` fields** added in v3.1 | forward-only; v2.0 entries map `answer→text`, `date→createdAt`, `type`/`evaluation` preserved |
| `user` | `{name, interests, onboardedAt, streak, lastActiveDate, xp, level}` | (no Phase B analog — this is profile, not opt-ins) | Phase G state/user.ts owns this key (unchanged) | none — shape preserved |
| `dg.userSettings.{userId}` | — | `{userId, optIns, policyVersion, schemaVersion}` | Phase B keeps it; v3.1 doesn't add features here | none |
| `briefings` | `{id, date, url, title, summary, scrapped, read, memo}[]` | — | Phase G state/briefings.ts owns this key (unchanged) | none |
| `chat_{YYYY-MM-DD}` | `{role, text, at}[]` | — | Phase G state/chat.ts owns this key (unchanged) | none |
| `theme` | `'light' \| 'dark'` | — | settings handler owns this key (unchanged) | none |
| `dg_gemini_key` | string | — | settings tab owns this key (unchanged — already on disk) | none |

**Rationale for key-split ownership:**
- Phase B `UserSettings` is a different concept (opt-ins, policy versions for future privacy features) than legacy `user` (profile: name, interests, xp). They do not overlap; both keys coexist.
- `answers` is the only key with a schema collision because Phase B already replaced it.

#### Answer schema migration contract

```ts
// schema.ts — extended in Phase G-2
export interface Answer extends Versioned {
  id: string;
  questionId: string;
  text: string;           // primary answer body (was legacy `answer`)
  authorId: string;       // 'self' for single-user v3.1
  createdAt: string;      // ISO string (derived from legacy `date` if present)
  type?: string;          // legacy: question type ('분석' | '전환' | ...); optional
  evaluation?: { score: number; feedback: string }; // legacy AI score; optional
  date?: string;          // legacy 'YYYY-MM-DD'; optional, kept for archive filter by day
}
```

```ts
// migration.ts — extended in Phase G-2
export function migrateAnswer(raw: unknown): Answer {
  const r = (raw ?? {}) as Record<string, unknown>;
  if (isVersioned(r) && r.schemaVersion === CURRENT_SCHEMA_VERSION && typeof r.text === 'string') {
    return r as Answer;
  }
  // Legacy v2.0 → Phase B mapping
  const legacyAnswer = (r.answer as string | undefined) ?? '';
  const legacyDate = (r.date as string | undefined) ?? new Date().toISOString().slice(0, 10);
  const legacyType = r.type as string | undefined;
  const legacyEval = r.evaluation as { score: number; feedback: string } | undefined;
  return {
    id: String(r.id ?? `a_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`),
    questionId: String(r.questionId ?? ''),
    text: String(r.text ?? legacyAnswer),
    authorId: String(r.authorId ?? 'self'),
    createdAt: String(r.createdAt ?? (legacyDate ? `${legacyDate}T00:00:00.000Z` : new Date().toISOString())),
    type: legacyType,
    evaluation: legacyEval,
    date: legacyDate,
    schemaVersion: CURRENT_SCHEMA_VERSION,
  };
}
```

```ts
// persistence.ts — extended in Phase G-2
export function loadAnswers(): Answer[] {
  // 1. Try Phase B key first
  const phaseB = readJson<unknown[]>('dg.answers', []);
  if (Array.isArray(phaseB) && phaseB.length > 0) {
    return phaseB.map(migrateAnswer);
  }
  // 2. Fall back to legacy key if Phase B empty
  const legacy = readJson<unknown[]>('answers', []);
  if (!Array.isArray(legacy) || legacy.length === 0) return [];
  const migrated = legacy.map(migrateAnswer);
  // 3. Upgrade on first load: write to Phase B, delete legacy
  saveAnswers(migrated);
  localStorage.removeItem('answers');
  return migrated;
}
```

#### Task 10 disposition

The Phase G Task 10 output (`src/state/answers.ts` + `tests/unit/state-answers.spec.ts`, commit `f53a2fc`) conflicts with this reconciliation because it writes to the legacy `answers` key with legacy shape. It will be **removed** in Phase G-2, replaced by direct use of `persistence.ts` in handlers. The Task 10 test cases are preserved semantically via new tests in `tests/unit/persistence.spec.ts` (expanded as part of Phase G-2).

## 5. Safety gates

### 5.1 Gate A — unit TDD

Each new `state/*.ts`, `services/rss.ts`, and `ui/handlers/*.ts` ships with a `.spec.ts`. Handler tests use `@testing-library/dom` or JSDOM; services are tested with `vi.fn()` for fetch. Services MUST be implemented with test written first.

### 5.2 Gate B — gap-detector (`tests/lint/wiring-gap.spec.ts`)

A Vitest spec that statically analyses source:

1. Scan `src/ui/tabs/**/*.ts` + `src/ui/handlers/**/*.ts` for `dispatch<'…'>` or `on<'…'>` call sites.
2. Fail if any dispatched name has no listener, or any listener has no dispatcher.
3. Scan `src/ui/handlers/**/*.ts` for `qs('#…')` / `getElementById('…')`; scan tabs for `id="…"`; fail if handler references a missing id.

Deliberately shallow: covers the failure mode that shipped v3.0. Detail-shape drift is prevented by the typed EventMap at compile time.

### 5.3 Gate C — functional Playwright smoke (8 specs)

All smoke runs against `pnpm build && pnpm preview` output, not dev server. All external API calls are intercepted with `page.route()` and served from `tests/fixtures/api/*.json`.

| # | File | Scenario |
|---|------|---|
| 1 | `onboarding.spec.ts` | Select 2 interests → enter API key → test key (mocked 200) → complete → main screen visible |
| 2 | `question-flow.spec.ts` | Main loads → question text appears within 3s → type 80-char answer → submit → AI feedback bubble appears → send follow-up → second bubble appears → `answers` in localStorage has 1 record |
| 3 | `briefings.spec.ts` | Refresh briefings → 3 cards render → scrap card 1 → localStorage `briefings[0].scrapped==true` → open memo → save "test" → persisted |
| 4 | `archive.spec.ts` | Seed answers fixture → open archive tab → 3 cards visible → click filter chip "행동" → count drops → search "test" → highlights; open detail → modal opens |
| 5 | `stats.spec.ts` | Seed activity fixture → stats tab shows streak + level + badges → click heatmap cell → day-detail modal shows entries |
| 6 | `settings.spec.ts` | Settings tab → edit name → save → reload → new name persists → edit interests → change 1 → save → API key modal: test (200) → save; export data → downloaded file has 5 keys |
| 7 | `theme-persist.spec.ts` | Toggle dark → reload → still dark → toggle light → reload → still light |
| 8 | `v20-compat.spec.ts` | Seed localStorage with `tests/fixtures/v2.0-user-data.json` before navigation → launch app → archive count, streak, level, badges match v2.0 snapshot values |

### 5.4 Gate D — deploy checklist (order enforced)

1. `pnpm vitest run` — all green (units + gap-detector).
2. `pnpm build && pnpm playwright test` — 8/8 smoke green.
3. `firebase hosting:releases:list --site my-ai-assistant-904f3` — capture current release id into `.release-backup.txt`.
4. Hayden runs the 7 user-facing scenarios locally (`pnpm preview`) against real Gemini + RSS → OK.
5. `firebase deploy --only hosting`.
6. Open prod URL; Hayden does one-minute re-verification on at least 3 of the 7 scenarios.
7. If broken: `firebase hosting:clone my-ai-assistant-904f3:<prev-id> my-ai-assistant-904f3:live` within 2 minutes.

## 6. Non-goals for v3.1

- No Sentry (Phase 5 TD-3, still deferred).
- No Slack/Notion/Push wiring (v3.2).
- No weekly report, growth analysis, insight cards (v3.2).
- No inline-style → utility-class migration (Phase F cleanup).
- No SSO, audit log, k-anon, FCM (Phase 5 W1+, outside TD).
- No behavior improvements; strict 1:1 to v2.0 user-visible surface.

## 7. Risks + mitigations

| Risk | Mitigation |
|---|---|
| v2.0 localStorage has field names or shapes the migration.ts v0→v1 path didn't cover | Gate C #8 (v20-compat smoke) seeds a real fixture and checks render |
| New RSS fetcher changes timeout/backup semantics and briefings break | Port legacy rss.ts constants verbatim; smoke #3 validates end-to-end |
| Event typing map drifts from markup over time | Gap-detector (Gate B) catches any dispatch without listener; typed map prevents detail drift |
| Hayden's manual verification is rushed | Gate D explicitly requires all 7 + 3-of-7 post-deploy re-check; writing-plans must enumerate as discrete tasks |
| Subagent-driven execution re-introduces the Phase D failure mode | Each handler task REQUIRES its matching smoke spec to be committed in the same atom — Plan must enforce |

## 8. Open items for writing-plans

- Exact Task atom breakdown (likely 25–35 atoms): per-bucket services/state + per-tab handlers + per-smoke + gap-detector + deploy.
- Parallelisable atoms vs serial dependencies.
- Test fixture authoring (api mocks + v2.0 snapshot) — needs real v2.0 data capture from Hayden's device if possible, else synthetic with plausible values.
- Timeline estimate once atoms are sized.

## 9. References

- Auto-memory: `memory/project_daily_growth_phase5.md`, `memory/feedback_dg_wiring_lesson.md`, `memory/project_daily_growth.md`.
- Legacy source: `git show 9e82119^:daily-growth.html`.
- Phase 5 master plan: `docs/superpowers/plans/2026-04-18-phase5-master.md`.
- Phase 5 TD plan (root cause locus): `docs/superpowers/plans/2026-04-18-phase5-td-foundations.md` Task 17–18.
