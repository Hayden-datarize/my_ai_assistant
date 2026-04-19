# Onboarding Styling + Desktop Layout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** v3.1 온보딩 화면의 누락된 CSS 규칙을 추가해 480px 카드 중앙 정렬 + 칩 grid + 입력/버튼 스타일을 복구하고, 768px 이상에서 관심사 grid를 3-column으로 확장.

**Architecture:** `src/styles/main.css` 한 파일만 수정. `.onboarding` 컨테이너에 `align-items: center` + `padding` + `gap`을 추가해 자식을 중앙 정렬하고, `.onboarding > *` 자손 선택자로 자식 요소에 `max-width: 480px`를 강제. 신규 8개 클래스(`.onboarding-steps`, `.onboarding-grid`, `.onboarding-chip`, `.onboarding-help`, `.onboarding-status`, `.onboarding-nav-row` 및 input/button 하위 셀렉터)에 규칙 추가. 기존 `@media (min-width: 768px)` 블록에 `.onboarding-grid { grid-template-columns: repeat(3, 1fr); }` 1줄 추가. TS/HTML/테스트 파일은 **수정 0건**.

**Tech Stack:** CSS(vanilla), 기존 디자인 토큰(`--primary`, `--bg-card`, `--border`, `--text-*`, `--radius-*`), Vite 빌드, Vitest, Playwright smoke

**Spec reference:** [docs/superpowers/specs/2026-04-19-onboarding-styling-design.md](../specs/2026-04-19-onboarding-styling-design.md)

---

## File Structure

| 파일 | 역할 | 이번 플랜에서의 변경 |
|------|------|---------------------|
| `src/styles/main.css` | 전역 스타일 한 파일 | `.onboarding` 섹션(103~123 주변) 확장 + `@media (min-width: 768px)` 블록(786~813) 1줄 추가 |
| `src/ui/onboarding.ts` | 온보딩 렌더 로직 | **수정 없음** — 클래스 이름이 이미 신규 컨벤션 |
| `tests/smoke/boot.spec.ts` | 온보딩 분기 smoke | **수정 없음** — 선택자 불변 |
| `tests/smoke/v20-compat.spec.ts` | 레거시 마이그레이션 smoke | **수정 없음** |
| `tests/lint/wiring-gap.spec.ts` | event wiring 검증 | **수정 없음** |

---

## Pre-Check: Baseline 녹색 확인

CSS 변경이 기존 동작을 깨지 않았음을 확인하려면 먼저 baseline이 green이어야 함.

- [ ] **Step 0-1: 현재 브랜치 확인**

Run: `git status && git rev-parse --abbrev-ref HEAD`
Expected: 현재 브랜치는 `main`, working tree clean (스펙 커밋 완료 상태). 작업용 브랜치 분기:

```bash
git checkout -b chore/onboarding-styling
```

- [ ] **Step 0-2: 의존성 설치 확인**

Run: `npm ls --depth=0 2>/dev/null | head -20`
Expected: vite, vitest, @playwright/test 등 설치됨. 없으면 `npm install`.

- [ ] **Step 0-3: 타입체크 + 린트 baseline**

Run: `npm run lint`
Expected: 오류 0개

Run: `npx tsc --noEmit`
Expected: 오류 0개

- [ ] **Step 0-4: vitest baseline**

Run: `npm run test`
Expected: 87 pass / 87 total

- [ ] **Step 0-5: Playwright smoke baseline**

Run: `npm run test:smoke`
Expected: 9 pass / 9 total

> ⚠️ 이 단계에서 실패가 나오면 **멈추고 사용자에게 알림**. baseline이 깨진 상태에서는 CSS 작업이 회귀를 가리게 된다.

---

## Task 1: `.onboarding` 컨테이너 확장

자식 요소를 가로 중앙 정렬하고 카드 간격을 주기 위해 기존 `.onboarding` 블록을 확장한다.

**Files:**
- Modify: `src/styles/main.css:103-107`

- [ ] **Step 1-1: 기존 `.onboarding` 블록 확장**

`src/styles/main.css` 103번 라인 근처의 다음 블록을 찾는다:

```css
.onboarding {
  position: fixed; inset: 0; background: var(--bg);
  z-index: 900; display: flex; flex-direction: column;
  transition: opacity 0.4s; overflow-y: auto;
}
```

아래로 교체:

```css
.onboarding {
  position: fixed; inset: 0; background: var(--bg);
  z-index: 900; display: flex; flex-direction: column;
  align-items: center;
  gap: 12px;
  padding: 32px 20px calc(env(safe-area-inset-bottom, 0px) + 32px);
  transition: opacity 0.4s; overflow-y: auto;
}
```

- [ ] **Step 1-2: 이 단계에서 커밋하지 않음**

Task 6까지 논리적 단위라 한 커밋으로 묶는다. 다음 Task로 이동.

---

## Task 2: 온보딩 자식 요소 공통 폭 제약 + 타이포그래피

모든 자식(h1/h2/p/label/input/button + 온보딩 전용 클래스)에 `width: 100%; max-width: 480px;`을 강제하고 타이틀·진행 표시·헤더 스타일을 붙인다.

**Files:**
- Modify: `src/styles/main.css:108` 다음 줄에 삽입 (레거시 `.onboard-header` 블록 바로 위)

- [ ] **Step 2-1: 공통 폭 + h1/steps/h2 규칙 삽입**

`.onboarding.hide { opacity: 0; pointer-events: none; }` 줄 바로 아래에 다음 블록을 추가:

```css
/* v3.1 onboarding (new classes used by src/ui/onboarding.ts) */
.onboarding > h1,
.onboarding > h2,
.onboarding > p,
.onboarding > label,
.onboarding > input,
.onboarding > button,
.onboarding-steps,
.onboarding-grid,
.onboarding-help,
.onboarding-status,
.onboarding-nav-row {
  width: 100%;
  max-width: 480px;
}

.onboarding > h1 {
  color: var(--primary);
  text-align: center;
  margin-bottom: 4px;
}

.onboarding-steps {
  font-size: 0.85rem;
  color: var(--text-secondary);
  text-align: center;
  margin-bottom: 8px;
}

.onboarding > h2 {
  margin: 8px 0 4px;
}
```

- [ ] **Step 2-2: 지우지 말 것**

기존 `.onboard-header` / `.onboard-step-dots` / `.onboard-body` 블록(109~123)은 **그대로 둔다**. 레거시 dead code지만 이번 스코프 아님.

- [ ] **Step 2-3: 브라우저 수동 확인 (빠른 체크)**

Run (백그라운드): `npm run dev`
브라우저에서 `http://localhost:5173` 열기 → `localStorage.clear()` → 새로고침. 온보딩 화면에서:
- 타이틀 "🌱 Daily Growth 시작하기"가 중앙 정렬됨
- "단계 1 / 3" 텍스트가 중앙, 작게 표시
- 칩/입력은 아직 스타일 미적용 (다음 Task에서 처리)

확인 후 dev 서버는 켠 채로 계속 진행.

---

## Task 3: 관심사 grid + chip 스타일

step 1의 관심사 선택 UI가 가장 시각적으로 깨져 있어 먼저 처리.

**Files:**
- Modify: `src/styles/main.css` — Task 2에서 추가한 `.onboarding > h2 { ... }` 블록 바로 아래

- [ ] **Step 3-1: `.onboarding-grid` + `.onboarding-chip` 규칙 추가**

```css
.onboarding-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 8px;
  margin: 8px 0 12px;
}

.onboarding-chip {
  padding: 10px 12px;
  border-radius: var(--radius-md);
  border: 2px solid var(--border);
  background: var(--bg-card);
  color: var(--text-primary);
  font-size: 0.9rem;
  font-family: var(--font-body);
  cursor: pointer;
  transition: border-color 0.2s, background 0.2s, color 0.2s;
  text-align: center;
}
.onboarding-chip:hover { border-color: var(--primary-light); }
.onboarding-chip.selected {
  background: var(--primary);
  border-color: var(--primary);
  color: #fff;
}
```

- [ ] **Step 3-2: 브라우저 수동 확인**

브라우저 새로고침 → step 1에서:
- 관심사 15개가 2×8 grid(마지막 행 1개)로 배열됨
- 칩 클릭 시 테두리 → 배경 primary 색으로 전환
- hover 시 테두리 색상 변화

---

## Task 4: input 스타일 (text + password)

step 1의 이름 입력과 step 2의 API 키 입력에 명확한 border·focus ring을 준다.

**Files:**
- Modify: `src/styles/main.css` — Task 3에서 추가한 `.onboarding-chip.selected` 블록 바로 아래

- [ ] **Step 4-1: label + input 규칙 추가**

```css
.onboarding > label {
  font-size: 0.85rem;
  color: var(--text-secondary);
  font-weight: 500;
}

.onboarding > input[type="text"],
.onboarding > input[type="password"] {
  padding: 12px 14px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--border);
  background: var(--bg-input);
  color: var(--text-primary);
  font-size: 0.95rem;
  font-family: var(--font-body);
  outline: none;
  transition: border-color 0.2s;
}
.onboarding > input[type="password"] { font-family: monospace; }
.onboarding > input:focus { border-color: var(--primary); }
```

- [ ] **Step 4-2: 브라우저 수동 확인**

새로고침 → step 1:
- "이름 (생략 가능)" label이 작고 secondary 색상
- 이름 입력 박스 테두리 명확함, 포커스 시 primary 테두리

관심사 2+ 선택 후 "다음" 클릭 → step 2:
- API 키 input이 password 마스킹, 테두리 명확
- placeholder "AIza..." 가시성 OK

---

## Task 5: help / status / nav-row 스타일

step 2의 보조 텍스트·검증 상태·이전/다음 버튼 가로 배치.

**Files:**
- Modify: `src/styles/main.css` — Task 4 블록 바로 아래

- [ ] **Step 5-1: 헬프·상태·네비게이션 규칙 추가**

```css
.onboarding-help {
  font-size: 0.85rem;
  color: var(--text-tertiary);
  line-height: 1.55;
}

.onboarding-status {
  font-size: 0.9rem;
  min-height: 1.4em;
  color: var(--text-secondary);
}

.onboarding-nav-row {
  display: flex;
  gap: 10px;
  margin-top: 8px;
}
.onboarding-nav-row > button { flex: 1; }
```

- [ ] **Step 5-2: 브라우저 수동 확인**

step 2에서:
- "키가 없다면..." 헬프 텍스트가 작고 tertiary 색상
- "키 테스트" 버튼 클릭 → `onboarding-status`에 결과 메시지 ("✅ 유효한 키입니다" 또는 "❌ 키 확인 실패")
- "이전" / "완료" 버튼이 가로 1:1로 배치되고 풀 폭 stretch 아님

> 키 테스트 실제 실행은 선택 — 유효한 Gemini 키가 없으면 실패 UI만 확인해도 OK.

---

## Task 6: 데스크톱 768px 반응형 확장

기존 `@media (min-width: 768px)` 블록의 끝에 관심사 grid 3-column 규칙 1줄 추가.

**Files:**
- Modify: `src/styles/main.css:812` 근처 — 기존 `.stat-grid { grid-template-columns: repeat(4, 1fr); }` 줄 뒤, 닫는 `}` 직전

- [ ] **Step 6-1: 3-column grid 추가**

다음 블록을 찾는다:

```css
@media (min-width: 768px) {
  .app-container {
    max-width: 960px;
    padding-bottom: calc(var(--nav-height) + var(--safe-bottom) + 8px);
  }
  /* ... #homeTab grid rules ... */
  .question-section { margin: 0 20px 12px; }
  .chat-container { margin: 0 20px 20px; }
  .briefing-card { min-width: 280px; }
  .stat-grid { grid-template-columns: repeat(4, 1fr); }
}
```

마지막 `}` 직전에 한 줄 추가:

```css
  .stat-grid { grid-template-columns: repeat(4, 1fr); }
  .onboarding-grid { grid-template-columns: repeat(3, 1fr); }
}
```

- [ ] **Step 6-2: 브라우저 수동 확인**

브라우저 창을 1200px 이상으로 늘림 → step 1 재확인:
- 관심사 15개가 3×5 grid로 재배치
- 카드 자체는 480px 중앙 유지

창을 480px 이하로 줄이면 2-column grid 복귀.

---

## Task 7: 전체 게이트 재실행

CSS 변경이 기존 테스트를 깨지 않았는지 확인.

- [ ] **Step 7-1: lint + typecheck**

Run: `npm run lint && npx tsc --noEmit`
Expected: 오류 0개

- [ ] **Step 7-2: vitest**

Run: `npm run test`
Expected: 87 pass / 87 total (baseline과 동일)

- [ ] **Step 7-3: Playwright smoke**

Run: `npm run test:smoke`
Expected: 9 pass / 9 total (특히 `boot.spec.ts` 온보딩 분기가 green)

> 실패 시 **멈추고 원인 분석**. CSS 선택자가 기존 DOM을 가리거나 선택자 특이도 충돌 가능성. 가장 의심스러운 곳: `.onboarding > button`과 `.btn.btn-block`의 우선순위 (같은 specificity면 나중에 정의된 `.onboarding > button` 룰이 이김 → 의도됨).

- [ ] **Step 7-4: 프로덕션 빌드 확인**

Run: `npm run build`
Expected: 빌드 성공, `dist/` 생성, gzip 크기 13~14 KB 범위 유지

---

## Task 8: 로컬 수동 QA (스펙 §5.2 시나리오)

5개 시나리오를 순서대로 실행.

**Files:** 변경 없음

- [ ] **Step 8-1: 첫 방문 시나리오**

`npm run dev` → 브라우저에서 DevTools Console:

```js
localStorage.clear(); location.reload();
```

확인:
- 온보딩 step 1이 480px 카드 중앙 정렬
- 15개 칩이 2×8 grid로 표시
- 이름 입력 박스 테두리 명확

- [ ] **Step 8-2: step 진행 시나리오**

관심사 2개 이상 클릭 → "다음" 버튼 활성화 + 폭 480px 이내 full-width → 클릭.

- [ ] **Step 8-3: step 2 API 키 시나리오**

API 키 input이 password 마스킹, 테두리 명확. "이전" / "완료" 버튼 가로 1:1 배치. (완료는 키 검증 전이라 비활성화 상태)

- [ ] **Step 8-4: 데스크톱 반응형**

브라우저 창 1280px → step 1 재진입 (DevTools Console `localStorage.clear(); location.reload();`):
- 칩 grid가 3×5로 재배치
- 카드 자체는 480px 유지

- [ ] **Step 8-5: 다크 모드**

본 앱 진입 후 설정 탭에서 다크 토글 → `localStorage.clear(); location.reload();` → 온보딩에서:
- 배경 다크, 칩 배경 `--bg-card`(`#1E293B`)
- 선택된 칩은 여전히 primary 배경 + 흰 텍스트 구분됨
- input 배경 `--bg-input` (`#334155`), 텍스트 가독성 OK

---

## Task 9: 커밋

모든 CSS 변경을 하나의 chore 커밋으로.

- [ ] **Step 9-1: 변경 파일 확인**

Run: `git status --short && git diff --stat`
Expected: `src/styles/main.css` 1개 파일만 변경됨

- [ ] **Step 9-2: diff 간단 리뷰**

Run: `git diff src/styles/main.css | head -120`
Expected:
- `.onboarding` 블록에 `align-items`, `gap`, `padding` 추가
- 새 규칙 블록 7~8개 덩어리
- `@media (min-width: 768px)` 내부에 `.onboarding-grid { grid-template-columns: repeat(3, 1fr); }` 1줄

- [ ] **Step 9-3: 커밋**

```bash
git add src/styles/main.css
git commit -m "chore(onboarding): add missing v3.1 onboarding styles + desktop grid

- .onboarding 컨테이너: align-items/gap/padding 추가
- .onboarding-steps/-grid/-chip/-help/-status/-nav-row 규칙 추가
- input[type=text|password] 스타일 (스코프 한정)
- 480px 카드 중앙 정렬, @768px에서 관심사 grid 3-column
- TS/HTML/테스트 변경 0건, 87 vitest + 9 smoke 유지"
```

---

## Task 10: 배포 승인 게이트 + 배포

- [ ] **Step 10-1: 사용자 승인 요청**

배포 전 사용자에게 알림:

> "온보딩 styling chore 완료. 87 vitest + 9 smoke + 빌드 모두 green. 프로덕션 배포할까요?"

사용자 승인 대기. 승인 없으면 여기서 **멈춤**.

- [ ] **Step 10-2: 배포**

사용자 승인 후:

```bash
npm run build && firebase deploy
```

Expected: `https://my-ai-assistant-904f3.web.app`에 반영

- [ ] **Step 10-3: 프로덕션 재확인**

프로덕션 URL에서 시크릿 창으로 열기 → Task 8의 시나리오 1(첫 방문)을 재확인:
- 칩 grid 2-column(모바일 폭) 또는 3-column(데스크톱 폭) 정상
- 중앙 정렬 카드 레이아웃
- input/button 스타일 모두 적용

- [ ] **Step 10-4: 메인 브랜치 병합**

```bash
git checkout main
git merge --no-ff chore/onboarding-styling -m "Merge chore/onboarding-styling — v3.1 UI hotfix"
git branch -d chore/onboarding-styling
```

> 푸시는 사용자가 "push해줘"라고 명시적으로 요청할 때만.

- [ ] **Step 10-5: 메모리 업데이트**

`/Users/hayden/.claude/projects/-Users-hayden-Hayden-AX-Project-my-ai-assistance/memory/project_daily_growth_phase_g.md`의 "🎨 알려진 UI 스타일 이슈" 섹션을 ✅ 완료로 마킹하고, "다음 세션" 섹션의 옵션 2(chore)을 완료로 표시. 옵션 1(v3.2a 슬랙)이 다음 작업임을 명시.

---

## 완료 조건 (DoD)

- [ ] `src/styles/main.css` 단일 파일 변경
- [ ] 87 vitest + 9 Playwright smoke 모두 pass
- [ ] `npm run build` 성공
- [ ] 로컬 5개 시나리오 통과
- [ ] 프로덕션 URL에서 시나리오 1 재확인
- [ ] chore 커밋 1개 (TS/HTML/테스트 수정 0)
- [ ] 메모리 업데이트 완료
- [ ] 다음 세션은 v3.2a 슬랙 연동 브레인스토밍임을 메모리에 명시

---

## 다음 플랜 (별도 세션)

v3.2a 슬랙 연동 — 브레인스토밍부터 다시 시작.
