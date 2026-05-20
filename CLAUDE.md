# CLAUDE.md

**Quick-start guide for Claude Code - Complete details in linked docs**

---

## Project Overview

Vite + TypeScript SPA application for Daily growth habit tracking with Slack integration and heatmap visualization

**Tech Stack**: Vite, TypeScript, Firebase Hosting, Vitest, Playwright

---

## Session Start Protocol ⚡

**MANDATORY** at start of each session:

```bash
# 1. Load essential docs (~800 tokens - 2 min read)
✓ .claude/COMMON_MISTAKES.md      # ⚠️ CRITICAL - Read FIRST
✓ .claude/QUICK_START.md          # Essential commands
✓ .claude/ARCHITECTURE_MAP.md     # File locations
```

**At task completion:**
- Create completion doc in `.claude/completions/YYYY-MM-DD-task-name.md`
- Use template: `.claude/templates/completion-template.md`
- Move session file to `.claude/sessions/archive/` (if created)
- Update docs as needed (see `.claude/DOCUMENTATION_MAINTENANCE.md`)

**Then load task-specific docs** (~500-1500 tokens):
- See `docs/INDEX.md` for navigation guide

**⚠️ NEVER auto-load:**
- Files in `.claude/completions/` (0 token cost)
- Files in `.claude/sessions/` (0 token cost)
- Files in `docs/archive/` (0 token cost)
- Only load when user explicitly requests

---

## Quick Start Commands

```bash
# Development
npm run dev          # Vite dev server (port 5173)
npm run build        # Production build (tsc + vite)
npm run preview      # Preview built dist/ (port 4173)

# Tests
npm test             # Vitest unit tests (single run)
npm run test:watch   # Vitest watch mode
npm run test:smoke   # Playwright smoke
npm run lint         # ESLint on src/ + tests/

# Deploy (origin remote 미등록 — main 직배포 패턴)
firebase deploy --only hosting   # 사용자 명시 승인 후
```

**See**: `.claude/QUICK_START.md` for complete command reference

---

## Cycle Workflow (v3.14.4 graduation)

각 사이클 내 main work task 완료 시 **3종 검증** 모두 통과해야 다음 task로 진행:

1. **TS strict**: `npx tsc --noEmit` → 0 errors
2. **Lint**: `npm run lint` → 0 errors  *(v3.14.4 T5 graduation, v3.14.3 lesson #5)*
3. **Tests**: `npm test -- <영향 범위>` → PASS, 신규 spec은 N=5 5/5

사이클 끝(배포 직전): `npm run lint && npm test && npm run test:smoke` 3종 일괄 재확인.

**Bundle 측정 표준 (v3.14.5 T5 graduation, v3.35 T4 extension)**:

1. **Canonical (deploy gate)** — main entry size:
   `gzip -c dist/assets/index-*.js | wc -c`

2. **Archive chunk (dual record, v3.35+, archive 영역 변경 시 누락 catch)**:
   `gzip -c dist/assets/archive-*.js | wc -c`
   (`archive-*.js` glob은 archive handler + archive-detail modal 2 chunk 합산 매칭)

사이클 retro §Bundle 측정에 두 값 모두 기록. Threshold:

- index (canonical): GREEN ≤ +300 B / AMBER ≤ +500 B (v3.14.5 그대로)
- archive chunk (archive 영역 변경 시만 적용): GREEN ≤ +300 B / AMBER ≤ +600 B soft (lazy load이라 first paint 영향 X, index 보다 관대)

vite reporter chunked estimation은 dual-record 폐기 (v3.14.4가 마지막 사례).

**경위 (v3.35 T4 graduation)**: v3.34에서 ranking 코드가 archive dynamic chunk로 emitted됐으나 canonical(index entry)은 size impact를 underestimate (+1.25 kB가 +3 B로만 reflected). archive 영역에 집중되는 변경은 dual record로 가시화 필수.

**Dead-code audit 주기 (v3.44.1 graduate, v3.44 L4 DoD note)**:

knip config의 `ignoreExportsUsedInFile: true` 옵션은 "같은 파일에서만 쓰이는 불필요한 export modifier"를 가린다 (진짜 dead code는 별도 catch). 단 public export surface가 실제로 audit되도록 주기적으로 옵션 없는 run 실행:

- 매 3~5 사이클 또는 schema bump 시점 한 번:
  ```bash
  npx knip --no-progress --include-entry-exports
  ```
- 또는 `knip.json` 임시 `ignoreExportsUsedInFile: false` toggle 후 재실행
- 잡힌 finding 중 진짜 public-only export는 `@public` JSDoc tag로 mark ([COMMON_MISTAKES.md §19](.claude/COMMON_MISTAKES.md) paired)

**외부 SDK 추가 시 lazy chunk 위치 실측 의무 (v3.43 graduate, v3.41 L4 + v3.42 L9)**:

vite vendor chunking이 외부 SDK를 자동으로 별도 chunk에 emit. 보안/외부 SDK 추가 시 chunk 위치 확인 의무:

- caller 함수 내부 `await import(...)`로 옮기면 별도 chunk emit → first-paint 영향 0
- 실측: `gzip -c dist/assets/<chunk-name>-*.js | wc -c`
- 사례: v3.41 firebase SDK 정적 import → `translateToast` lazy chunk에 자동 흡수 (15,044 B), v3.42 App Check caller 내부 `await import` → 별도 `appCheck` chunk 분리 (13,215 B)

dual record (index + archive) 부족 시 quad record (index + archive + 신규 SDK chunk + translateToast 등)로 확장. 신규 chunk가 dynamic chain (home/settings 등)이면 first-paint 영향 0이라 별도 threshold 불요, 단순 기록.

### Schema bump 시 chain superset 필수 spot (v3.40 graduate, 13사이클 ROI)

- migration chain (V2→V3→...→VN) — 모든 prior version에 N으로 가는 경로
- `src/state/user.ts` load (3 spot: hydrate / persist / shape guard) — hard-coded version path 포함
- 신규 entity 추가 시 entity-별 storage migration도 동일

### Spec reviewer checklist (v3.40 graduate, v3.39 T6 사례)

새 predicate/helper/event 정의 시:

- **predicate-defined vs wired**: caller 전수 grep 후 spec §wiring sites에 명시 (v3.39 T6 wiring 미적용 사례)
- **mutation paths 전수 grep** (COMMON_MISTAKES §9 confirm)
- **test mock path stale 여부** (COMMON_MISTAKES §11 confirm)

### Codex 사전 review default checklist (v3.40 graduate, inline)

prompt 신규 파일 미작성 — Codex 사전 review prompt에 명시 불요. default checklist로 자동 검토:

1. Schema chain superset coverage (위 3 spot)
2. interest id ≠ keyword 토큰 (matchesInterest helper 사용 여부 — COMMON_MISTAKES §12)
3. predicate-defined vs wired (caller grep + wiring sites)
4. mutation paths 전수 grep
5. test mock path stale 여부

### Subagent controller fallback 정책 (v3.40 graduate, v3.39 T2/T6 사례)

subagent dispatch 후 controller 의무 검증 3단계:

1. **commit 정합**: `git log --oneline -5`로 expected commit이 main에 반영됐는지 확인
2. **영향 범위 grep 재확인**: subagent가 보고한 영향 범위 외 누락 여부 (예: fixture sweep 일부 미완)
3. **차분 vitest/smoke**: 영향 spec 단위 실행 → PASS 확인

미완 발견 시: controller가 직접 마무리 + retro §lessons에 사례 명시.

### code-reviewer M-rating nit 격상 검토 의무 (v3.40 graduate, v3.39 T8 사례)

code-reviewer agent의 M-rating nit이 다음에 해당하면 P1 격상 검토:

- **사용자 가시 동작 변경** (UX nit)
- **data invariant 영향** (silent corruption 가능)
- **smoke spec workaround 패턴** (production 미해결, 예: dispatchEvent 우회)

격하 사유는 retro §lessons에 명시. 격상 후에는 in-cycle fix 의무.

---

## Deploy 패턴 (v3.14.4 T14 graduation)

본 프로젝트는 **origin remote 미등록 — main 직배포 패턴**을 사용한다:

- 사용자 "배포해줘" 명시 시점에만 `npm run build` → `firebase deploy --only hosting`.
- `git push` 시도 금지 (origin 없음).
- PR 워크플로 N/A (main 직커밋).

---

## Codex 2-pass Review (v3.14.4 T13 graduation, lesson #1)

각 사이클은 다음 두 시점에 **Codex 독립 review**를 받는다:

1. **사전 review (spec phase)** — spec + draft plan 작성 직후. P0/P1/P2 분류, in-cycle 반영.
   - 가치: NaN 직렬화 한계, deep semantics, cross-file invariant 등 **plan controller grep으로 못 잡는 깊이**. v3.14.3 lesson #1.
2. **최종 review (deploy gate)** — 모든 main work commit 후, 배포 직전. `DEPLOY_APPROVED / APPROVED_WITH_NOTES / REJECT` 분류.
   - 사용자 "배포해줘" 명시 시점에 게이트로 작동.
   - **default dispatch** (v3.33 soft 명문화):

     ```bash
     codex exec --skip-git-repo-check -o /tmp/<cycle>-codex-final.txt "<prompt>" < /dev/null
     ```

   - **fallback 단계 정책** (CLI 한도/권한 issue 시):
     1. direct CLI 1차 시도 **의무** — 실패 명시 캡처.
     2. controller `pr-review-toolkit:code-reviewer`로 대체.
     3. **사용자에게 즉시 알림** — fallback 진입 시점 (classification 전, 검증 결과 보고와 함께).
     4. fallback review는 **deploy gate 충족**으로 인정 (배포 차단 X).
     5. retro §verification에 시도 결과 명시 (성공/fallback/실패 사유).
     6. retroactive direct CLI 재시도는 **권고/carry** (필수 X — 외부 권한 회복 시 차기 사이클로).
   - **ROI 근거** (v3.32 L2): direct CLI 성공 시 P0/P1/P2 종합 catch. controller fallback만으로는 P2 catch 부족 입증.

권한 issue 시: spec self-review로 사전 대체 가능. 최종은 위 6단계 fallback 정책 적용 — controller fallback review를 받았으면 deploy gate 충족. **fallback review조차 못 받은 사이클만** 차기 사이클 carry-forward (v3.14.2 retro 패턴 — Codex 권한 완전 미작동 case).

### graduate 명문화 (v3.18~v3.23 7사이클 ROI)

사전 review가 v3.18~v3.23 7사이클 연속 P0 catch (chain superset / KST anchor / TZ sweep / silent corruption guard 등). v3.24 T1에서 graduate:

- **mandatory dispatch**: 각 사이클 T0 plan v1 작성 직후 (T2 진입 전 완료 의무).
- **P0/P1 plan 반영 전 구현 금지**: 사전 review 결과 P0가 있으면 plan v2 in-cycle 흡수, T2 진입 X.
- **CLI 한도 fallback**: controller self-review (`pr-review-toolkit:code-reviewer` 등) 허용 (v3.14.5 / v3.20 / v3.24 선례), 단 retro에 명시.
- **small cycle exception (v3.43 graduate, v3.42 P2-2)**: 신규 schema 0 + 신규 기능 0 + 코드 변경 ≤ 1~2 file (docs/config-only)인 lightweight cycle에서 CLI 1차 시도가 한도/권한/process 중단으로 실패하면 controller self-review로 사전 review 대체 OK. 최종 review는 사이클 type 무관 의무. graduated checklist 5항목은 코드 변경 없는 task에서 N/A로 명시 가능. (사례: v3.43 사전 review CLI killed → controller `pr-review-toolkit:code-reviewer` fallback)

### v3.31 L1 graduation — Codex CLI direct dispatch

사전/최종 review는 subagent dispatch가 아니라 아래 CLI 직접 호출을 기본값으로 한다:

```bash
codex exec --skip-git-repo-check -o /tmp/<cycle>-codex-<pre|final>.txt "<prompt>" < /dev/null
```

v3.30 T0에서 subagent dispatch가 background drop되어 결과 회수에 실패했다. v3.30 T7에서는 `codex exec` 직접 호출이 production stale count P1을 catch했다. 따라서 Codex 2-pass는 direct CLI 우선, 실패 시 controller self-review fallback을 retro에 명시한다.

**stdin redirect 의무 (v3.44 graduate, v3.43 L4 ROI)**: `codex exec "$PROMPT"` foreground/background 호출 시 `< /dev/null` redirect 명시 (위 default command에도 포함됨). 미명시 시 "Reading additional input from stdin..." 메시지로 stall + output file 미생성. v3.43 T3 1차 시도가 background로 stall, 2차 시도 `< /dev/null` foreground로 정상 완료한 사례에서 graduate.

### Single Fix Point Preference (v3.31 L5)

mutation 이후 여러 caller가 같은 UI 갱신을 필요로 하면 caller마다 patch하지 말고 `rerenderList()` 같은 단일 진입점에 side-effect를 추가할 수 있는지 먼저 검토한다. v3.30 T7 P1 fix는 `rerenderList()` 1줄로 13 caller의 archive count stale 문제를 닫았다.

---

## 보안 기능 도입 default 패턴 (v3.43 graduate, v3.41 L2 ROI)

외부 SDK 보안 기능 (App Check, reCAPTCHA Enterprise, Cloud Armor 등) 도입 시 **2-phase rollout** 표준 적용:

1. **Phase A — 관측**: SDK client 배포 + 측정 모드 (token/signal 발급률 ≥ 99% 24h 모니터링). race 차단 + production-first 안전. 구체 toggle은 SDK별 console 참조.
2. **Phase B — 강제**: backend 측 enforce 활성. 정보 누출 회피 위한 generic 응답 정합 (예: not-found / auth-fail 경로는 202 응답).

**적용 사례**: v3.41 T1 App Check (console "Monitor mode" → "Enforce" 2-phase 패턴) + v3.41 carry C1 (Phase B 24h monitor 후 별도 cycle).

**다중 보안층 정합**: 인증/검증 SDK + 정적 GCP 제한 (예: HTTP referrer)은 redundant가 아닌 다중 layer. SDK가 strict하지만 정적 제한은 abuse 안전망. 둘 다 적용 권장 (v3.43 v2 결정으로 GCP referrer는 endpoint coverage 확장 시점에 도입 — v3.44+ carry).

---

## Documentation Navigation

**📋 Master Index**: `docs/INDEX.md` - Complete navigation with token costs

### Core References
- **Common Mistakes**: `.claude/COMMON_MISTAKES.md` ⚠️ **MANDATORY** (v3.26 T6부터 git tracked — `.gitignore` 예외 `!.claude/COMMON_MISTAKES.md`. controller auto-load + git audit + cross-machine consistency 동시 만족)
- **Quick Start**: `.claude/QUICK_START.md`
- **Architecture Map**: `.claude/ARCHITECTURE_MAP.md`
- **Maintenance**: `.claude/DOCUMENTATION_MAINTENANCE.md`

---

**Last Updated**: 2026-05-03
**Optimized with**: [Claude Token Optimizer](https://github.com/nadimtuhin/claude-token-optimizer)
