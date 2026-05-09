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

**Bundle 측정 표준 (v3.14.5 T5 graduation)**: 사이클 retro에 bundle 절대값 기록 시 `gzip -c dist/assets/index-*.js | wc -c` 단일 stream을 canonical로 기록한다. vite reporter chunked estimation은 dual-record 폐기 (v3.14.4가 마지막 사례).

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

권한 issue 시: spec self-review로 사전 대체 가능, 단 최종은 cycle wrap-up에서 별도 시점 재시도
(v3.14.2 retro 패턴 — Codex 권한 미작동으로 review 누락된 사이클은 차기 사이클 carry-forward).

### graduate 명문화 (v3.18~v3.23 7사이클 ROI)

사전 review가 v3.18~v3.23 7사이클 연속 P0 catch (chain superset / KST anchor / TZ sweep / silent corruption guard 등). v3.24 T1에서 graduate:

- **mandatory dispatch**: 각 사이클 T0 plan v1 작성 직후 (T2 진입 전 완료 의무).
- **P0/P1 plan 반영 전 구현 금지**: 사전 review 결과 P0가 있으면 plan v2 in-cycle 흡수, T2 진입 X.
- **CLI 한도 fallback**: controller self-review (`pr-review-toolkit:code-reviewer` 등) 허용 (v3.14.5 / v3.20 / v3.24 선례), 단 retro에 명시.

---

## Documentation Navigation

**📋 Master Index**: `docs/INDEX.md` - Complete navigation with token costs

### Core References
- **Common Mistakes**: `.claude/COMMON_MISTAKES.md` ⚠️ **MANDATORY**
- **Quick Start**: `.claude/QUICK_START.md`
- **Architecture Map**: `.claude/ARCHITECTURE_MAP.md`
- **Maintenance**: `.claude/DOCUMENTATION_MAINTENANCE.md`

---

**Last Updated**: 2026-05-03
**Optimized with**: [Claude Token Optimizer](https://github.com/nadimtuhin/claude-token-optimizer)
