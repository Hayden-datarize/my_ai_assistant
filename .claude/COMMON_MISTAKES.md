# Common Mistakes

> ⚠️ CRITICAL — 세션 시작 시 반드시 읽을 것 (2분 투자 = 2시간 절약).

실제 프로덕션에서 발생한 실수. 재발 방지용.

---

## 1. 마크업 이식 ≠ 기능 작동 (Wiring Lesson, 2026-04-18)

**Symptom**: 단일 HTML → 모듈 구조로 이식 후 빌드/타입체크/smoke 전부 통과하지만, 사용자에겐 앱이 죽은 상태

**Root cause**: `bindHandlers`가 `CustomEvent`를 dispatch만 하고 receiver는 어디에도 없음. 테스트는 "탭이 보인다"만 검증, "버튼 클릭 → DOM 변화"는 검증 안 함.

**Fix/Prevention**:

- Plan 작성 시 **"function porting + wire-up"** Task를 명시적으로 분리
- Functional smoke 1개 이상 필수 (예: "API 키 저장 → 화면에 값 나타남")
- gap-detector를 배포 전 게이트로 사용 (dispatch ↔ listener 1:1 매칭 검증)

**관련 파일**: `src/ui/tabs/*.ts`, `src/ui/events.ts`

---

## 2. Plan 작성 전 기존 코드 지도화 누락 (2026-04-19)

**Symptom**: Recovery/brownfield Plan에서 기존 스키마/키/컨벤션 충돌로 Tasks 중단. Schema reconciliation 추가 세션 필요.

**Root cause**: `dg.answers` 네임스페이스가 이미 존재하는 걸 모르고 legacy shape으로 새 파일 생성 → 3개 answer 표현 공존.

**Fix/Prevention**: Plan Spec에 `§Existing Landscape` 섹션을 **세부 Task 작성 전** 먼저 적는다:

1. 기존 localStorage/DB 키 전체 목록 (네임스페이스, 스키마, 읽는 코드 위치)
2. 기존 CustomEvent 이름 전체 목록 (dispatcher/listener 위치)
3. 파일별 책임 경계 (state / service / ui)
4. 마크업 id 인벤토리
5. 기존 마이그레이션 규칙

**Anti-pattern**: "legacy 1:1 호환" 같은 추상적 용어. **어느 키 · 어느 shape** 구체적으로 명시.

---

## 3. CORS/CSP는 mock 테스트로 못 잡는다 (2026-04-20)

**Symptom**: 119 vitest + 14 Playwright 전부 green으로 Slack 연동 배포. 사용자 테스트 버튼 클릭 시 `TypeError: Failed to fetch` (CORS preflight 실패). 같은 세션에 CSP `connect-src` 누락으로 RSS 브리핑 영구 skeleton.

**Root cause**:

- Unit: `global.fetch = vi.fn()` → mock이라 브라우저 정책 안 탐
- Playwright: `page.route('**/host/**', fulfill)` → intercept하므로 preflight 안 탐
- `Content-Type: application/json`은 non-simple request → OPTIONS 발동 → Slack webhook이 OPTIONS 미응답

**Fix/Prevention**: 외부 호스트 건드는 PR은 아래 3가지 assertion 필수:

1. **Unit**: fetch header가 simple request safe인지 assert (예: `init.headers === undefined`)
2. **Lint-level vitest**: CSP `connect-src`에 호스트가 `index.html` + `firebase.json` 양쪽에 있는지
3. **Playwright**: `await page.waitForRequest('**/host/**')` + `securitypolicyviolation` 이벤트 없음 assert

> "Content-Type 명시하는 게 safe해 보인다"는 직관은 틀릴 수 있음. Fetch spec simple request 조건 직접 확인 (`text/plain` / `application/x-www-form-urlencoded` / `multipart/form-data`만 simple).

**관련 파일**: `firebase.json` (CSP header), `index.html` (meta CSP), `src/services/{slack,gemini,rss}.ts`

---

## 4. P2/Minor 리뷰 항목 자동 적용 금지 (2026-04-20)

**Symptom**: 코드 리뷰에서 "user should decide"로 명시된 P2 제안(예: AbortSignal.timeout, keepalive: true)을 단독 자동 적용 → 사용자가 tool use 거부.

**Root cause**: P2/Minor는 설계 선택지가 있는 영역. 자동 적용 = 사용자 결정 지점 건너뛰기.

**Fix/Prevention**: 리뷰 severity별 처리 규칙:

- **Critical/Important** → fix 즉시 디스패치
- **Minor/P2 with "user should decide"** → 옵션 제시하고 사용자 선택
- **Minor/P2 without decision framing** → 언급만 하고 다음 task
- **Minor/P2 trivial** (주석/이름) → 사용자 동의 후 묶어서 처리

---

## 이 파일을 업데이트하는 기준

- 디버그에 1시간 이상 걸린 버그
- 프로덕션 이슈 유발 가능한 에러
- 여러 세션에서 반복된 실수
- 프레임워크 컨벤션 위반 패턴

---

## 5. Playwright cold-start vs warm-start (2026-05-03, v3.14.4 T14)

**Symptom**: 로컬 N=5 5/5 안정 보고했으나 사이클-끝 fresh smoke run에서 일부 spec cold-start fail. retry 시 PASS. (v3.14.4에서 추가 발견: 진짜 fail 원인이 timeout이 아니라 시드의 UTC vs local TZ mismatch였던 케이스도 있음.)

**Root cause**:

- `vite preview` reuse + warm cache가 N=5 사이에 남음 → 첫 페이지 로드가 캐시된 bundle로 빠르게 응답.
- Playwright default `expect(...).toBeVisible()` 5s timeout. cold-start fresh fork 시 첫 mount가 5s 초과.
- `playwright.config.ts` `timeout: 30_000`(test 단위)는 충분 — 진짜 부족분은 per-expect/action default 5s.
- **시드 TZ mismatch (v3.14.4 T3 발견)**: 테스트 시드가 `new Date().toISOString().slice(0, 10)`(UTC)를 쓰면 KST 새벽엔 production `getDateStr()`(local)와 1일 어긋남 → `hydrateBriefings`가 stale 판정 → `refreshBriefings` 자동 트리거 → fixture가 RSS fetch로 덮여 사라짐 → empty state.

**Fix/Prevention**:

- 첫 critical action 직전의 expect에 `{ timeout: 10_000 }` 추가 (또는 hydrate signal로 명시적 readiness 대기).
- `test.timeout` bump 금지 (이미 30s로 충분).
- static element는 readiness 신호 아님 (예: `#bottomNav` 같은 HTML 정적 요소). **dynamic mount 결과 element**를 anchor로 사용.
- 시드 today/lastActiveDate에는 `import { getDateStr } from '../../src/utils/dates'` 사용 (`tests/smoke/cardnews.spec.ts` 선례). `addInitScript` 브라우저 컨텍스트 제약 시 Node-side에서 호출 후 args로 전달.
- 사이클-끝 cold-start fresh fork 검증: `rm -rf node_modules/.vite-temp dist && npm run test:smoke`.
- N=5 안정성 확인 시 매 회 fresh fork (cache clear).

**관련 파일**: `tests/smoke/*.spec.ts`, `playwright.config.ts`, `src/utils/dates.ts`

---

## 6. vitest count baseline drift (2026-05-03, v3.14.4 T14)

**Symptom**: 사이클 retro 보고 vitest count와 차기 사이클 시작 시 실측 vitest count 불일치 (예: v3.14.2 retro 693 vs v3.14.3 시작 697 = +4 미해명; v3.14.3 retro 704 vs T0 실측 703 pass + 1 fail mask).

**Root cause**:

- `it.each` / dynamic `it()` 호출 — runtime 카운트 변동.
- nested `describe` 중첩 카운팅 vitest 버전 차이.
- 직전 사이클 retro 작성 시점에 인터미턴트 fail이 mask되어 보고됨 (date-RNG dependent test 등).
- 신규 spec 추가가 retro 보고 후 누락.

**Fix/Prevention**:

- 사이클 시작 시 **Task 0 baseline 측정 우선화** — `npm test 2>&1 | grep -E "Tests|Test Files"` 결과를 plan §Test Count Baseline 표에 기록.
- 두 단계 drift 추적 포맷:

  | 단계 | 보고값 | 실측값 | Δ | 원인 |
  |---|---|---|---|---|
  | (i) 직전 사이클 retro → 본 사이클 시작 | <retro> | <T0 측정> | <Δ> | <가설 검증 결과> |
  | (ii) 본 사이클 시작 → 끝 | <T0> | <T17 측정> | <Δ> | task별 +N 분담 |

- 미해명 drift는 "v3.X+ open" 명시. **절대값보다 Δ 추적이 우선**.
- intermittent fail mask 의심 시 `for i in 1 2 3 4 5; do npm test 2>&1 | tail -5; done`으로 N=5 실측.

**관련 파일**: `docs/superpowers/plans/*.md` §Test Count Baseline, `docs/superpowers/specs/*.md` §retro

---

## 7. 사이클-끝 lint check (2026-05-03, v3.14.4 T14)

**Symptom**: 사이클 main work 끝 + 배포 직전 lint 실행 시 잔존 errors 발견 (예: v3.14.3 신규 spec의 `eslint-disable-next-line` 누락).

**Root cause**:

- 각 task 검증이 TS strict + 영향 범위 vitest 만 체크하고 lint 누락.
- 신규 spec 추가 시 inline disable 주석을 implementer가 자동으로 안 붙임.
- lint를 사이클 끝에 일괄 실행하면 task 추적이 어려움 (어느 commit에서 깨졌는지).

**Fix/Prevention**:

- **각 main work task 후 3종 검증** (CLAUDE.md "Cycle Workflow" 섹션):
  1. `npx tsc --noEmit` → 0 errors
  2. `npm run lint` → 0 errors
  3. `npm test -- <영향 범위>` → PASS, 신규 spec N=5 5/5
- 사이클-끝 (배포 직전) `npm run lint && npm test && npm run test:smoke` 3종 일괄 재확인.
- 신규 `innerHTML` / `dangerouslySetInnerHTML` 등 lint rule 위반 spec 작성 시 implementer가 inline `eslint-disable-next-line` 주석 자동 삽입.

**관련 파일**: 모든 `tests/`, `src/`

---

## 8. Smoke + 외부 API mock 시 `serviceWorkers: 'block'` 의무 (2026-05-09, v3.23 T10 → v3.24 T1)

**Symptom**: smoke spec에서 `page.route('**/generativelanguage.googleapis.com/**', fulfill)`로 Gemini API mock을 등록했지만 실제 production API (400) 호출이 발생. mock이 bypass됨.

**Root cause**: 앱이 `public/sw.js` 서비스 워커를 등록하면 `page.route()`가 SW에 가로채이지 않은 요청만 intercept한다. SW가 fetch event를 가로채면 Playwright route handler 미적용. v3.23 stub-cleanup smoke (E2 인사이트 happy path) 디버깅에서 1시간 소진.

**Fix/Prevention**:

- 외부 API mock이 필요한 모든 smoke spec에 file-top `test.use({ serviceWorkers: 'block' })` 명시.
- 선례: `tests/smoke/card-translation.spec.ts` (v3.4)에서 동일 정책 graduate.
- v3.23 T10 (`tests/smoke/v3.23-stub-cleanup.spec.ts`)에서 graduate 확정.

````ts
import { test, expect } from '@playwright/test';

test.use({ serviceWorkers: 'block' });

test('Gemini mock 호출이 실제 API에 새지 않는다', async ({ page }) => {
  await page.route('**/generativelanguage.googleapis.com/**', route =>
    route.fulfill({ status: 200, body: JSON.stringify({ /* mock */ }) }),
  );
  // ...
});
````

**관련 파일**: `tests/smoke/*.spec.ts` (외부 API mock 사용 시 전부)

---

## 9. Listener wiring 변경 시 mutation path 전수 grep (2026-05-13, v3.30 → v3.31)

**Symptom**: 새 listener hook은 추가했지만 production mutation path 일부가 이벤트를 거치지 않아 count/UI가 stale.

**Root cause**: spec에 적힌 dispatch/listener 1:1만 확인하고, 실제 mutation caller 전체 grep을 하지 않음.

**Fix/Prevention**:

- listener wiring 변경 전 `rg -n "<event>|<mutator>|<rerender-helper>" src tests`를 실행한다.
- 가능한 경우 caller별 patch보다 단일 rerender/helper 진입점에 side-effect를 추가한다.
- review prompt에 "mutation paths 전수 grep 여부"를 포함한다.

**관련 파일**: `src/ui/handlers/*`, `src/ui/events.ts`, `tests/**/*`

---

## 10. Playwright repeatEach는 describe-level configure가 아니다 (2026-05-13, v3.30)

**Symptom**: `test.describe.configure({ repeatEach: 3 })` 권고를 적용하려 했지만 Playwright 1.59에서 지원되지 않음.

**Root cause**: `repeatEach`는 project/test config 옵션이고, describe-level configure는 mode/retries/timeout 계열만 지원.

**Fix/Prevention**:

- 같은 spec을 N회 반복하려면 file-local `for (let i = 0; i < N; i++) test(...)` 패턴을 사용한다.
- project-level 반복이 필요할 때만 `playwright.config.ts`의 project/testConfig `repeatEach`를 검토한다.

**관련 파일**: `tests/smoke/*.spec.ts`, `playwright.config.ts`

---

## 11. Module 추출 시 production import와 test mock path를 함께 grep (2026-05-13, v3.30)

**Symptom**: production import는 새 module로 바꿨지만 `vi.mock()` path가 old module을 계속 가리켜 stale mock이 됨.

**Root cause**: module extraction에서 production import만 grep하고 tests/mock path grep을 누락.

**Fix/Prevention**:

- 추출 전후에 `rg -n "oldFunction|old/module|vi\\.mock" src tests`를 실행한다.
- production import migration과 test mock path migration은 같은 task 안에서 처리한다.
- code-reviewer 요청에는 "test mock path stale 여부"를 명시한다.

**관련 파일**: `src/**/*`, `tests/**/*`

---

**Last Updated**: 2026-05-13
