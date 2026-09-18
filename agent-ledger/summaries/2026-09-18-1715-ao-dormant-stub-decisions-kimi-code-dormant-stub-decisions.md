# Dormant stub owner-decision doc (ao/dormant-stub-decisions) — 2026-09-18

**PR:** #610 (merged 2026-09-18, merge SHA `59af37f40`) · **Base:** `f49e3c252` · **Change:** docs-only, one new file `docs/programs/gizzi/DORMANT_STUB_DECISIONS.md`.

## What was done

Follow-up to the off-queue shim sweep (summary `2026-09-18-1308-ao-offqueue-shim-sweep-kimi-code-offqueue-shim-sweep.md`). The sweep escalated 17 live dormant stubs (TEMPORARY SHIM files from the 2026-07-26 mass import, never implemented, but wired to real importers) and explicitly deferred the implement-vs-cut choice to the owner. This session produced the one-page decision document: per-stub feature description, importer-chain evidence, a grep-verified UI-visibility column, effort (S/M), recommendation, blank owner-decision column, notes, a "How to execute a CUT" appendix (PR #594 pattern), and cross-links to the sweep ledger + PR #594.

## UI investigation (all claims grep-verified on `f49e3c252`, no guessing)

- Recommendations: **1 IMPLEMENT** (FeedbackSurvey/utils.ts — visible survey UI, gap is just missing type exports), **9 CUT** (skillSearch ×3, OverflowTestTool, TerminalCaptureTool, VerifyPlanExecutionTool, cachedMicrocompact, contextCollapse, attributionHooks), **6 KEEP-DORMANT** (Transport, install-github-app/types, plugin/types, Spinner/types, new-agent-creation/types, querySource — structural type/constant stubs), **1 owner-weigh lean-CUT** (CommandPalette).
- Surprises: (1) CommandPalette's parent screens MainScreen/MainScreenEnhanced are exported from the barrel but mounted nowhere — the palette is not actually user-visible; (2) FeedbackSurvey/utils.ts lacks `FeedbackSurveyResponse`/`FeedbackSurveyType` exports its live `@ts-nocheck` siblings import, and its two exported functions have zero callers; (3) the terminal **panel** is a real shipped feature — only the terminal **capture tool** is a never-implemented stub; (4) VerifyPlanExecutionTool's gate differs between `tools.ts` (`GIZZI_CODE_VERIFY_PLAN`) and `classifierDecision.ts` (`USER_TYPE === 'ant'`).

## Verification evidence

- Docs-only; the only file touched is `docs/programs/gizzi/DORMANT_STUB_DECISIONS.md` (88 lines).
- All 17 stub paths re-confirmed under `cmd/gizzi-code/src` (sweep's ink-app-relative paths resolve to `cli/ui/ink-app/...`).
- No code edits, no queue.json, no test runs needed; sweep-day gates remain the baseline (smoke 1311/0, preflight 52/0).
- `bash scripts/git-discipline-check.sh` (shared checkout) → PASS (verbatim in session summary).

## Honest deferrals / drift noted, not fixed

- Owner has not yet marked DECISIONs; the 17 fates remain open until the owner fills the table.
- Drift (reported in the doc, untouched per session rules): `test/deleted-paths.txt` lists the three dev-tool stubs under stale `components/tools/…` paths; VerifyPlan gate mismatch above; `REPO_STRUCTURE.md` lists none of the 17 (doc hits are archive-only).
- The sweep's other deferrals stand: 2 `src/types` TEMPORARY SHIM header comments await owner confirmation that proper SDK types exist.
