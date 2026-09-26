# Attestation — session/gizzi-tui-parity (P0): TUI permission bypass fix

**Date:** 2026-09-26 04:34 · **Agent:** kimi-code · **Session branch:** `session/gizzi-tui-parity` (multi-phase program, branch stays live) · **DAG:** dag_625298 / wih_8397

## What was done

P0 of the gizzi-code TUI parity program (8 phases, owner-approved plan). Fixed the broken permission-bypass modes in the gizzi-code TUI.

**Root cause (found by audit):** the yargs TUI entrypoint (`cmd/gizzi-code/src/cli/ui/ink-app/thread.ts`) translated `--yolo` / `--dangerously-skip-permissions` into `GIZZI_PERMISSION_MODE` / `GIZZI_DANGEROUSLY_SKIP_PERMISSIONS` env vars, but nothing in the ink-app read them. `getDefaultAppState()` hardcoded `toolPermissionContext.mode: 'default'` + `isBypassPermissionsModeAvailable: false`; the upstream wirers `initialPermissionModeFromCLI` / `initializeToolPermissionContext` were dead code with zero call sites. `permissions.defaultMode` in settings was likewise never applied at startup. Headless `run` worked (PermissionNext engine) — only the TUI was broken.

**Fix:**
- New `cmd/gizzi-code/src/cli/ui/ink-app/utils/permissions/tuiPermissionStartup.ts` — env→CLI mapping (`yolo` → ink-app's `bypassPermissions`) + root/sudo guard mirrored from `runtime/gizzi-core/setup.ts` (live TUI path never runs setup()).
- `app.tsx` `tui()` resolves startup mode via the two previously-dead wirers before first render and seeds `initialState.toolPermissionContext`; also loads permission rules from disk, applies settings `defaultMode`, honors `disableBypassPermissionsMode`, surfaces the disabled-by-policy notification as a startup system message, and preserves teammate forced plan mode.
- `thread.ts` gains `--permission-mode` (default|acceptEdits|plan|bypassPermissions).

**PR:** #743, merge commit `35f9a7675b0e5d893e62e87969a67506ddc8cf51`.

## Verification evidence

- `test/permission/tui-startup.test.ts` (new): 6/6 pass.
- `bun test test/permission/`: 80/80 pass; `test/cli/thread-worktree` + `test/cli/tui`: green.
- `bun run typecheck` in cmd/gizzi-code: clean. (Fresh-worktree note: `@allternit/computer-use-protocol` dist had to be built once — pre-existing artifact of `pnpm install --ignore-scripts`, unrelated to the change.)
- `node scripts/release-preflight.mjs`: **52 passed, 0 failed** (release-path safe).
- Live smoke of the real resolution path (owner's real settings): no flags → `bypassPermissions` (owner's settings `defaultMode` finally honored); `yolo` → `bypassPermissions` + available; `plan` → `plan`; `acceptEdits` → `acceptEdits`.

## Incidents

- Smoke-script variant without `process.exit(0)` appeared to "hang" — post-completion event-loop keep-alive (Log/analytics handles), not a product bug.

## Honest deferrals

- Shift+Tab carousel / `/always-approve` / bridge `set_permission_mode` to bypass are unblocked by this fix (availability flag now set correctly) but were not interactively exercised in a live TUI session — unit + smoke coverage only.
- `--allowed-tools` / `--disallowed-tools` / `--add-dir` CLI flags are still not parsed by the yargs TUI entrypoint (pre-existing gap; `initializeToolPermissionContext` supports them when wired).
- Desktop binary rebuild (lifecycle step 8) deferred to the end of the multi-phase program — all phases touch the bundled gizzi-code, so one rebuild will follow the final phase of this session.
- Phases P1–P7 (startup screen, streaming polish, model selector, telemetry, artifacts, memory, hooks/commands) not started at this attestation; P1 begins next.
