# Steering checkpoint — session/gizzi-tui-parity

## Goal
gizzi-code TUI parity + polish program (approved plan 2026-09-26). 8 phases, each its own PR landed per repo lifecycle. Tracked as dag:dag_625298 / wih node n_2847.

## Just did
- Parity audit complete (3 explore agents + Codex startup video review). Key finding: TUI permission bypass broken because thread.ts only sets env vars the ink-app never reads; initialPermissionModeFromCLI/initializeToolPermissionContext are dead code; AppStateStore hardcodes mode:'default'.
- Worktree allternit-session-gizzi-tui-parity created off origin/main @ 6ad3574d4. Disk gate passed (104G workspace, 495G free).
- P0 IMPLEMENTED: new `utils/permissions/tuiPermissionStartup.ts` (env→CLI mapping, yolo→bypassPermissions, root/sudo guard); app.tsx tui() now resolves mode via initialPermissionModeFromCLI + initializeToolPermissionContext before render and seeds initialState with it; thread.ts gained --permission-mode. Tests: test/permission/tui-startup.test.ts 6/6 pass; test/permission/ 80/80 pass; live smoke of the real resolution path confirms yolo→bypass, plan→plan, acceptEdits→acceptEdits, and settings defaultMode (owner's real settings have bypassPermissions) now honored. release-preflight 52/0.

## Next
- Wait for `bun run typecheck` (background), then commit P0, PR, merge, sync main, ledger attestation, git-discipline-check.
- Then P1: animated Allternit startup screen (WelcomeBox.tsx rework + welcomeLogoFrames.ts).

## Open questions
- CommRails plan refine rejected prompt deltas in strict mode (needs mutations JSON) — phases tracked in session todo list instead; DAG root node covers the program.
