# Daily Growth Phase 5 — Master Plan (Zero-Trust Pilot)

> **Status:** Master overview only. Each workstream has its own sub-plan that drills into bite-sized tasks.
> **Source spec:** `_bmad-output/brainstorming/brainstorming-session-2026-04-18-0715.md`
> **Date:** 2026-04-18
> **Owner:** Hayden (HR/GA, Datarize)

---

## 1. Goal

Datarize 50명 사내 파일럿을 8~12주 안에 launch — PIPA·보안팀 통과, adoption 70%+, 월 운영비 $20 미만.

## 2. Product Identity (3-line)

1. HR도 동료도 함부로 보지 못한다. 익명 기여는 **Opt-In**으로만 이뤄진다.
2. 앱을 열지 않아도 된다. **Slack 한 줄, 위젯 한 탭**으로 충분하다.
3. AI는 매일 깊어지지 않는다. **입사·분기·퇴사** 같은 인생 이벤트에만 깊이 개입한다.

## 3. Architecture (one paragraph)

기존 단일 HTML(`daily-growth.html`, 3967 lines, 69 inline onclick)을 Vite 기반 모듈 구조로 전환한 뒤, Firebase Auth (Google Workspace SSO) + Cloud Functions 프록시 + Firestore 감사 로그 위에 W1~W5 기능을 올린다. Gemini 키는 클라이언트에서 제거되고 모든 LLM 호출은 idempotency key가 부여된 서버측 프록시를 경유한다. 데이터 모델은 첫날부터 `schemaVersion` 필드를 부착해 Phase 6 마이그레이션에 대비한다.

## 4. Tech Stack

- **Build:** Vite + TypeScript + Vitest
- **Frontend:** Vanilla TS modules (no framework yet — Phase 6 React 검토)
- **Backend:** Firebase (Spark plan) — Auth, Firestore, Functions, FCM, Hosting
- **LLM:** Gemini Flash Lite via Cloud Functions proxy
- **Observability:** Sentry browser SDK (free tier first)
- **Slack:** Bolt for JavaScript on Cloud Functions
- **Identity:** Google Workspace SSO

## 5. Workstream Breakdown (31 atoms)

| Workstream | Atoms | Sub-plan file | Sequence |
|---|---|---|---|
| **TD — Tech Debt Foundations** | 3 + 3 patches (TD-1/2/3, P5-X1/2/3) | `2026-04-18-phase5-td-foundations.md` | **Week 1-3** |
| **W1 — Zero-Trust Foundation** | 5 + 7 patches (W1-a~e, P5-X4/5/7/8/14, +X1 carry-over) | `2026-XX-XX-phase5-w1-zerotrust.md` | Week 2-6 (overlaps TD) |
| **W2 — Slack-First Access** | 2 + 3 patches (W2-a/c, P5-X6/9/10) | `2026-XX-XX-phase5-w2-slack.md` | Week 7-9 |
| **W3 — Opt-In Lens MVP** | 2 + 1 patch (W3-a/b, P5-X11) | `2026-XX-XX-phase5-w3-optin.md` | Week 5-7 (lightweight, slot anywhere) |
| **W4 — Soft Rhythm** | 4 + 1 patch (W4-a/c/f/g, P5-X12) | `2026-XX-XX-phase5-w4-rhythm.md` | Week 7-9 |
| **W5 — Journey Coach (Onboarding 30d)** | 1 + 1 patch (W5-a, P5-X13) | `2026-XX-XX-phase5-w5-journey.md` | Week 10-12 |

> Sub-plan filenames marked `2026-XX-XX` are placeholders — they get a real date when written. Only TD is written in this session per "단계적 분할" approach.

## 6. Sequencing & Dependencies

```
Week 1-3   TD-1 모듈화 + Vite      ← 모든 확장의 전제
           TD-2 CSP/escapeHtml    (TD-1 완료 후 활성)
           TD-3 Sentry            (TD-1 끝나면 즉시)
           P5-X1 schemaVersion    (TD-1과 함께)
           ─────────────────────
Week 2-6   W1-a SSO              (TD-1 module skeleton 위에서 시작)
           W1-b Cloud Functions proxy + P5-X5 idempotencyKey + P5-X14 quota alarm
           W1-c 감사 로그
           W1-d export/delete + P5-X4 NDJSON streaming + P5-X8 policyVersion
           W1-e 권한 라벨 UI
           ─────────────────────
Week 5-7   W3-a Opt-In 토글
           W3-b "매니저가 볼 수 있는 것" 배너 + P5-X11 k<5 메시지
           ─────────────────────
Week 7-9   W2-a Slack /growth + P5-X9 mapping + P5-X10 webhook rotation
           W2-c FCM push + P5-X6 token refresh
           W4-a 이달의 리듬
           W4-c 복귀 환영
           W4-f 미니멀 모드
           W4-g 리텐션 대시보드 + P5-X12 metric definition
           ─────────────────────
Week 10-12 W5-a 신규입사 30일 트랙 + P5-X13 inactive auto-cancel
           Pilot launch + QA
```

## 7. Success Criteria (Phase 5 완료 시점)

- [ ] 법무·보안팀 PIPA 통과 (SSO + 감사로그 + export/delete + 국외이전 동의)
- [ ] 50명 파일럿 가입 (Datarize 전체)
- [ ] 2주차 리텐션 60%+ (스트릭 없이)
- [ ] 신규입사자 8명 이상 30일 트랙 완주
- [ ] "매니저가 볼 수 있는 것" 홈 배너 클릭률 30%+
- [ ] Slack `/growth` 로 제출된 답변 비율 40%+
- [ ] 월 운영비 $20 미만 (Sentry 유료 시 +$26)

## 8. Risks (요약)

| Risk | Prob | Impact | Mitigation |
|---|---|---|---|
| 법무 검토 지연 | 중 | 높음 | Week 1에 법무 접촉 + W1-d/W1-b 동의 문구 템플릿 확보 |
| SSO 연동 (Workspace 관리자 협조) | 중 | 중 | CEO/CTO 사전 합의 |
| 모듈화 마이그 중 리그레션 | 높음 | 중 | TD sub-plan에 E2E 스모크 테스트 선행 |
| Gemini flash-lite 품질 하락 | 낮 | 중 | 주요 기능은 flash 폴백 |
| 개발자 리소스 변동 | 중 | 높음 | Claude Code 스캐폴드 + 계약 개발자 시간제 병행 |

## 9. Cost Envelope

- Firebase Spark: $0
- Gemini Flash Lite: ~$15/mo (50명 × 일 1답변 + 주간 인사이트)
- Sentry free→paid: $0~$26/mo
- Slack: $0
- 도메인: $1/mo
- **합계: $16~$42/mo**

## 10. Phase 6 Gates (참고용, Phase 5 launch 후 해결)

11개 게이트(P6-G1~G11): Opt-In 재동의 월, k 계산 공식, 토픽 필터, 시간 패턴 방어, 팀 이동 재동의, 철회 retro 배치, 월간 active only, i18n 평가자 분기, 트랙 일시중지, 트랙 전환, rubric 가중치 rotation. 상세는 브레인스토밍 spec § Phase 4.5 참조.

## 11. Operational Runbooks (별도 작성)

10개 런북(R-1~R-10): Gemini 키 rotate, Firebase 장애 안내, PIPA 삭제 SLA, 비용 급증, 개발자 이탈 README, M&A, 도메인 변경, 재입사자 merge, 감사 로그 TTL, 데이터 보관 정책. → `docs/superpowers/runbooks/` 별도 (Phase 5 중 점진 작성).

---

## Next Action

`docs/superpowers/plans/2026-04-18-phase5-td-foundations.md` (이 세션에서 작성됨) 참조해서 TD-1 → TD-2 → TD-3 순서로 시작.
