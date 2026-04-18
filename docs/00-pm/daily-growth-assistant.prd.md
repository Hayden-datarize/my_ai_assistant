# PM Analysis: Daily Growth Assistant

> **Date**: 2026-04-04
> **Author**: PM Agent Team (pm-discovery + pm-strategy + pm-research)
> **Status**: Completed

---

## Executive Summary

Daily Growth Assistant는 바쁜 스타트업 직원이 매일 3분 안에 직무 관련 인사이트를 소화하고, AI 코칭 대화로 생각을 언어화하며, 성장 기록을 축적할 수 있는 무료 웹앱이다.

**핵심 발견**: 한국어 + AI 코칭 + 3분 루틴 조합을 제공하는 경쟁사는 현재 없으며, "만드는 사람이 곧 핵심 사용자"라는 구조가 최대 전략적 자산이다.

---

## 1. Value Proposition (JTBD 6-Part)

| Part | Content |
|------|---------|
| **Who** | Hayden (HR/GA, Datarize) — 스타트업 HR 담당자. 확장: 전 직원 10~50명 |
| **Why** | "배워야 한다는 건 알지만 바쁜 업무 속에서 학습이 계속 밀린다" |
| **What Before** | RSS 구독하다 말기, LinkedIn 스크롤 시간 낭비, 학습 메모 분산, AI에 매번 컨텍스트 재설정 |
| **How** | 아침 앱 열기 → AI 요약 브리핑 → 맞춤 성장 질문 → AI 코칭 대화(5턴) → 자동 아카이빙 |
| **What After** | 매일 "성장했다"는 감각, 커리어 포트폴리오형 기록, 1:1 미팅에서 자기 언어로 성장 설명 |
| **Alternatives** | Readwise(유료/영어), ChatGPT(컨텍스트 재설정), Notion(수동 작성), 뉴닉(일방향/코칭 없음) |

**Value Prop**: "내 직무를 아는 AI가 매일 아침 나를 코칭한다 — 무료로, 10분으로, 기록으로 남긴다."

---

## 2. Lean Canvas

| Section | Content |
|---------|---------|
| **Problem** | 1. 학습 루틴 부재 2. AI 도구의 컨텍스트 재설정 비용 3. 학습 축적감 부재 |
| **Solution** | 1. 3분 아침 브리핑 2. 맥락 유지 AI 코칭 3. 성장 아카이브 + 게이미피케이션 |
| **UVP** | "내 직무를 아는 AI가 매일 아침 코칭 — 무료로, 10분으로, 기록으로" |
| **Unfair Advantage** | Zero-cost 구조, 사용자=개발자 피드백 루프, 조직 맥락 데이터 |
| **Channels** | Firebase URL 직접 공유 → PWA 홈 화면 → Web Push → LinkedIn/HR 커뮤니티 |
| **Customer Segments** | Primary: HR/GA (Hayden), Early Adopter: Datarize 성장 지향 팀원 5~15명 |
| **Key Metrics** | WAU, D7/D30 리텐션, 5턴 대화 완료율, 아카이브 누적 수 |
| **Cost** | $0 (Gemini Free + Firebase Spark). Phase 2: Supabase Free |
| **Revenue** | 현재 $0 (내부 도구). 장기: 팀 플랜 SaaS, Usage-based |

---

## 3. Opportunity Solution Tree

```
Outcome: DAU 50% 유지 × 신규 온보딩 완료율 70%

├── Opp 1: "매일 앱 열 이유 부재" [Score: 0.90] ← 최우선
│   ├── Sol A: 1분 성찰 카드 (초경량 UX)
│   ├── Sol B: 콘텐츠 시간대 개인화
│   └── Sol C: "오늘의 한 문장" 마이크로 콘텐츠
│
├── Opp 2: "온보딩이 복잡하다" [Score: 0.85]
│   ├── Sol A: 공용 API 키 서버 관리
│   ├── Sol B: "체험 먼저" 모드 (API 키 없이 샘플)
│   └── Sol C: Google OAuth + 자동 프로비저닝 (Phase 2)
│
├── Opp 3: "2주 후 동기 상실" [Score: 0.80]
│   ├── Sol A: 성장 타임라인 시각화
│   ├── Sol B: 팀 학습 챌린지
│   └── Sol C: XP → 실질 혜택 연동
│
└── Opp 4: "팀 성장 지원 어려움" [Score: 0.72]
    ├── Sol A: HR 전용 팀 대시보드
    └── Sol B: 주간 팀 성장 리포트 자동 발송
```

---

## 4. SWOT Analysis

| | Helpful | Harmful |
|---|---------|---------|
| **Internal** | **S**: Zero-cost, 맥락유지 AI, 완성된 코어루프, 사용자=개발자 | **W**: 단일 HTML 2050줄, 클라이언트 API 키 노출, localStorage 유실, 1인 개발 |
| **External** | **O**: AI 코칭 시장 성장, 한국 스타트업 HR 시장 공백, Datarize 팀 자연 확장 | **T**: Gemini Free tier 축소, rss2json SPOF, 대형 AI 서비스 루틴 기능 추가 |

**SO 전략**: Zero-cost + 완성된 코어루프로 Datarize 내 빠른 배포 → 팀 학습 문화 레퍼런스
**WT 전략**: Next.js 마이그레이션으로 API 키 보안 + Supabase로 데이터 유실 동시 해결

---

## 5. Competitive Landscape

| 경쟁사 | 유형 | 한국어 | AI코칭 | 무료 | 루틴구조 | 위협도 |
|--------|------|:------:|:------:|:----:|:-------:|:------:|
| **Readwise** | 학습 도구 | X | X | X | O | 중간 |
| **뉴닉** | 뉴스레터 | O | X | O | X | 낮음 |
| **Fabulous** | 습관 앱 | △ | X | X | O | 낮음 |
| **Notion AI** | 협업 도구 | O | △ | △ | X | 중간 |
| **GeekNews/요즘IT** | 커뮤니티 | O | X | O | X | 낮음 |

**차별화 공백**: 한국어 + AI 코칭 질문 + 3분 루틴 + 무료 = **어떤 경쟁사도 점유하지 않은 포지션**

---

## 6. User Personas

### Primary: 김하연 (HR/GA, 29세)
- JTBD: "HR 전문가로서 성장하고 있다는 확신을 얻고 싶다"
- 핵심 페인: 정보 과부하, 고립감, 자기계발 작심삼일
- 예상치 못한 인사이트: **"완독보다 체크인 행위 자체에서 동기를 얻는다"**

### Secondary: 이준혁 (개발자/PM, 32세)
- JTBD: "기술 트렌드와 프로덕트 감각을 동시에 키우고 싶다"
- 핵심 페인: 도메인 간 연결 부재, AI 컨텍스트 비용
- 예상치 못한 인사이트: **"학습보다 '빌드할 아이디어 발굴'이 실질 동기"**

### Tertiary: 박소연 (마케팅, 27세)
- JTBD: "부담 없이 해볼 수 있는 자기계발을 원한다"
- 핵심 페인: 심리적 진입 장벽, 유료 구독 불안
- 예상치 못한 인사이트: **"'자기계발' 라벨 자체에 피로감. '오늘의 발견'이 더 끌린다"**

---

## 7. Market Sizing

| 지표 | 규모 | 산출 근거 |
|------|------|----------|
| **TAM** | ~$36B | 글로벌 기업 학습·생산성 SaaS 시장 |
| **SAM** | ~$180M | 한국 스타트업·IT기업 종사자 학습 도구 시장 (25만 명 × 월 6천원) |
| **SOM (1년)** | 250~1,000명 | Datarize + 유사 스타트업 50~100개사 |

---

## 8. Key Assumptions to Validate

| # | 가정 | 위험도 | 검증 방법 | 성공 기준 |
|---|------|:------:|----------|----------|
| 1 | 매일 아침 습관 형성 | 높음 | 타임스탬프 로그 + 2주 관찰 | D7 리텐션 30%+ |
| 2 | API 키가 핵심 이탈 원인 | 높음 | 동료 3명 온보딩 화면 녹화 | 2/3 이상 이탈 지점 언급 |
| 3 | 팀원 자발적 사용 의향 | 높음 | 팀 대시보드 목업 반응 수집 | 5명 중 3명+ "써보고 싶다" |
| 4 | 게임화 2주+ 효과 | 중간 | 코호트 리텐션 (Week1 vs Week2) | W2/W1 접속 비율 ≥ 0.7 |
| 5 | 공유 기능이 바이럴 핵심 | 중간 | "인사이트 카드" 공유 기능 추가 후 관찰 | 주 1회 이상 공유 사용자 20%+ |

---

## 9. Plan 문서 반영 권고사항

PM 분석 결과 기존 Plan에 반영해야 할 사항:

### Phase 1 추가/변경
1. **"체험 먼저" 모드 추가** (FR-NEW-1): API 키 없이 샘플 브리핑/질문 체험 가능
2. **접속 타임스탬프 로깅** (FR-NEW-2): D7/D30 리텐션 측정을 위한 기초 데이터
3. **"오늘의 인사이트 카드" 공유** (FR-NEW-3): 바이럴 루프의 시작점
4. **1분 성찰 카드 모드** (FR-NEW-4): 시간 없을 때 초경량 참여 옵션

### Phase 2 우선순위 조정
- 주간 리포트를 **팀 확장 전에** 구현 (HR이 팀에 보여줄 레퍼런스)
- 팀 대시보드 목업을 **Phase 2 시작 전에 검증** (Concierge test)

### 핵심 지표 추가
- **North Star**: 주간 활성 학습 세션 수 (WAU × 세션 완료율)
- **Activation**: 온보딩 → 첫 AI 코칭 대화 완료율
- **Moments of Truth**: M1(첫 3분) → M2(7일 스트릭) → M3(첫 공유)

---

*Attribution: pm-skills (Pawel Huryn, MIT License), Teresa Torres OST framework*
