# Steering checkpoint — session/gizzi-tui-parity

## Goal
gizzi-code TUI parity + polish program (approved plan 2026-09-26). 8 phases, each its own PR landed per repo lifecycle. Tracked as dag:dag_625298 / wih node n_2847.

## Just did
- Parity audit complete (3 explore agents + Codex startup video review). Key finding: TUI permission bypass broken because thread.ts only sets env vars the ink-app never reads; initialPermissionModeFromCLI/initializeToolPermissionContext are dead code; AppStateStore hardcodes mode:'default'.
- Worktree allternit-session-gizzi-tui-parity created off origin/main @ 6ad3574d4. Disk gate passed (104G workspace, 495G free).
- P0 LANDED (PR #743, merge 35f9a767): TUI permission bypass fixed — new tuiPermissionStartup.ts (yolo→bypassPermissions mapping, root guard), tui() seeds mode via initialPermissionModeFromCLI+initializeToolPermissionContext, thread.ts gains --permission-mode. 80/80 permission tests, typecheck clean, release-preflight 52/0, ledger committed (830bcd344).
- P1 IMPLEMENTED: WelcomeBox.tsx rewritten as animated startup screen (sentinel beacon pulse + blink, GIZZI block wordmark with coral shimmer sweep, tips line) with welcomeArt.ts data module; static under prefersReducedMotion. Verified live via pty TUI capture (blink frames + wordmark rendering confirmed). Tests 4/4.

## Next
- P0 LANDED: PR #743 merged (35f9a767), main synced, ledger attestation committed (830bcd344). git-discipline-check FAILs only on other sessions' dirty files (surfaces/computer-use, office-addin, 2 foreign ledger summaries) — left untouched deliberately.
- P1 LANDED (PR #744, merge 2b16cfa2c): animated WelcomeBox + welcomeArt.ts; pty-capture verified; ledger committed.
- P2 LANDED (PR #745, merge 68dd173a4): dim-tail streaming reveal, cli-highlight warm-up, ToolUseCard glyphs.
- P3 LANDED (PR #746, merge 9502d8d4): organized /model picker.
- P4 IMPLEMENTED (coder subagent, reviewed): per-turn telemetry line (new SystemRunTelemetryMessage emitted in onQuery finally; segments from cost-tracker diffs, turn wall time, turn tool count, context block-bar, tightest quota chip patched in once; never-fabricate assembly) + /usage Plan quota section (per-window bars, resets-in, honest unreported states) + reasoning-token line. Pure logic in utils/telemetry/{runTelemetryModel,providerQuota,turnSignals}.ts. 20 new tests; components+commands 45/45 green (3 pre-existing /status env failures unrelated, reproduced on pristine tree); typecheck clean; preflight 52/0; pty smoke of /usage honest path passed. Per-turn line not exercised live (no quota spend).

## Next
- Land P4 (commit → PR → merge → ledger), then P5: artifacts — fix /artifact Gemini leftover path (commands/artifact/artifact.tsx:19-25 → gizzi-owned dir), markdown viewer, FilePathLink open, inline created-file cards.

## Open questions
- CommRails plan refine rejected prompt deltas in strict mode (needs mutations JSON) — phases tracked in session todo list instead; DAG root node covers the program.
