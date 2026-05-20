# Learnings Index

**Lightweight index - detailed content in `.claude/COMMON_MISTAKES.md` and `CLAUDE.md`.**

---

## Quick References (Always Available - ~800 tokens)

- **Common Mistakes**: `.claude/COMMON_MISTAKES.md` ⚠️ **READ AT SESSION START** (§1~§18, v3.43 기준)
- **Quick Start**: `.claude/QUICK_START.md`
- **Architecture**: `.claude/ARCHITECTURE_MAP.md`
- **Maintenance**: `.claude/DOCUMENTATION_MAINTENANCE.md`

## Recent Graduates (v3.40 ~ v3.43)

- §12 interest id ≠ keyword 토큰 (v3.40)
- §13 Dead control 제거 8-layer grep 의무 (v3.43 from v3.41 T6)
- §14 3-layer URL guard (write+read+render) (v3.43 from v3.41 T4)
- §15 외부 SDK 추가 시 CSP 3-layer 동시 갱신 (v3.43 from v3.41 T1, §3 확장)
- §16 Migrate fast-path normalize 일관성 (v3.43 from v3.41)
- §17 Smoke flake → synthetic isolated test 우선 (v3.43 from v3.42 T2)
- §18 vi.mock factory export pattern (v3.43 from v3.42 T3)

## CLAUDE.md Policy Updates (v3.43)

- **보안 기능 도입 default 패턴** (Phase A/B 2-phase rollout) — 신규 ## section, App Check 외 reCAPTCHA Enterprise / Cloud Armor 등 일반화
- **Bundle 측정 표준** 확장: 외부 SDK lazy chunk 위치 실측 의무 (v3.41 firebase + v3.42 App Check 사례)
- **Codex 2-pass Review** small cycle exception: docs/config-only lightweight cycle에서 사전 review CLI fallback OK (최종 review는 무관 의무)

---

**Last Updated**: 2026-05-20
