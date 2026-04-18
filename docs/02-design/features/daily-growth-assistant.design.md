# Daily Growth Assistant Design Document

> **Summary**: Phase 1 클라이언트 기능 완성 — 단일 HTML 유지하면서 JS 논리적 섹션 구조화 + 새 기능 추가
>
> **Project**: Daily Growth Assistant (데일리 그로스)
> **Version**: v1.2 → v1.5 (Phase 1)
> **Author**: Hayden (황석준)
> **Date**: 2026-04-04
> **Status**: Draft
> **Planning Doc**: [daily-growth-assistant.plan.md](../../01-plan/features/daily-growth-assistant.plan.md)
> **PM Analysis**: [daily-growth-assistant.prd.md](../../00-pm/daily-growth-assistant.prd.md)

---

## Context Anchor

> Copied from Plan document. Ensures strategic context survives Design->Do handoff.

| Key | Value |
|-----|-------|
| **WHY** | 바쁜 업무 속에서 체계적 학습/성찰 루틴이 부재하여 성장이 정체됨 |
| **WHO** | Primary: Hayden (HR/GA), Secondary: 데이터라이즈 전 직원 |
| **RISK** | Gemini Free tier 축소, 단일 HTML 확장성 한계, localStorage 데이터 유실 |
| **SUCCESS** | 주 5일+ 사용률, D7 리텐션 30%+, 온보딩->첫 AI 대화 완료율 60%+ |
| **SCOPE** | Phase 1: 클라이언트 기능 완성 + PWA + Firebase 배포 준비 |

---

## 1. Overview

### 1.1 Design Goals

1. 기존 동작하는 기능의 회귀 없이 새 기능 추가
2. JS 코드를 논리적 섹션으로 구조화하여 Phase 3 Next.js 전환 비용 최소화
3. API 추상화 레이어 도입으로 Gemini 외 모델 교체 용이하게 설계
4. Data 레이어 추상화로 localStorage -> Supabase 전환 준비
5. PM 분석에서 도출된 "체험 먼저" 모드와 리텐션 측정 기반 구축

### 1.2 Design Principles

- **Pragmatic Balance**: 단일 HTML 유지하되 JS를 명확한 섹션으로 구분
- **Abstraction at Boundaries**: API, Data, RSS 호출을 래퍼 함수로 추상화
- **Progressive Enhancement**: API 키 없이도 기본 체험 가능, 키 있으면 AI 기능 활성화
- **Mobile First**: 모든 새 UI를 모바일 기준으로 설계, 데스크톱은 반응형 확장
- **Zero Regression**: 기존 기능에 영향 주지 않는 방식으로 추가

---

## 2. Architecture Selection

### 2.0 Architecture Comparison

| Criteria | Option A: Minimal | Option B: Clean | **Option C: Pragmatic** |
|----------|:-:|:-:|:-:|
| **Approach** | 기존 파일에 직접 추가 | JS 별도 모듈 파일 분리 | **단일 파일 내 섹션 구조화** |
| **New Files** | 2 (manifest, sw) | 12+ | **3 (manifest, sw, icons)** |
| **Modified Files** | 1 | 1 (HTML only) | **1** |
| **Complexity** | Low | High | **Medium** |
| **Maintainability** | Low (2500줄 혼재) | High | **Medium-High** |
| **Effort** | 3-4일 | 7-8일 | **5-6일** |
| **Phase 3 전환 비용** | High (재작성) | Low (파일 이동만) | **Medium (섹션->모듈 추출)** |

**Selected**: Option C: Pragmatic Balance
**Rationale**: 단일 HTML 배포 편의성을 유지하면서, 논리적 섹션 구분으로 Phase 3 전환 시 각 섹션을 독립 모듈로 추출 가능하게 준비.

---

## 3. JS Code Structure (Pragmatic Sections)

현재 `<script>` 내부를 아래 9개 섹션으로 재구조화:

```
// ============================================
// [Section 1] CONFIG & CONSTANTS
// ============================================
// STORAGE_KEYS, INTERESTS_DATA, RSS_SOURCES, LEVELS, BADGES, Q_TYPES
// + NEW: DEMO_DATA (체험 모드용 샘플 데이터)

// ============================================
// [Section 2] STATE MANAGEMENT
// ============================================
// state 객체 (중앙 상태)
// loadState(), saveState() — 추상화된 상태 관리

// ============================================
// [Section 3] DATA LAYER (Storage Abstraction)
// ============================================
// DataStore.get(key), DataStore.set(key, value)
// DataStore.getAll(prefix), DataStore.remove(key)
// → localStorage 래핑. Phase 2에서 Supabase로 교체 가능
// + NEW: DataStore.migrate() — Phase 2 마이그레이션 지원

// ============================================
// [Section 4] API LAYER (AI & RSS Abstraction)
// ============================================
// AIClient.summarize(text) — 아티클 요약
// AIClient.generateQuestion(context) — 질문 생성
// AIClient.chat(messages) — 대화
// AIClient.isAvailable() — API 키 유무 체크
// RSSClient.fetch(interests) — RSS 가져오기
// + NEW: AIClient.generateInsightCard(answer) — 공유 카드 생성

// ============================================
// [Section 5] ANALYTICS (NEW)
// ============================================
// Analytics.trackEvent(name, data) — 이벤트 로깅
// Analytics.trackSession() — 세션 시작 타임스탬프
// Analytics.getRetention(days) — D7/D30 리텐션 계산
// → localStorage에 이벤트 로그 저장, Phase 2에서 서버로 전송

// ============================================
// [Section 6] UI RENDERERS
// ============================================
// renderBriefings(), renderQuestion(), renderArchive(),
// renderStats(), renderBadges()
// + NEW: renderSearch(), renderMemoEditor(), renderInsightCard()
// + NEW: renderDemoMode() — 체험 모드 UI

// ============================================
// [Section 7] EVENT HANDLERS
// ============================================
// submitAnswer(), sendChatMessage(), toggleScrap(), etc.
// + NEW: addMemo(), shareInsight(), searchArchive()

// ============================================
// [Section 8] NAVIGATION & MODALS
// ============================================
// switchTab(), openModal(), closeModal()

// ============================================
// [Section 9] INITIALIZATION & UTILITIES
// ============================================
// DOMContentLoaded handler, initApp()
// getDateStr(), escapeHtml(), stripHtml(), showToast()
```

---

## 4. New Features Design

### 4.1 "체험 먼저" 모드 (FR-14a) — PM Priority: High

**목적**: API 키 없이 샘플 브리핑/질문 체험으로 온보딩 이탈 방지

**설계**:
```
DEMO_DATA = {
  briefings: [
    { title: "AI 면접관의 시대가 온다", summary: "...", insight: "..." },
    { title: "심리적 안전감, 측정할 수 있을까", ... },
    { title: "MZ세대가 원하는 복리후생 TOP 5", ... }
  ],
  question: {
    question: "오늘 가장 개선하고 싶은 업무 프로세스 1가지는?",
    hint: "반복적으로 시간이 드는 작업\n매번 비슷한 실수가 나는 부분",
    type: "실무", icon: "...", label: "실무형 질문"
  }
}
```

**플로우**:
1. 온보딩 Step 3에서 "나중에 설정할게요" 클릭 시 → `state.demoMode = true`
2. `loadBriefings()`: demoMode이면 DEMO_DATA 사용 (API 호출 안 함)
3. `loadTodayQuestion()`: demoMode이면 DEMO_DATA.question 사용
4. AI 대화는 비활성 (버튼에 "API 키를 설정하면 AI와 대화할 수 있어요" 표시)
5. 답변 제출은 가능 (localStorage 저장) — 데모에서도 XP 획득
6. 홈 화면 상단에 배너: "지금은 체험 모드예요. AI 기능을 활성화하려면 [설정에서 API 키 입력]"

### 4.2 아티클 메모 기능 (FR-09)

**설계**:
- 각 briefing 객체에 `memo: string` 필드 추가
- 브리핑 카드에 "메모" 버튼 추가 (기존 스크랩/원문 옆)
- 클릭 시 인라인 textarea 토글 (모달 없이 카드 내부 확장)
- 메모 저장 시 XP +3, `state.briefings` 업데이트 후 localStorage 저장
- 메모 있는 아티클은 카드에 연필 아이콘 표시

```
<button class="card-action-btn" onclick="toggleMemo(${index}, event)">
  ${b.memo ? '📝 메모 수정' : '✏️ 메모'}
</button>
<!-- 메모 입력 영역 (토글) -->
<div class="card-memo ${b.memo ? 'show' : ''}" id="memo-${index}">
  <textarea placeholder="이 아티클에 대한 메모...">${b.memo || ''}</textarea>
  <button onclick="saveMemo(${index})">저장</button>
</div>
```

### 4.3 아카이브 검색 + 기간 필터 (FR-10)

**설계**:
- 아카이브 상단에 검색 input 추가
- 기간 필터: "전체" / "이번 주" / "이번 달" / "직접 선택"
- 검색 대상: question, answer, insight 텍스트
- 클라이언트 사이드 필터링 (데이터가 localStorage에 있으므로)

```html
<input type="search" id="archiveSearch"
       placeholder="질문, 답변, 인사이트 검색..."
       oninput="searchArchive()">
<select id="archivePeriod" onchange="searchArchive()">
  <option value="all">전체 기간</option>
  <option value="week">이번 주</option>
  <option value="month">이번 달</option>
</select>
```

### 4.4 스크랩 모아보기 (FR-11)

**설계**:
- 아카이브 탭의 필터에 "스크랩" 칩 추가
- `state.briefings`에서 `scrapped: true`인 항목만 필터
- 과거 날짜의 스크랩도 보려면 별도 `dg_scraps` 키에 누적 저장

```javascript
// 스크랩 시 별도 저장소에도 누적
function toggleScrap(index, event) {
  // ... 기존 로직 ...
  if (state.briefings[index].scrapped) {
    const scraps = DataStore.get('scraps') || [];
    scraps.push({ ...state.briefings[index], scrapDate: getDateStr() });
    DataStore.set('scraps', scraps);
  }
}
```

### 4.5 접속 타임스탬프 로깅 (FR-14b)

**설계**:
```javascript
const Analytics = {
  trackSession() {
    const sessions = DataStore.get('sessions') || [];
    sessions.push({
      date: getDateStr(),
      time: new Date().toISOString(),
      hour: new Date().getHours()
    });
    // 최근 90일만 유지
    const cutoff = new Date(Date.now() - 90 * 86400000).toISOString();
    DataStore.set('sessions', sessions.filter(s => s.time > cutoff));
  },
  getRetention(days) {
    const sessions = DataStore.get('sessions') || [];
    const firstDate = sessions[0]?.date;
    if (!firstDate) return 0;
    const targetDate = getDateStr(new Date(
      new Date(firstDate).getTime() + days * 86400000
    ));
    return sessions.some(s => s.date === targetDate) ? 1 : 0;
  }
};
```

### 4.6 "오늘의 인사이트 카드" 공유 (FR-14c)

**설계**:
- 답변 제출 후 + AI 대화 정리 후 "인사이트 카드 만들기" 버튼 표시
- Canvas API로 이미지 생성 (다운로드 가능)
- 카드 내용: 오늘의 질문 + 핵심 인사이트 1줄 + 날짜 + 앱 로고

```javascript
async function generateInsightCard() {
  const canvas = document.createElement('canvas');
  canvas.width = 600; canvas.height = 400;
  const ctx = canvas.getContext('2d');

  // 배경
  ctx.fillStyle = '#4F46E5';
  ctx.fillRect(0, 0, 600, 400);

  // 텍스트
  ctx.fillStyle = '#fff';
  ctx.font = '18px "Noto Sans KR"';
  ctx.fillText('Daily Growth', 30, 40);
  ctx.font = '16px "Noto Sans KR"';
  wrapText(ctx, state.todayQuestion.question, 30, 100, 540, 24);

  // 인사이트
  ctx.fillStyle = '#FEF3C7';
  // ... 인사이트 텍스트 ...

  // 다운로드
  canvas.toBlob(blob => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `growth-${getDateStr()}.png`;
    a.click();
  });
}
```

### 4.7 PWA (FR-12)

**manifest.json**:
```json
{
  "name": "Daily Growth Assistant",
  "short_name": "데일리그로스",
  "start_url": "/daily-growth.html",
  "display": "standalone",
  "background_color": "#FFFFFF",
  "theme_color": "#4F46E5",
  "icons": [
    { "src": "icons/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "icons/icon-512.png", "sizes": "512x512", "type": "image/png" }
  ]
}
```

**sw.js (Service Worker)**:
```javascript
const CACHE_NAME = 'dg-v1';
const STATIC_ASSETS = ['/daily-growth.html', '/manifest.json'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE_NAME).then(c => c.addAll(STATIC_ASSETS)));
});

self.addEventListener('fetch', e => {
  // Network-first for API calls, Cache-first for static
  if (e.request.url.includes('generativelanguage') ||
      e.request.url.includes('rss2json')) {
    e.respondWith(fetch(e.request).catch(() => caches.match(e.request)));
  } else {
    e.respondWith(caches.match(e.request).then(r => r || fetch(e.request)));
  }
});
```

### 4.8 반응형 데스크톱 레이아웃 (FR-14)

**설계**: 481px+ 화면에서 2-column 레이아웃

```css
@media (min-width: 768px) {
  .app-container {
    max-width: 960px;
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 20px;
    padding: 20px;
  }
  .header, .streak-banner, .bottom-nav {
    grid-column: 1 / -1;
  }
  .briefing-scroll { grid-column: 1 / -1; }
  .question-section { grid-column: 1; }
  .chat-container { grid-column: 2; }
}
```

---

## 5. Data Model Changes

### 5.1 localStorage Key Map

| Key | Type | New/Existing | Description |
|-----|------|:------------:|-------------|
| `dg_user` | JSON | Existing | 사용자 프로필 + stats |
| `dg_gemini_key` | string | Existing | API 키 |
| `dg_briefings` | JSON[] | Modified | + memo 필드 추가 |
| `dg_answers` | JSON[] | Existing | 답변 기록 |
| `dg_today_q` | JSON | Existing | 오늘의 질문 |
| `dg_scraps` | JSON[] | **New** | 누적 스크랩 모음 |
| `dg_sessions` | JSON[] | **New** | 접속 타임스탬프 (리텐션) |
| `dg_events` | JSON[] | **New** | 이벤트 로그 (분석용) |
| `dg_onboarded` | string | Existing | 온보딩 완료 여부 |
| `dg_demo_mode` | boolean | **New** | 체험 모드 여부 |

### 5.2 DataStore Abstraction

```javascript
const DataStore = {
  get(key) {
    try {
      const raw = localStorage.getItem('dg_' + key);
      return raw ? JSON.parse(raw) : null;
    } catch { return null; }
  },
  set(key, value) {
    localStorage.setItem('dg_' + key, JSON.stringify(value));
  },
  remove(key) {
    localStorage.removeItem('dg_' + key);
  },
  // Phase 2: 이 메서드들을 Supabase 호출로 교체
  async migrate(supabaseClient) {
    // localStorage -> Supabase 일괄 전송
  }
};
```

---

## 6. API Abstraction Layer

```javascript
const AIClient = {
  _apiKey: null,

  init() {
    this._apiKey = localStorage.getItem(STORAGE_KEYS.apiKey);
  },

  isAvailable() {
    return !!this._apiKey;
  },

  async _call(prompt, model = 'gemini-2.5-flash', maxTokens = 500) {
    if (!this._apiKey) throw new Error('API key not set');
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${this._apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.7, maxOutputTokens: maxTokens }
        })
      }
    );
    if (!res.ok) throw new Error(`API error: ${res.status}`);
    const data = await res.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
  },

  async summarize(article) {
    return this._call(/* existing prompt */, 'gemini-2.5-flash-lite', 300);
  },

  async generateQuestion(context) {
    return this._call(/* existing prompt */, 'gemini-2.5-flash', 400);
  },

  async chat(messages) {
    // Multi-turn with contents array
  },

  async generateInsightCard(question, answer, insight) {
    // Short insight for card sharing
  }
};
```

---

## 7. CSS Changes

### 7.1 New Styles

```css
/* Demo Mode Banner */
.demo-banner {
  margin: 0 20px 12px; padding: 10px 16px;
  background: var(--accent-light); border-radius: var(--radius-md);
  font-size: 0.85rem; display: flex; align-items: center; gap: 8px;
}
.demo-banner a { color: var(--primary); font-weight: 600; }

/* Article Memo */
.card-memo {
  margin-top: 10px; display: none;
}
.card-memo.show { display: block; }
.card-memo textarea {
  width: 100%; min-height: 60px; padding: 8px;
  border: 1px solid var(--border); border-radius: var(--radius-sm);
  background: var(--bg-input); font-size: 0.85rem;
  font-family: var(--font-body); resize: vertical;
}

/* Archive Search */
.archive-search {
  width: 100%; padding: 10px 14px 10px 36px;
  border: 1px solid var(--border); border-radius: var(--radius-md);
  background: var(--bg-input); font-size: 0.9rem; margin-bottom: 12px;
}
.archive-period {
  padding: 6px 12px; border-radius: var(--radius-sm);
  border: 1px solid var(--border); background: var(--bg-card);
  font-size: 0.8rem; margin-bottom: 12px;
}

/* Insight Card */
.insight-card-btn {
  width: 100%; padding: 12px; margin-top: 12px;
  background: linear-gradient(135deg, var(--primary), #7C3AED);
  color: #fff; border: none; border-radius: var(--radius-md);
  font-weight: 600; cursor: pointer;
}
```

---

## 8. Error Handling Strategy

| Scenario | Current | Improved |
|----------|---------|----------|
| Gemini API 실패 | console.error + 빈 결과 | Toast 알림 + 폴백 데이터 + 재시도 버튼 |
| RSS 가져오기 실패 | empty state | Toast + 캐시된 이전 브리핑 표시 |
| localStorage 용량 초과 | 무시 | 오래된 세션 로그 자동 정리 + 경고 |
| 네트워크 오프라인 | 기능 중단 | Service Worker 캐시에서 서빙 |

---

## 9. File Changes Summary

| File | Action | Changes |
|------|--------|---------|
| `daily-growth.html` | **Modify** | JS 9-섹션 구조화 + 새 기능 추가 (~2800줄 예상) |
| `manifest.json` | **Create** | PWA manifest |
| `sw.js` | **Create** | Service Worker (오프라인) |
| `icons/icon-192.png` | **Create** | PWA 아이콘 (생성 필요) |
| `icons/icon-512.png` | **Create** | PWA 아이콘 (생성 필요) |

---

## 10. Risk Mitigation

| Risk | Mitigation |
|------|------------|
| 리팩토링 중 기존 기능 깨짐 | 섹션별로 이동, 매 섹션 후 수동 테스트 |
| Canvas API 폰트 렌더링 이슈 | 인사이트 카드는 web font 로딩 후 생성 |
| Service Worker 캐시 무효화 | CACHE_NAME 버전 관리로 업데이트 강제 |
| localStorage 5MB 한도 | 90일 초과 세션 로그 자동 정리, 데이터 export 유도 |

---

## 11. Implementation Guide

### 11.1 Implementation Order

| # | Task | Files | Dependencies | Effort |
|---|------|-------|:------------:|:------:|
| 1 | JS 코드 9-섹션 구조화 (리팩토링) | daily-growth.html | 없음 | 1일 |
| 2 | DataStore + AIClient 추상화 레이어 | daily-growth.html | #1 | 0.5일 |
| 3 | "체험 먼저" 모드 (DEMO_DATA + UI) | daily-growth.html | #2 | 0.5일 |
| 4 | 아티클 메모 기능 | daily-growth.html | #2 | 0.5일 |
| 5 | 아카이브 검색 + 기간 필터 | daily-growth.html | #1 | 0.5일 |
| 6 | 스크랩 모아보기 | daily-growth.html | #5 | 0.3일 |
| 7 | Analytics (타임스탬프 로깅) | daily-growth.html | #2 | 0.3일 |
| 8 | 인사이트 카드 공유 | daily-growth.html | #2 | 0.5일 |
| 9 | PWA (manifest + Service Worker) | manifest.json, sw.js | #1 | 0.5일 |
| 10 | 반응형 데스크톱 레이아웃 | daily-growth.html | #1 | 0.5일 |
| 11 | 에러 핸들링 개선 | daily-growth.html | #2 | 0.3일 |

### 11.2 Implementation Dependencies

```
#1 (구조화) ──► #2 (추상화) ──► #3 (체험모드)
                            ──► #4 (메모)
                            ──► #7 (Analytics)
                            ──► #8 (인사이트카드)
                            ──► #11 (에러핸들링)
#1 ──► #5 (검색) ──► #6 (스크랩)
#1 ──► #9 (PWA)
#1 ──► #10 (반응형)
```

### 11.3 Session Guide

Phase 1 구현을 3개 세션으로 분할 권장:

| Session | Scope | Modules | Effort |
|---------|-------|---------|--------|
| **Session 1** | 코드 구조화 + 추상화 | module-1: #1, #2, #11 | 1.5일 |
| **Session 2** | 핵심 새 기능 | module-2: #3, #4, #5, #6, #7 | 2일 |
| **Session 3** | PWA + UI + 공유 | module-3: #8, #9, #10 | 1.5일 |

**Module Map**:
```
module-1: refactoring    → JS 9-섹션 + DataStore + AIClient + 에러핸들링
module-2: features       → 체험모드 + 메모 + 검색 + 스크랩 + Analytics
module-3: pwa-ui-share   → 인사이트카드 + PWA + 반응형
```

`/pdca do daily-growth-assistant --scope module-1` 으로 세션별 구현 가능.

---

## Version History

| Version | Date | Changes | Author |
|---------|------|---------|--------|
| 0.1 | 2026-04-04 | Initial design — Phase 1, Option C Pragmatic | Hayden |
