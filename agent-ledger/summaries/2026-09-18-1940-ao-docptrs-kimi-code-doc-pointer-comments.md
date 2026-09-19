# 2026-09-18 doc-pointer comment sweep — ao/docs-pointer-comments (kimi-code)

**PR:** #628 (merged 2026-09-18, merge SHA `4af154a6771597db0293a929ac28aee2a51e7c7c`)
**Commit:** `d4a67e7be` — `docs(code): update stale doc-path comments post-reorg`
**Scope:** comment-only — 43 comment lines across 38 files, 0 functional changes.

## What was done

The 2026-09-18 folder reorg (S2–S7) moved docs that ~43 code comments still cited at old paths. Each comment was repointed at the current location (verified on disk and via git history of the reorg commits S3 `69775a1f5`, S6 `b92ca94b9`, S7 `f4341a3c0`); targets that no longer exist got a minimal "(doc removed …)" annotation rather than deletion, preserving the comment's intent.

### Breakdown
- **S6 `research/` → `docs/research/`**: 6 comments (domains/computer-use firecracker_sandbox.py ×2, drivers/firecracker lib.rs ×2, rootfs.rs ×2) — FIRECRACKER-GUEST-AGENT-VNC-SPEC.md
- **S6 `spec/` collapse**: infrastructure/local (multi-region.md → docs/Core_System/02-Target/); multimodal-streaming annotated "(doc removed; no successor in tree)" — spec/streaming/multimodal.md never landed on main
- **S7 docs/ depth-1 → docs/programs|learnings/**: 27 comments — GIZZI_BOT_MODE_SPEC (11 gizzi bot files), HTML_ARTIFACTS_PHASE_1/2 (3), AGENT_ACTIVITY_CLI_MAP (1), AO_HARNESS_PORT_NOTES (2), AO_VISIBILITY_PEERS_NOTES (3), UHP.md (1), UHP_VENDOR_INVENTORY (2), ALLTERNIT_RUNTIME_P1_NOTES (2), SURFACE_AUDIT_FINAL_REPORT + BRAIN_D3_SPIKE (cmd/allternit-api), GENOFFICE_PHASE5_DECISION (platform/packages/os-contracts), CI_ISSUE_6_NOTES (scripts/validate-typography.py)
- **S6 DESIGN.md → docs/design/DESIGN.md**: generateHtml.ts ×2
- **S3 packages/@allternit → platform/packages**: transport.ts (os-contracts/spine.ts), render-html.ts (workflow-engine visualizer)
- **Removed docs annotated**: SWARM_E_PHASE2_NOTES (deleted 2026-08-12), ALLTERNIT_MUX_PLAN (deleted 2026-08-27) — both pre-reorg deletions
- **Stale crate name**: ao-engine mailbox.rs doc comment `allternit-agent-system-rails` → `allternit-commrails`

## Verification evidence
- `node scripts/release-preflight.mjs` → **52 passed, 0 failed**
- Diff audit: 43 added / 43 removed, every changed line a `//`/`#!`/`//!`/`///`/`*`/`#` comment line; 0 non-comment lines
- gizzi-code burn oracle (`ensure-sdk-dist.sh && npx tsc --noEmit`) → exit 0
- All 18 referenced target paths verified present on disk
- Burn-queue collision check: no touched gizzi-code file appears in typecheck-burndown/queue.json
- **Pre-existing failure noted:** `bun run test` at repo root fails 12/24 (receipt ID format `RCPT-8cnz3vos` vs `/^RCPT-\d{4}$/`, tests/integration) — fails identically on clean origin/main `852608b93`; unrelated to this comment-only diff. Not fixed here (out of scope).

## Skipped (deliberately)
- bot.ts:613 — doc path inside yargs `describe:` string (functional output), not a comment
- surfaces/allternit-desktop firecracker copies (release-locked), alabs-generated-courses media files (historical courseware)
- scripts/generate-source-modules.ts, write-bridge-modules.ts, write-remaining-bridges.ts — doc paths inside generator template strings, not comments
- gizzi-code refs to upstream Claude Code docs (feature-gating.md, gizzi-hints.md, hooks.md, ps-shell-selection.md, native-installer.md, magic-docs.md, LENS_*) — never existed in this repo (no git history at any path), not reorg-related

## Deferred / follow-ups
- The 12 failing integration tests on main (receipt ID format) need a separate fix session — they were failing before this work.
- The skipped stale pointers above (desktop copies, alabs media, string-literal pointers) remain stale by design; a future sweep could handle them when those paths are next touched legitimately.
