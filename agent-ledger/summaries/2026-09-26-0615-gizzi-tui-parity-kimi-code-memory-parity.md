# Attestation — session/gizzi-tui-parity (P6): memory UX parity

**Date:** 2026-09-26 · **Agent:** kimi-code (explore audit + coder subagent; parent reviewed + landed) · **DAG:** dag_625298 / wih_8397

P6. Memory parity (audit first: memory-file system was already full-parity — GIZZI.md hierarchy, @imports, nested loading; gaps were UX):

- **`#` quick-add** implemented: prompt `#text` → Save-to-memory selector (MemoryFileSelector quick-add variant) → bullet append → cache clear → revived MemoryUpdateNotification banner (new `memory_updated` system message). Bare `#` → /memory editor flow.
- **GIZZI.md-first fixes**: MemoryFileSelector new-file candidates (~/.gizzi/GIZZI.md, ./GIZZI.md; existing CLAUDE.md still editable); `/init` scaffolds GIZZI.md-first with CLAUDE.md coexistence guidance.
- **`/remember` targets**: --user (default)/--project/--local.
- **Headless instruction.ts**: GIZZI.local.md/CLAUDE.local.md + ~/.gizzi/GIZZI.md user-global precedence matching TUI; GIZZI_TEST_HOME-hermetic.

**PR:** #750, merge `ee3e2b1bc5d8f098df7654a42bbde097d131b1c0`.
**Verification:** 29 new tests; memory+session 100/100 (6 broader-suite failures reproduce on pristine tree); typecheck clean; preflight 52/0; live pty smoke of `#` flow (selector, bullet in GIZZI.md, banner) and `/remember --project` write.
**Deferrals:** @path imports/rules dirs in headless path; `.openclaw` legacy dirs kept as read-only fallbacks; `memory_write` store divergence vs memdir — owner decision pending (two disconnected memory stores possible for one project: TUI memdir vs SessionPrompt L1-COGNITIVE).
