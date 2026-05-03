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
