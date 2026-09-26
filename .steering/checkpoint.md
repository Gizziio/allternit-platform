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
- P2 IMPLEMENTED: (a) progressive reveal — the in-progress streaming line now renders dimmed (streamingTail prop through REPL→Messages) instead of being hidden, stable part unchanged; (b) cli-highlight warm-up at tui() startup so first code block doesn't flash plain→colored; (c) ToolUseCard state label polish (●/◌ glyph + bold running, dim queued). Tests 24/24 green (components + tui); typecheck running.

## Next
- Land P2 (typecheck → commit → PR → merge → ledger), then P3: model selector organizer port (rewrite components/ModelPicker.tsx — grouped providers, type-to-filter, favorites, context window, quota from ProviderQuotas; reference allternit-ai ModelPickerPopover on branch session/composer-parity; Delegate to coder subagent with brief).

## Open questions
- CommRails plan refine rejected prompt deltas in strict mode (needs mutations JSON) — phases tracked in session todo list instead; DAG root node covers the program.
