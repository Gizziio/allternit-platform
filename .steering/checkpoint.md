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
- P3 IMPLEMENTED (coder subagent, reviewed): ModelPicker rewritten as organized selector — modelPickerModel.ts pure logic (inferVendor port, formatContext, buildPickerRows grouped sections Cloud-vendor → CLI → local → Other, favorites within section, quotaSummary, scroll windowing); picker owns rendering/navigation (useInput + overlay Esc), type-to-filter, Tab=★ favorite persisted via modelFavorites setting (both settings types files kept in sync), per-row context window + capability badges, lazy ProviderQuotas footer, effort row/fast-mode/MLX/skipSettingsWrite preserved. 17 picker tests, typecheck clean, preflight 52/0, pty smoke of /model passed (filter + favorite + set verified live).

## Next
- Land P3 (commit → PR → merge → ledger), then P4: per-run telemetry line + quota in /usage (runtime publishes session.context.updated + ProviderQuotas; reference allternit-ai RunTelemetry.tsx on main).

## Open questions
- CommRails plan refine rejected prompt deltas in strict mode (needs mutations JSON) — phases tracked in session todo list instead; DAG root node covers the program.
