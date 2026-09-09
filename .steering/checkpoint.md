# Steering checkpoint — ao/tui-machines (P2 executor)

## Goal
P2 of ao v3 (spec: Allternit Brain/Research/specs/ao-tui-machines.md): rebrand vendored
herdr TUI to ao face, add `ao machine connect`, ship Allternit DEFAULT_CONFIG, verify
(grep/test parity/fork-diff) + Mac+Linux pilot. Deliverable: docs/AO_TUI_MACHINES_NOTES.md
+ branch pushed.

## Just did
- Rebrand landed (work resumed after delegated subagent was stopped; finished + audited
  every edit myself). ~66 files, +713/−641, all user-visible brand strings: clap name/about,
  all CLI usage/help/diagnostics, window-title fallback, onboarding, shell labels, config
  diagnostics, remote install/hints, log file names, socket-busy/server errors, protocol
  version errors, tracing messages, DEFAULT_CONFIG (incl. Allternit [theme.custom] palette
  + window_title), SKILL.md (HERDR_ENV kept). app_dir_name() → ao/ao-dev (config
  ~/.config/ao, state ~/.local/state/ao, worktrees ~/.ao/worktrees). Install suffix
  .local/bin/ao. `ao machine connect <profile-id> [--keybindings local|server]` (~75 lines,
  maps catalog profile → remote::run_remote, best-effort select_ssh).
- Kept per binding decisions: HERDR_* env vars, toast serde value, right-click enum value,
  protocol tokens herdr:*, socket file names, herdr-plugin.toml, integration marker blocks,
  upstream github URLs, update.rs install detection, identifiers.
- Verify: build green. cargo test parity: rerun shows only the 9 pre-existing
  detect::manifest parallel flakes + same SIGPIPE harness death (baseline identical);
  detect serial 111/111. 4 test expectations fixed (they tracked renamed strings).
  Fork-diff guardrail: only non-brand changes = connect fn + DEFAULT_CONFIG theme block. PASS.
- Branding evidence: `ao --version` → "ao 0.9.0"; machine --help lists connect;
  --default-config header + theme block confirmed.
- Pilot prep: Linux host `vps` reachable (Ubuntu, glibc 2.39, x86_64). Cross-building
  ao for x86_64-unknown-linux-gnu via zig linker (for HERDR_REMOTE_BINARY seed).

## Next
- DONE: pilot complete (machine add/list/connect/remove round-trip vps,
  combined list, reconnect ~22s, connect proof). Docs written
  (docs/AO_TUI_MACHINES_NOTES.md). Remaining: commit/push/PR.
- machine_setup 5/5 + bin unit 2409 passed (pre-existing SIGPIPE death) after
  status rehome. zig@0.15 keg required for builds; host/cross builds share
  vendor zig-out and cannot run concurrently (documented in notes).

## Open questions
- Integration marker blocks keep the herdr name on purpose (documented).
- FOUND + FIXED (resumed session): P1's ao contract shadows engine `status`,
  which broke `ao machine add` (remote probe `status server --json` hit the
  contract parser: "'--json' is not a number"). Rehomed engine status forms
  (--json/server/client/help) inside ao::status. Small additive routing fix
  beyond the rebrand list — required by spec Verify "machine add round-trip".
- Cross-build binary pre-seeded to vps ~/.local/bin/ao via scp (install prompt
  needs a tty; pty attempt raced). Remote runs ao 0.9.0.
