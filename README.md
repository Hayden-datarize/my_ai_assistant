# Daily Growth Assistant (daily-growth)

> 매일의 성장 습관을 추적하고, AI 브리핑·게임화(정원 가꾸기/미션/레벨)로 동기를 유지하는 개인용 AI 어시스턴트 웹앱.

## 📌 개요

- **목적 / 해결하는 문제**: 하루 단위의 학습·성장 활동을 기록하고, 관심사 기반 RSS 큐레이션과 Gemini AI 브리핑을 제공해 "오늘 무엇을 하면 좋을지"를 자연스럽게 이어가도록 돕는다. 히트맵·정원·레벨 등 게임화 요소로 꾸준함을 시각화한다.
- **주요 사용자**: 개인 사용자(본인 + 사내 동료) — 프레임워크 없는 가벼운 SPA로 브라우저에서 바로 사용.
- **핵심 기능**
  - 관심사 기반 RSS 수집 + Gemini AI 일일 브리핑 / 번역
  - 성장 활동 히트맵 시각화 및 아카이브(스크랩) 관리
  - 게임화: 정원 가꾸기(plant), 미션(mission), 레벨·뱃지·업적
  - Slack 연동 — 질문 전송 및 답변 DM 수신(Firebase Functions 경유)
  - localStorage 기반 영속화 + 스키마 마이그레이션
  - Firebase App Check(reCAPTCHA v3)로 백엔드 호출 보호

## 🛠 기술 스택

- **프레임워크 / 언어 / 런타임**: Vite + TypeScript(strict) 바닐라 SPA, 프레임워크 없음
- **DB / 인프라**: 클라이언트 상태는 `localStorage`(`dg.*` 네임스페이스), 정적 호스팅은 Firebase Hosting, 서버리스 백엔드는 Firebase Functions(Node 22, firebase-admin)
- **주요 외부 연동**
  - Google Generative Language API (Gemini) — AI 브리핑·번역
  - RSS (rss2json) — 관심사 콘텐츠 수집
  - Slack Webhook / DM — 질문·답변 전송
  - Firebase App Check + reCAPTCHA v3 — 호출 보호
- **테스트 / 품질**: Vitest(jsdom 단위 테스트), Playwright(스모크 E2E), ESLint, knip(dead-code)

## 📁 폴더 구조

| 경로 | 설명 |
| --- | --- |
| `src/` | 프론트엔드 SPA 소스 (`main.ts`가 엔트리) |
| `src/state/` | 도메인 상태 + localStorage 게이트웨이 (스키마/마이그레이션/유저/게임 상태) |
| `src/services/` | 외부 API 통신 (gemini, rss, slack, translate, appCheck) |
| `src/ui/` | DOM 조작·이벤트 배선 (탭/모달/핸들러/온보딩 등) |
| `src/utils/` | 순수 헬퍼 (날짜·랭킹·토스트·XSS 방어 등, 순환 의존 금지) |
| `src/styles/` | CSS (디자인 토큰 + 컴포넌트/레이아웃) |
| `functions/` | Firebase Functions 백엔드 (Slack 답변 DM, rate limit) |
| `tests/` | Playwright 스모크 + Vitest 테스트 스펙 |
| `docs/` | 기획(PRD)·설계·분석·배포·보안 문서 |
| `dist/` | 빌드 산출물 (firebase deploy 대상, 직접 수정 금지) |

## 🚀 시작하기

```bash
# 의존성 설치
npm install

# 개발 서버 (Vite, 포트 5173)
npm run dev

# 프로덕션 빌드 (tsc 타입체크 + vite build → dist/)
npm run build

# 빌드 산출물 미리보기 (포트 4173)
npm run preview

# 테스트
npm test            # Vitest 단위 테스트 (1회 실행)
npm run test:watch  # Vitest 워치 모드
npm run test:smoke  # Playwright 스모크 E2E
npm run lint        # ESLint (src/ + tests/)
npm run knip        # 미사용 코드 검사

# 백엔드(functions) — functions/ 디렉토리에서
cd functions
npm install
npm run build       # tsc 컴파일
npm test            # Vitest
npm run serve       # Firebase 에뮬레이터 (functions)
```

## 🔑 환경 변수

값은 커밋하지 않으며, 프론트엔드 빌드 변수는 `.env.example`을 참고해 `.env.local`(gitignored)에 채운다. 모두 Vite 빌드 타임에 주입되는 `VITE_` 접두 변수다.

| 변수 이름 | 용도 |
| --- | --- |
| `VITE_APP_CHECK_SITE_KEY` | reCAPTCHA v3 site key (App Check) |
| `VITE_FIREBASE_API_KEY` | Firebase Web 앱 apiKey |
| `VITE_FIREBASE_APP_ID` | Firebase Web 앱 appId |

> Gemini / Slack 등 사용자별 API 키·웹훅 URL은 환경 변수가 아니라 앱 내 설정(localStorage)에서 관리된다. Slack 답변 DM 등 서버 측 시크릿은 Firebase Functions 환경에서 별도 보관한다.

## 🚢 배포

- **프론트엔드**: `npm run build`로 `dist/` 생성 후 `firebase deploy --only hosting`. origin 원격이 없는 **main 직배포 패턴**이며, 사용자가 명시적으로 승인했을 때만 배포한다(PR 워크플로 미사용).
- **백엔드**: `functions/`에서 `npm run deploy`(= `firebase deploy --only functions`).
- 보안 기능(App Check 등)은 "관측 → 강제"의 2단계 롤아웃을 따른다. 자세한 절차는 `docs/DEPLOY_BACKEND.md` 참고.

## 📝 참고

- `CLAUDE.md` — 프로젝트 작업 규칙, 사이클 워크플로, 배포·리뷰 패턴 (Claude Code용 가이드)
- `docs/INDEX.md` — 전체 문서 내비게이션
- `docs/QUICK_REFERENCE.md` / `docs/DEPLOY_BACKEND.md` — 빠른 참조 / 백엔드 배포
- `.claude/ARCHITECTURE_MAP.md` — 파일 구조 및 책임 경계
- `.claude/COMMON_MISTAKES.md` — 반복 실수 / 주의사항
- `PRD_Daily_Growth_Assistant_v1.1.md` — 제품 요구사항 정의서
