# Daily Growth Assistant Planning Document

> **Summary**: 매일 아침 관심 분야 아티클 요약 + 성장 질문 + AI 대화를 제공하는 개인 맞춤형 성장 비서 웹앱
>
> **Project**: Daily Growth Assistant (데일리 그로스)
> **Version**: v1.2 → v2.0 (Phase 1~3 로드맵)
> **Author**: Hayden (황석준)
> **Date**: 2026-04-04
> **Status**: Draft
> **PRD Reference**: PRD_Daily_Growth_Assistant_v1.1.md
> **PM Analysis**: docs/00-pm/daily-growth-assistant.prd.md

---

## Executive Summary

| Perspective | Content |
|-------------|---------|
| **Problem** | 직무 관련 아티클을 꾸준히 읽기 어렵고, 학습 내용이 휘발되며, 자기 성찰 루틴이 부재함 |
| **Solution** | 단일 HTML 웹앱에서 RSS 기반 아티클 요약 + AI 성장 질문 + 대화형 코칭을 제공하고, Phase 3에서 Next.js + Supabase 기반 풀스택 앱으로 전환 |
| **Function/UX Effect** | 매일 3분 성장 루틴 습관화, 모바일 퍼스트 카드 UI, XP/레벨 게이미피케이션으로 지속적 동기 부여 |
| **Core Value** | Zero-Cost 운영 + 개인화된 AI 학습 코칭 + 성장 히스토리 아카이빙 |

---

## Context Anchor

> Auto-generated from Executive Summary. Propagated to Design/Do documents for context continuity.

| Key | Value |
|-----|-------|
| **WHY** | 바쁜 업무 속에서 체계적 학습/성찰 루틴이 부재하여 성장이 정체됨 |
| **WHO** | Primary: Hayden (HR/GA), Secondary: 데이터라이즈 전 직원 (확장 대상) |
| **RISK** | Gemini Free tier 축소 가능성, 단일 HTML 파일 확장성 한계, localStorage 데이터 유실 |
| **SUCCESS** | 주 5일 이상 사용률, 답변 평균 100자 이상, 30일 리텐션 60%+, Phase 3 전환 완료 |
| **SCOPE** | Phase 1: 클라이언트 기능 완성 → Phase 2: 클라우드 DB + 인증 → Phase 3: Next.js 전환 + 팀 기능 |

---

## 1. Overview

### 1.1 Purpose

매일 아침 관심 분야에 맞춘 아티클 요약과 성장 질문을 받고, AI와 대화하며 생각을 정리하고, 그 과정이 자동으로 아카이빙되는 개인 맞춤형 성장 비서 웹앱을 완성하고 확장한다.

### 1.2 Background

- 현재 `daily-growth.html` 단일 파일로 MVP 핵심 기능이 대부분 구현됨 (~2050줄)
- Gemini API 클라이언트 직접 호출, rss2json 프록시로 RSS 가져오기, localStorage 저장
- PRD v1.1에서 정의한 Phase 1~3 로드맵을 PDCA 사이클로 체계화하여 진행
- n8n 없이 클라이언트 직접 처리로 운영, Supabase/Firebase DB로 데이터 영속화 검토

### 1.3 Related Documents

- PRD: `PRD_Daily_Growth_Assistant_v1.1.md`
- 현재 구현체: `daily-growth.html`

---

## 2. Scope

### 2.1 In Scope

**Phase 1: 클라이언트 기능 완성 (현재 → 2주)**
- [ ] 기존 코드 품질 개선 (에러 핸들링, 엣지 케이스)
- [ ] 아티클 메모 기능 추가
- [ ] 아카이브 검색 기능 추가
- [ ] 스크랩 아티클 모아보기
- [ ] PWA manifest + Service Worker (오프라인 지원)
- [ ] Firebase Hosting 배포 준비
- [ ] 반응형 개선 (데스크톱 레이아웃)

**Phase 2: 클라우드 DB + 인증 (2~4주)**
- [ ] Supabase 또는 Firebase DB 연동 (localStorage → 클라우드 이전)
- [ ] Firebase Auth (Google OAuth) 멀티유저 지원
- [ ] 데이터 마이그레이션 (localStorage → DB)
- [ ] 주간/월간 성장 리포트 (AI 분석)
- [ ] 주간 챌린지 시스템

**Phase 3: Next.js 전환 + 팀 기능 (4~8주)**
- [ ] Next.js App Router 마이그레이션
- [ ] 컴포넌트 분리 및 모듈화
- [ ] 팀 리더보드 (같은 팀 XP 랭킹)
- [ ] 팀 공동 질문 (익명 공유)
- [ ] 콘텐츠 확장 (팟캐스트/유튜브 요약)
- [ ] 웹 푸시 알림

### 2.2 Out of Scope

- n8n 자동화 워크플로우 (클라이언트 직접 처리로 대체)
- Slack DM 알림 (웹 푸시로 대체)
- Google Sheets DB (Supabase/Firebase로 대체)
- 카카오톡 알림톡
- Notion DB 연동

---

## 3. Requirements

### 3.1 Functional Requirements

| ID | Requirement | Priority | Phase | Status |
|----|-------------|----------|-------|--------|
| FR-01 | 3단계 온보딩 (이름/관심사/API키) | High | 1 | ✅ Done |
| FR-02 | RSS 기반 아티클 수집 + Gemini 요약 | High | 1 | ✅ Done |
| FR-03 | AI 질문 생성 (5개 유형 로테이션) | High | 1 | ✅ Done |
| FR-04 | AI 대화 (5턴 제한, 대화 정리) | High | 1 | ✅ Done |
| FR-05 | XP/레벨/뱃지 게이미피케이션 | High | 1 | ✅ Done |
| FR-06 | 다크모드 + 테마 저장 | Medium | 1 | ✅ Done |
| FR-07 | 데이터 내보내기 (JSON export) | Medium | 1 | ✅ Done |
| FR-08 | 자동 임시저장 (10초 간격) | Medium | 1 | ✅ Done |
| FR-09 | 아티클 메모 기능 | Medium | 1 | Pending |
| FR-10 | 아카이브 검색 + 기간 필터 | Medium | 1 | Pending |
| FR-11 | 스크랩 아티클 모아보기 | Medium | 1 | Pending |
| FR-12 | PWA manifest + Service Worker | High | 1 | Pending |
| FR-13 | Firebase Hosting 배포 | High | 1 | Pending |
| FR-14 | 반응형 데스크톱 레이아웃 | Low | 1 | Pending |
| FR-14a | "체험 먼저" 모드 — API 키 없이 샘플 체험 (PM 권고) | High | 1 | Pending |
| FR-14b | 접속 타임스탬프 로깅 — D7/D30 리텐션 측정 (PM 권고) | Medium | 1 | Pending |
| FR-14c | "오늘의 인사이트 카드" 공유 기능 (PM 권고) | Medium | 1 | Pending |
| FR-14d | 1분 성찰 카드 모드 — 초경량 참여 옵션 (PM 권고) | Low | 1 | Pending |
| FR-15 | Supabase/Firebase DB 연동 | High | 2 | Pending |
| FR-16 | Firebase Auth (Google OAuth) | High | 2 | Pending |
| FR-17 | localStorage → DB 마이그레이션 | High | 2 | Pending |
| FR-18 | 주간/월간 성장 리포트 (AI) | Medium | 2 | Pending |
| FR-19 | 주간 챌린지 시스템 | Medium | 2 | Pending |
| FR-20 | Next.js App Router 마이그레이션 | High | 3 | Pending |
| FR-21 | 컴포넌트 분리 및 모듈화 | High | 3 | Pending |
| FR-22 | 팀 리더보드 | Medium | 3 | Pending |
| FR-23 | 팀 공동 질문 (익명 공유) | Low | 3 | Pending |
| FR-24 | 웹 푸시 알림 | Medium | 3 | Pending |
| FR-25 | 콘텐츠 확장 (팟캐스트/유튜브) | Low | 3 | Pending |

### 3.2 Non-Functional Requirements

| Category | Criteria | Measurement Method |
|----------|----------|-------------------|
| Performance | 첫 로드 < 2초 (모바일 4G) | Lighthouse |
| Performance | Gemini API 응답 < 5초 | 클라이언트 측정 |
| Reliability | 오프라인에서 기존 데이터 접근 가능 | Service Worker 테스트 |
| Security | API Key는 기기에만 저장 (전송 X) | 코드 리뷰 |
| Security | Firebase Auth로 인증된 사용자만 DB 접근 (Phase 2) | Security Rules |
| Accessibility | 키보드 내비게이션 지원 | 수동 테스트 |
| Accessibility | 최소 터치 영역 44x44px | CSS 검증 |
| Cost | Phase 1: $0 (Gemini Free tier + Firebase Spark) | 비용 모니터링 |
| Cost | Phase 2: < $5/월 (Supabase Free tier) | 비용 모니터링 |

---

## 4. Success Criteria

### 4.1 Definition of Done

**Phase 1:**
- [ ] 모든 기존 기능이 정상 작동 (회귀 없음)
- [ ] FR-09 ~ FR-14 구현 완료
- [ ] PWA 설치 가능 (모바일 홈 화면 추가)
- [ ] Firebase Hosting에 배포 완료
- [ ] 모바일/데스크톱 반응형 정상 작동

**Phase 2:**
- [ ] Supabase/Firebase DB에 데이터 저장/조회 정상
- [ ] Google OAuth 로그인/로그아웃 정상
- [ ] 기존 localStorage 데이터 → DB 마이그레이션 도구 작동
- [ ] 주간 리포트 AI 생성 정상

**Phase 3:**
- [ ] Next.js App Router로 전체 기능 마이그레이션 완료
- [ ] 컴포넌트 단위 분리 (페이지당 독립 컴포넌트)
- [ ] 팀 기능 (리더보드, 공동 질문) 정상 작동

### 4.2 Quality Criteria

- [ ] Lighthouse Performance 점수 > 90 (Phase 1)
- [ ] 에러 없는 콘솔 (API 실패 시 graceful fallback)
- [ ] 모든 주요 플로우 수동 QA 완료

### 4.3 Key Metrics (PM Analysis)

| Metric | Target | Phase |
|--------|--------|-------|
| **North Star**: 주간 활성 학습 세션 수 | WAU × 세션 완료율 > 70% | 1 |
| **Activation**: 온보딩 → 첫 AI 대화 완료 | 완료율 > 60% | 1 |
| **D7 Retention** | > 30% | 1 |
| **D30 Retention** | > 15% | 2 |
| **Moments of Truth** | M1(첫 3분) → M2(7일 스트릭) → M3(첫 공유) | 1-2 |

---

## 5. Risks and Mitigation

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| Gemini Free tier 축소/폐지 | High | Medium | Tier 1 전환 준비 (실비용 미미). API 추상화 레이어로 모델 교체 용이하게 설계 |
| 단일 HTML 2000줄+ 관리 어려움 | Medium | High | Phase 3에서 Next.js 전환. 그 전까지 코드 섹션별 주석으로 관리 |
| localStorage 데이터 유실 (브라우저 초기화) | High | Medium | Phase 2에서 DB 이전. Phase 1에서는 JSON export 기능으로 수동 백업 유도 |
| rss2json 프록시 서비스 중단 | Medium | Low | 대체 프록시(AllOrigins, cors-anywhere) 준비. 자체 프록시 Vercel Function 배포 |
| Supabase Free tier 한도 초과 (Phase 2) | Low | Low | 10명 기준 충분 (500MB DB, 1GB Storage). 초과 시 Pro 플랜 $25/월 |
| Next.js 마이그레이션 복잡도 (Phase 3) | Medium | Medium | 점진적 마이그레이션. 기존 로직을 모듈별로 추출 후 컴포넌트화 |

---

## 6. Impact Analysis

### 6.1 Changed Resources

| Resource | Type | Change Description |
|----------|------|--------------------|
| daily-growth.html | Frontend (단일 파일) | Phase 1: 기능 추가/개선. Phase 3에서 Next.js로 분해 |
| localStorage | Data Store | Phase 2에서 Supabase/Firebase DB로 이전 |
| Gemini API 호출 | External API | API 추상화 레이어 추가 (모델 교체 용이) |

### 6.2 Current Consumers

| Resource | Operation | Code Path | Impact |
|----------|-----------|-----------|--------|
| localStorage | READ/WRITE | loadUserData(), saveUser(), loadBriefings(), submitAnswer() 등 전체 | Phase 2에서 DB 래퍼로 교체 필요 |
| Gemini API | POST | callGemini(), callGeminiChat() | API 추상화 레이어로 래핑 |
| rss2json | GET | fetchRSSArticles() | 프록시 추상화 |

### 6.3 Verification

- [ ] Phase 1: 기존 기능 회귀 테스트 (수동 QA)
- [ ] Phase 2: localStorage → DB 마이그레이션 후 데이터 무결성 확인
- [ ] Phase 3: Next.js 전환 후 전체 기능 동작 확인

---

## 7. Architecture Considerations

### 7.1 Project Level Selection

| Level | Characteristics | Recommended For | Selected |
|-------|-----------------|-----------------|:--------:|
| **Starter** | Simple structure (`components/`, `lib/`, `types/`) | Static sites, portfolios, landing pages | Phase 1 |
| **Dynamic** | Feature-based modules, BaaS integration | Web apps with backend, SaaS MVPs | Phase 2 |
| **Enterprise** | Strict layer separation, DI, microservices | High-traffic systems | ☐ |

> Phase 1은 Starter (단일 HTML), Phase 2~3에서 Dynamic (Next.js + Supabase)으로 전환

### 7.2 Key Architectural Decisions

| Decision | Options | Selected | Rationale |
|----------|---------|----------|-----------|
| Frontend (Phase 1) | 단일 HTML / Vite+React | **단일 HTML 유지** | 현재 코드 활용, 즉시 배포 가능 |
| Frontend (Phase 3) | Next.js / Vite+React / Astro | **Next.js App Router** | SSR/SSG, 이미지 최적화, Vercel 배포 친화적 |
| State (Phase 1) | 전역 변수 / localStorage | **전역 변수 + localStorage** | 현재 패턴 유지 |
| State (Phase 3) | Context / Zustand / Jotai | **Zustand** | 가볍고 보일러플레이트 최소 |
| DB (Phase 2) | Google Sheets / Supabase / Firestore | **Supabase (검토)** | Free tier 충분, PostgreSQL, Auth 내장, 실시간 구독 |
| Auth (Phase 2) | Firebase Auth / Supabase Auth | **DB 선택에 따라 결정** | Supabase 선택 시 Supabase Auth, Firebase 선택 시 Firebase Auth |
| Hosting (Phase 1) | Firebase Hosting / Vercel / Netlify | **Firebase Hosting** | PRD 방침, $0, SSL 자동 |
| Hosting (Phase 3) | Firebase / Vercel | **Vercel** | Next.js 최적 배포 환경 |
| AI API | Gemini / Claude / OpenAI | **Gemini** | Free tier, PRD 방침 |
| RSS Proxy | rss2json / AllOrigins / 자체 | **rss2json (현재)** | 이미 동작, 안정적 |
| Styling (Phase 3) | CSS Modules / Tailwind / vanilla | **Tailwind CSS** | 빠른 개발, Next.js 통합 |
| Testing | 수동 QA / Vitest / Playwright | **수동 QA (Phase 1)** → Vitest (Phase 3) | 단일 HTML에선 테스트 프레임워크 불필요 |

### 7.3 Clean Architecture Approach

```
Phase 1 (Starter - 현재):
  daily-growth.html          ← 단일 파일 (HTML+CSS+JS)
  manifest.json              ← PWA manifest
  sw.js                      ← Service Worker

Phase 2 (Dynamic - 전환 준비):
  daily-growth.html          ← 기능 유지 + DB 연동 코드 추가
  lib/supabase.js            ← DB 클라이언트 (또는 인라인)
  
Phase 3 (Dynamic - Next.js):
  src/
  ├── app/                   ← Next.js App Router pages
  │   ├── page.tsx           ← 홈 (브리핑 + 질문)
  │   ├── archive/page.tsx   ← 아카이브
  │   ├── stats/page.tsx     ← 성장 통계
  │   └── settings/page.tsx  ← 설정
  ├── components/            ← 재사용 컴포넌트
  │   ├── BriefingCard.tsx
  │   ├── QuestionSection.tsx
  │   ├── ChatContainer.tsx
  │   └── ...
  ├── lib/                   ← 유틸리티
  │   ├── gemini.ts          ← AI API 클라이언트
  │   ├── supabase.ts        ← DB 클라이언트
  │   └── rss.ts             ← RSS 페칭
  ├── stores/                ← Zustand 스토어
  │   ├── userStore.ts
  │   └── briefingStore.ts
  └── types/                 ← TypeScript 타입
      └── index.ts
```

---

## 8. Convention Prerequisites

### 8.1 Existing Project Conventions

- [ ] `CLAUDE.md` has coding conventions section — **없음 (생성 필요)**
- [ ] `docs/01-plan/conventions.md` exists — **없음**
- [ ] ESLint configuration — **없음 (Phase 3에서 추가)**
- [ ] Prettier configuration — **없음 (Phase 3에서 추가)**
- [ ] TypeScript configuration — **없음 (Phase 3에서 추가)**

### 8.2 Conventions to Define/Verify

| Category | Current State | To Define | Priority |
|----------|---------------|-----------|:--------:|
| **Naming** | JS: camelCase 함수/변수 | Phase 3: 컴포넌트 PascalCase, 훅 use- prefix | Medium |
| **Folder structure** | 단일 파일 | Phase 3: Next.js App Router 구조 | High |
| **CSS** | CSS Variables + 인라인 | Phase 3: Tailwind CSS 클래스 | Medium |
| **API 호출** | fetch 직접 호출 | callGemini 래퍼 유지, Phase 3에서 서버 액션 | Medium |
| **Error handling** | try-catch + toast | 일관된 에러 핸들링 패턴 정의 | Medium |

### 8.3 Environment Variables Needed

| Variable | Purpose | Scope | Phase |
|----------|---------|-------|:-----:|
| `GEMINI_API_KEY` | Gemini AI API (사용자별 localStorage) | Client | 1 |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase 프로젝트 URL | Client | 2 |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key | Client | 2 |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase 서버 전용 키 | Server | 3 |

---

## 9. Phase별 실행 계획

### Phase 1: 클라이언트 기능 완성 (1~2주)

| 순서 | 작업 | 예상 시간 | 산출물 |
|------|------|----------|--------|
| 1 | 코드 품질 개선 (에러 핸들링, 엣지 케이스) | 0.5일 | 수정된 HTML |
| 2 | 아티클 메모 기능 (FR-09) | 0.5일 | 수정된 HTML |
| 3 | 아카이브 검색 + 기간 필터 (FR-10) | 0.5일 | 수정된 HTML |
| 4 | 스크랩 모아보기 (FR-11) | 0.5일 | 수정된 HTML |
| 5 | PWA manifest + Service Worker (FR-12) | 0.5일 | manifest.json, sw.js |
| 6 | Firebase Hosting 배포 (FR-13) | 0.5일 | 라이브 URL |
| 7 | 반응형 데스크톱 레이아웃 (FR-14) | 0.5일 | 수정된 HTML |

### Phase 2: 클라우드 DB + 인증 (2~4주)

| 순서 | 작업 | 예상 시간 | 산출물 |
|------|------|----------|--------|
| 1 | Supabase 프로젝트 설정 + 테이블 설계 | 1일 | DB 스키마 |
| 2 | Firebase Auth (Google OAuth) 설정 | 1일 | Auth 설정 |
| 3 | 데이터 액세스 레이어 (localStorage ↔ DB) | 2일 | 추상화 코드 |
| 4 | localStorage → DB 마이그레이션 도구 | 1일 | 마이그레이션 코드 |
| 5 | 주간/월간 성장 리포트 AI 생성 | 1일 | 리포트 UI + 로직 |
| 6 | 주간 챌린지 시스템 | 1일 | 챌린지 UI + 로직 |

### Phase 3: Next.js 전환 + 팀 기능 (4~8주)

| 순서 | 작업 | 예상 시간 | 산출물 |
|------|------|----------|--------|
| 1 | Next.js 프로젝트 초기 설정 | 1일 | 프로젝트 구조 |
| 2 | 기존 HTML → React 컴포넌트 분해 | 3일 | 컴포넌트 파일들 |
| 3 | Zustand 스토어 설정 | 1일 | 스토어 파일들 |
| 4 | Supabase 서버 액션 통합 | 2일 | 서버 코드 |
| 5 | 팀 기능 (리더보드, 공동 질문) | 3일 | 팀 기능 페이지 |
| 6 | 웹 푸시 알림 | 1일 | Push 설정 |
| 7 | 콘텐츠 확장 (팟캐스트/유튜브) | 2일 | 확장 로직 |
| 8 | Vercel 배포 + 도메인 설정 | 0.5일 | 라이브 URL |

---

## 10. Next Steps

1. [ ] Design 문서 작성 (`daily-growth-assistant.design.md`) — Phase 1 집중
2. [ ] Phase 1 구현 시작
3. [ ] Phase 1 완료 후 Gap Analysis
4. [ ] Phase 2 Design 별도 PDCA 사이클

---

## Version History

| Version | Date | Changes | Author |
|---------|------|---------|--------|
| 0.1 | 2026-04-04 | Initial draft — 전체 로드맵 (Phase 1~3) Plan 수립 | Hayden |
