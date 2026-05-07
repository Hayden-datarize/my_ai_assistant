# Backend Deploy Guide (v3.19+)

> Daily Growth v3.19부터 Slack 봇 알림은 Firebase Functions backend(`sendAnswerDm`)를 사용한다.
> 본 가이드는 Hayden(workspace admin) 1회 setup + 일반 배포/롤백 절차를 다룬다.

## 1회 setup (Hayden 관리자 액션)

### 1. Slack App 생성

1. https://api.slack.com/apps → **Create New App** → **From scratch**
2. App Name: `Daily Growth Bot` (자유), Workspace: **Datarize**
3. 좌측 메뉴 **OAuth & Permissions** → **Scopes** → **Bot Token Scopes** 에 다음 3개 추가:
   - `chat:write` (DM 메시지 작성)
   - `users:read.email` (이메일 → user ID 조회)
   - `im:write` (DM 채널 열기)
4. 동일 화면 상단 **Install to Workspace** → 워크스페이스 admin approve
5. 설치 완료 후 **OAuth Tokens** 섹션의 **"Bot User OAuth Token"** (`xoxb-...`) 복사 → 다음 단계에서 사용

> **확인된 출처**: Slack API methods (https://api.slack.com/methods/users.lookupByEmail / conversations.open / chat.postMessage). T4에서 시그니처 + scope 검증 완료.

### 2. Firebase Blaze 업그레이드

1. Firebase Console → 프로젝트 선택 (`my-ai-assistant-904f3`) → 좌측 톱니 **Project Settings** → 상단 **Usage and billing** 탭
2. **Modify plan** → **Blaze (Pay as you go)** 선택 → 신용카드 등록
3. **무료 사용량(free tier)은 Blaze 플랜에서도 그대로 적용**:
   - Functions 호출: 월 200만 회 무료
   - Functions 컴퓨팅: 월 400,000 GB-초 무료
4. 100명 사용자 × 일 1회 답변 = 월 ~3,000회 → free tier의 0.15% 사용. **실질 비용 0원**.

> 신용카드 등록은 abuse spike 방지를 위한 안전장치이지 정상 사용 시 결제 없음.

### 3. Bot Token Secret Manager 등록

```bash
# default project 명시 — 다른 project에 secret 잘못 저장 사고 방지
firebase use my-ai-assistant-904f3

firebase functions:secrets:set SLACK_BOT_TOKEN
# 프롬프트가 뜨면 1단계에서 복사한 xoxb-... 토큰을 붙여넣기 + Enter
```

> **할루시네이션 가능성 주의**: Firebase Functions 2세대 `defineSecret` 패턴은 본 plan에서 검증된 출처. 만약 CLI 출력이 다르면 `firebase --version` 확인 후 최신으로 upgrade (`npm i -g firebase-tools`).

### 4. 비용 알람 설정 ($5/월)

1. Firebase Console → **Cloud Billing** → **Budgets**
2. **Create Budget**:
   - Name: `daily-growth-monthly-budget`
   - Amount: **$5/월**
   - Threshold rules:
     - 50% 도달 시 이메일
     - 80% 도달 시 이메일
     - 100% 도달 시 이메일
3. Email notification 등록 (Hayden admin 이메일)

> $5는 보통 free tier 안에서는 절대 도달하지 않음. 도달 시 즉시 abuse / config 오류 점검 신호.

### 5. Function 첫 배포

```bash
# functions/ 빌드 + Hosting + Functions 동시 배포
npm run build
firebase deploy --only hosting,functions:sendAnswerDm
```

배포 성공 확인:
```bash
firebase functions:list
# sendAnswerDm | https | us-central1
```

### 6. 본인 이메일 등록 + 테스트

1. https://my-ai-assistant-904f3.web.app 진입
2. **Settings** 탭 → **Slack 봇 알림** 섹션
3. 회사 슬랙 등록 이메일 입력 (예: `hayden@datarize.ai`)
4. **🔗 테스트** 버튼 클릭
5. 본인 슬랙 DM에 샘플 메시지 도착 확인:
   ```
   🌱 Daily Growth — 2026-05-07
   ❓ 오늘의 질문
   샘플 — Daily Growth Slack 연결 테스트
   ✍️ 나의 답변
   본인 DM에 봇 메시지가 도착하면 연결 성공입니다.
   ```
6. **자동 전송 toggle** 켜기 → 답변 제출 시마다 자동 발송

## 일반 배포 (코드 변경 후)

```bash
# 변경 검증
npm run build
gzip -c dist/assets/index-*.js | wc -c   # bundle CLI canonical

# Hosting + Functions 동시 배포
firebase deploy --only hosting,functions:sendAnswerDm
```

Hosting만 변경 (frontend only):
```bash
firebase deploy --only hosting
```

Functions만 변경 (backend only):
```bash
firebase deploy --only functions:sendAnswerDm
```

## 롤백

### 옵션 A: Function 이전 버전 복구

```bash
firebase functions:rollback sendAnswerDm
```

### 옵션 B: Git 이전 commit revert + 재배포

```bash
git log --oneline -10            # 이전 안정 commit 확인
git revert <commit-hash>         # 또는 git reset --hard <commit-hash>
npm run build
firebase deploy --only hosting,functions:sendAnswerDm
```

> **사용자 정책**: `git push --force` 또는 `git reset --hard`는 사용자가 명시적으로 요청한 경우에만 실행 (CLAUDE.md 절대 규칙).

## 모니터링

| 항목 | 위치 |
|---|---|
| Function 로그 | Firebase Console → Functions → `sendAnswerDm` → **Logs** |
| 사용량 (호출 수) | Firebase Console → Functions → **Usage** |
| 비용 | Firebase Console → Cloud Billing → **Reports** |
| Secret 상태 | `firebase functions:secrets:access SLACK_BOT_TOKEN` (출력은 token 앞 4자만) |

## 가드 6중 (운영 한도)

본 backend는 abuse / 비용 spike 방지 6중 가드를 적용한다:

| 가드 | 값 | 효과 |
|---|---|---|
| 답변 길이 cap | 500자 | payload 크기 제한 (frontend + backend 검증) |
| 도메인 화이트리스트 | `@datarize.ai` | 외부인 spam 차단 |
| per-email 일일 limit | 10회 | 정상 1회 + 재시도 + 다중 답변 여유 |
| per-email 1분 burst | 3회 | flood 차단 |
| Function `maxInstances` | 1 | 동시 spike 비용 cap |
| Firebase 비용 알람 | $5/월 | 이상 trigger 즉시 인지 |

> **트레이드오프**: 일일 limit은 in-memory Map으로 enforce — Cloud Functions 2세대 idle scale-to-zero 시 cold start로 카운트 reset 가능. 정확한 일일 limit이 필요하면 v3.20에서 Firestore 마이그레이션 carry-forward.

## 에러 응답 분류

| HTTP Status | error code | 의미 | 사용자 액션 |
|---|---|---|---|
| 400 | `invalid_email` | 도메인 화이트리스트 불일치 또는 형식 오류 | 회사 이메일 다시 입력 |
| 400 | `invalid_answer` | 답변 길이 0 또는 500자 초과 | 답변 길이 조정 |
| 400 | `invalid_question` | 질문 비어 있음 | 새 질문 fetch |
| 404 | `user_not_found` | Slack 워크스페이스 멤버 아님 (이메일 오타 등) | 입력 이메일 재확인 |
| 405 | `method_not_allowed` | POST 외 메서드 | 정상 사용 시 발생 안 함 |
| 429 | `rate_limited` (kind: burst/daily) | 가드 한도 도달 | 잠시 후 재시도 |
| 502 | `lookup_failed` | Slack API scope/auth issue (admin 액션 필요) | Bot Token + scope 재확인 |
| 502 | `dm_open_failed` | DM 채널 열기 실패 | 봇이 워크스페이스에 install됐는지 확인 |
| 502 | `post_message_failed` | DM 발송 실패 | Slack 측 outage 가능 |
| 502 | `slack_upstream` | Slack API 5xx | Slack outage 대기 |
| 500 | `internal` | 알 수 없는 에러 | Function 로그 점검 |

## 보안 자가진단

- **Secrets**: Bot Token은 Firebase Secret Manager에 보관 — 코드/git/환경변수 노출 0
- **CORS**: Hosting rewrite로 same-origin (`/api/sendAnswerDm`) — 다른 도메인 호출 차단
- **CSP**: `connect-src` 정책에 외부 token 추가 없음 (`'self'` only)
- **Rate limit**: 6중 가드로 abuse / 비용 spike 차단
- **Slack mrkdwn injection**: backend `escapeMrkdwn`으로 user input 6 character escape
- **Email validation**: 도메인 화이트리스트 + frontend HTML5 + backend strict 검증

## 차기 사이클 carry-forward (v3.20+)

- in-memory rate limit → Firestore 마이그레이션 (cold start reset 차단)
- silent migration UX (이전 webhook 사용자 안내 토스트)
- console.info 진단 → import.meta.env.DEV 가드 (가설 fix 검증 후 sunset)
- v3.18 P2 7건 + v3.17 §7.2 신규 기능 5건 (식물 detail / Streak Freeze / 등)
