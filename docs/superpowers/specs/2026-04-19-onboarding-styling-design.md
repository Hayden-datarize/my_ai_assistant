# Onboarding Styling + Desktop Layout — Design Spec

- **Date:** 2026-04-19
- **Scope:** v3.1 배포 후 chore (v3.2 진입 전)
- **Branch target:** 신규 chore 브랜치 (예: `chore/onboarding-styling`)
- **Version bump:** 없음 (v3.1 patch, 필요 시 v3.1.1)
- **Estimated effort:** 30~45분

---

## 1. 배경

v3.1 배포(`6c85643`) 후 프로덕션 URL에서 온보딩 첫 화면이 아래처럼 깨져 보임:

- 콘텐츠 좌측 정렬 풀스크린 (max-width 미적용)
- 관심사 15개 칩이 한 줄로 길게 늘어섬 (grid 누락)
- 이름 입력 박스 테두리 거의 보이지 않음
- "다음" 버튼이 풀 폭으로 퍼짐

### 근본 원인

`src/ui/onboarding.ts`가 사용하는 새 클래스 이름(`.onboarding-steps`, `.onboarding-grid`, `.onboarding-chip`, `.onboarding-help`, `.onboarding-status`, `.onboarding-nav-row`)에 대한 CSS 규칙이 `src/styles/main.css`에 전혀 없다. main.css에 남아있는 `.onboard-header` / `.interest-tag` / `.api-key-section` 같은 레거시 v2.0 클래스는 현재 onboarding.ts가 사용하지 않아 dead code 상태.

또한 `.onboarding`은 `position: fixed; inset: 0;`이라 `.app-container`의 `max-width: 480px` 제약 바깥에 위치 → 자체 중앙 정렬 규칙이 없으면 좌측 정렬 풀스크린.

본 앱(홈/아카이브/스탯/설정)은 이미 `@media (min-width: 481px)` / `(min-width: 768px)` 반응형이 있고 정상 동작. 데스크톱 전반 재작업은 **이번 스코프 아님**.

---

## 2. 목표 (Success Criteria)

1. 온보딩 step 1~3 모두 480px 중앙 정렬 카드형 레이아웃으로 렌더
2. step 1 관심사 칩 15개가 2-column grid(모바일) / 3-column(≥768px)으로 배열
3. 이름/API 키 input에 명확한 border·padding·focus ring
4. 이전/다음 버튼이 flex row로 가로 배치 (풀 폭 stretch 제거)
5. 다크 모드 자동 대응 (기존 CSS 변수 `--bg`, `--bg-card`, `--border`, `--text-*` 토큰 재사용)
6. 기존 87 vitest + 9 Playwright smoke **모두 pass**
7. tsc clean, lint clean

---

## 3. 비-목표 (Out of Scope)

- 본 앱 화면 데스크톱 레이아웃 재작업 (이미 OK)
- 레거시 `.onboard-header` / `.interest-tag` / `.api-key-section` dead code 제거 — Phase D P2 백로그에 합류
- onboarding.ts의 markup/DOM 구조 변경
- step 2/3 UX 개선 (에러 메시지 카피, 키 검증 UX 등)
- 신규 브레이크포인트 도입 (≥1440px 울트라와이드 대응)
- 다크 테마 신규 토큰 추가

---

## 4. 설계

### 4.1 파일 변경 범위

| File | 변경 유형 | 설명 |
|------|----------|------|
| `src/styles/main.css` | 수정 | `.onboarding` 섹션(103~123 라인 주변)만 확장. 다른 섹션 불변 |

**TS 파일 수정 0건, HTML 수정 0건, 테스트 수정 0건.**

### 4.2 CSS 변경 상세

기존 `.onboarding` 블록(103~108):

```css
.onboarding {
  position: fixed; inset: 0; background: var(--bg);
  z-index: 900; display: flex; flex-direction: column;
  transition: opacity 0.4s; overflow-y: auto;
}
```

→ 확장:

```css
.onboarding {
  position: fixed; inset: 0; background: var(--bg);
  z-index: 900; display: flex; flex-direction: column;
  align-items: center;                       /* NEW: 자식 가로 중앙 정렬 */
  gap: 12px;                                 /* NEW: 자식 간격 */
  padding: 32px 20px calc(env(safe-area-inset-bottom, 0px) + 32px);
  transition: opacity 0.4s; overflow-y: auto;
}
```

### 4.3 새 온보딩 규칙 추가

`.onboarding.hide` 다음 줄에 추가(레거시 `.onboard-header` 블록은 건드리지 않음):

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

### 4.4 데스크톱 반응형

기존 `@media (min-width: 768px)` 블록(main.css:786-813)의 **끝**에 추가:

```css
@media (min-width: 768px) {
  /* ...기존 app-container/#homeTab rules... */
  .onboarding-grid { grid-template-columns: repeat(3, 1fr); }
}
```

> 온보딩 카드 자체는 480px 유지. 768px 이상에서는 관심사 grid만 3-column(5행)으로 확장해 빈 공간 활용.

### 4.5 버튼 처리

step 1·3의 "다음"/"시작하기" 버튼은 이미 `.btn.btn-primary.btn-block` 클래스를 사용 → `.btn-block`(width: 100%, main.css:179) 때문에 자동으로 480px 한도 안에서 풀 폭. 추가 처리 불필요.

step 2의 `.onboarding-nav-row > button { flex: 1 }`로 이전/완료 가로 균등 분할.

---

## 5. 테스트 전략

### 5.1 자동화 게이트 (변경 없음)

- `npm run lint` — CSS 린트 없음(stylelint 미사용). ESLint는 TS only이므로 영향 없음
- `npm run typecheck` — CSS 변경 무관, green 유지
- `npm run test` — 87 vitest, CSS 변경 무관
- `npm run test:smoke` — 9 Playwright smoke. `boot.spec.ts`는 온보딩 vs 메인 앱 분기를 확인하므로 **선택자(`#onboarding`, `#obName`, `#obApiKeyInput`, `#obCompleteBtn`, `#obEnterAppBtn`)가 불변해야 함** → 온보딩.ts를 수정 안 하므로 pass

### 5.2 수동 확인 (Deploy 전)

`npm run dev` + 로컬 브라우저로 다음 5개 시나리오:

1. 첫 방문(localStorage 비워둔 상태) → 온보딩 step 1 뜸. 화면 중앙 정렬 카드, 15개 칩 2×8 grid
2. 관심사 2개 이상 선택 → "다음" 활성화, 버튼 full-width 480px 이내
3. step 2 → API 키 input이 명확한 border, password 마스킹. `.onboarding-nav-row` 가로 배치
4. 데스크톱 창 폭 1280px → 3-column grid (5행)
5. 다크 모드 토글 → 색상 자동 대응, 칩 `.selected` 상태 명확히 구분됨

Playwright 수동 실행도 가능: `npm run test:smoke -- boot`

---

## 6. 위험 & 완화

| 위험 | 가능성 | 완화 |
|------|--------|------|
| CSS selector 특이도 충돌 (전역 `input` / `button` 스타일과) | 낮음 | `.onboarding > input`, `.onboarding > button` 자손 선택자로 스코프 한정 |
| 레거시 `.onboard-header` 블록 사용처 재발견 | 매우 낮음 | grep 결과 사용처 0 확인. 그대로 두되 변경 안 함 |
| 768px breakpoint에서 3-column이 칩 라벨 길이 때문에 줄바꿈 | 낮음 | INTERESTS 15개 최장 label = "커뮤니케이션"(7자) + 이모지. padding 12px, font-size 0.9rem, min-width 자동. 시각 확인 시 문제 시 2-column 유지로 fallback |
| iOS Safari `100dvh` + `env(safe-area-inset-bottom)` 계산 실패 | 낮음 | 기존 main.css에서 동일 패턴 다수 사용 중. 문제 재현 시 `--safe-bottom` 변수 사용 |

---

## 7. 구현 순서 (Plan 스케치)

1. `src/styles/main.css` `.onboarding` 블록 확장(4.2) + 새 규칙 추가(4.3)
2. `@media (min-width: 768px)` 블록 확장(4.4)
3. `npm run lint && npm run typecheck && npm run test`
4. `npm run test:smoke -- boot`
5. `npm run dev`로 수동 확인 5가지
6. 다크 모드 토글 확인
7. 커밋: `chore(onboarding): add missing v3.1 onboarding styles + desktop grid`
8. 사용자 승인 후 `npm run build && firebase deploy`
9. 프로덕션 URL에서 동일 시나리오 재확인
10. 메모리 업데이트(`project_daily_growth_phase_g.md` "UI 스타일 이슈" 섹션 완료 표시)

---

## 8. 다음 작업

이 chore 완료 후 **새 세션**에서 v3.2a 슬랙 연동 브레인스토밍 시작. 본 스펙 문서와 별도.
