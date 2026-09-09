# ALLTERNIT_RUNTIME_P1_NOTES — ao v3 engine + contract parity (P1)

```yaml
status: in_progress
files_changed:
  - infrastructure/executor/ao-engine/src/ao/            # NEW: additive ao module (transcript tee) — the one allowed engine diff
  - infrastructure/executor/ao-engine/src/cli/ao.rs      # NEW: ao spawn|send|watch|status|kill|doctor
  - infrastructure/executor/ao-engine/src/pane.rs        # tee wiring in spawn_command_builder on_read; strip marker env from child
  - infrastructure/executor/ao-engine/src/cli.rs         # dispatch for the six ao words
  - infrastructure/executor/ao-engine/src/main.rs        # mod ao; help text
  - infrastructure/executor/ao-engine/src/cli/spec.rs    # clap help/completion mirror
  - infrastructure/executor/ao-engine/tests/ao_parity/   # golden side-by-side test (committed, rerunnable)
  - .gitignore                                           # un-ignore vendored src/build dirs (P0 repair, separate commit)
deviations:
  - "events.wait does not support pane_exited at v0.9.0 (only pane_agent_status_changed) — decision #5's events.wait arm replaced by presence probe (workspace/pane existence), which the engine makes lossless because PaneDied removes the pane+workspace from state (dead = pane_not_found, verified by spike)."
  - "Decision #3 (engine worktree.create/remove) reversed after spike: engine silently REUSES an existing branch where the script's 'git worktree add -b' fatals; worktree.remove also left a surprise 'wtrepo' workspace behind. ao-core shells out to git with the script's exact commands instead — byte-parity including failure modes. Engine worktree.* remains available for later phases."
  - "Decision #9's held events.subscribe across spawn replaced by a plain post-grace presence probe: the spike shows a dead pane errors pane_not_found and its workspace vanishes, so probing state is race-free (no replay gap). subscribe-before-spawn was spike-verified to work and remains the documented fallback if the engine ever keeps dead panes."
  - "DEAD-session persistence: tmux remain-on-exit keeps dead sessions observable; the engine removes them. ao-core keeps a small registry (~/.agent-orchestrator/state.json) as the remain-on-exit analog so ao-status can still list 'ao-foo  DEAD  <cwd>'. Registry is ao-core logic, not an engine diff."
  - "ao-doctor adds one 'ao-engine:' transport line to the script's output (socket path + ping protocol/version); the rest of the output is byte-identical. Exit semantics: engine unreachable => TRANSPORT BROKEN (exit 2), tmux/script/git probes unchanged while the bash fallback exists."
  - "Engine headless PTY is 120x40 (default) vs tmux 80x24; the golden test avoids wrap-sensitive comparisons. 120x40 satisfies decision #11 (sane TUI size) with no config change."
  - "ao spawn additionally refuses if a tmux session ao-<slug> exists (script-world collision guard); tmux absence skips the check. Not an engine dependency."
remaining:
  - "TUI rebrand, machine/fabric/harness/peer surfaces (P2-P5) per plan."
  - "Deprecating the bash scripts is a later phase, after human sign-off."
```

## Spike findings (mandatory items, 2026-09-09, evidence in ~/.agent-orchestrator/evidence/ao-engine-parity-spike/)

Ran against the vendored engine built from this branch, booted as `--session ao`
(socket `~/.config/herdr-dev/sessions/ao/herdr.sock` in dev builds;
`~/.config/herdr/sessions/ao/herdr.sock` in release).

1. **Post-exit pane behavior — SETTLED.** `pane.get`, `pane.read`, and
   `pane.process_info` on an exited pane ALL return `{"error":{"code":"pane_not_found"}}`,
   and the workspace itself disappears from `workspace.list` when its last pane dies
   (`handle_pane_died` removes the pane; an empty workspace is closed). Consequences:
   - Liveness probe = **presence** (workspace listed + `pane.get` succeeds). There is
     no stale-data mode to misread.
   - DEAD sessions are unobservable engine-side → ao-core registry (below) is the
     tmux remain-on-exit analog for `ao-status` DEAD listings.
2. **Spawn pattern (A) placeholder tab — SETTLED, no harmful side effects.**
   `workspace.create` + `layout.apply {tab_id}` leaves exactly one tab (the
   placeholder `w1:t1` is closed; snapshot shows only the new `w1:t2`). `layout.apply`
   rejects `tab_id`+`workspace_id` together (`invalid_target: use either tab_id or
   workspace_id, not both`) — ao-core passes `tab_id` only. The placeholder shell
   exists only milliseconds and produces no output.
3. **`pane.read` after exit — SETTLED: it does NOT return content** (`pane_not_found`).
   The instant-exit transcript tail and any post-mortem tail must come from the
   PTY-tee file. This makes the tee patch (already the plan) mandatory rather than
   an optimization.

Supporting findings:
- `events.subscribe {"subscriptions":[{"type":"pane.exited"}]}` streams
  `{"data":{"pane_id","type":"pane_exited","workspace_id"},"event":"pane_exited"}`;
  a subscription held across spawn catches an instant exit (verified). No replay.
- `events.wait` accepts ONLY `pane_agent_status_changed` matches —
  `pane_exited` matches error `unsupported_event_wait_match`. The parity memo's
  `events.wait {pane_exited}` mapping does not exist at v0.9.0.
- `pane.send_input {text}` pastes (bracketed server-side); `keys:["enter"]` and
  `["ctrl+u"]` accepted; `["C-u"]` → `invalid_key: unsupported key C-u` (translation
  in ao-core confirmed necessary).
- `pane.process_info` on a live pane returns `shell_pid` + `foreground_processes`
  (used for nothing after the presence-probe finding; kept for future phases).
- `worktree.create {cwd, branch, path, label}` works and is fast (async completes
  ~100ms), keeps the branch on remove, BUT: (a) branch-exists does `git worktree add
  <path> <branch>` (checkout) instead of failing like `-b` does; (b) the remove dance
  left an extra non-ao workspace (`wtrepo`) behind. Both diverge from the script →
  git-subprocess deviation recorded above.
- Headless PTY size is 120x40 (DEFAULT_HEADLESS_COLS/ROWS in src/config.rs:79-80);
  confirmed by wrap test (200-char line wraps at 120) and `viewport_rows: 40`.

## Contract mapping (ao-core over the socket API)

| script | engine calls |
|---|---|
| ao-spawn | workspace.list (dup guard) → workspace.create {label, cwd, focus:false} → layout.apply {tab_id, root:{pane, command:argv, env:{HERDR_AO_TRANSCRIPT: log}}} → 0.5s grace → workspace.list presence probe → on death: tail tee log to stderr, exit 1 |
| ao-send | workspace.list (session guard) → pane.list → pane.send_input {text} → pane.read marker loop (verbatim) → pane.send_input {keys:[enter\|ctrl+u]} |
| ao-watch | sentinel `Path::exists` poll + workspace.list presence probe per interval; exit 0/3/4 verbatim messages |
| ao-status | workspace.list filtered `ao-*` (+ registry for DEAD) / pane.get cwd; with slug: pane.read {recent, N} |
| ao-kill | pane.get cwd capture → workspace.close → registry cleanup; --rm-worktree: script-identical git subprocess + suffix guard |
| ao-doctor | socket connect + ping (Pong.protocol/version) + tmux/script/git + 4 executor probes (verbatim logic) |

## How to verify

```sh
export ZIG=/opt/homebrew/opt/zig@0.15/bin/zig
cargo build -p herdr                 # workspace root; binary: target/debug/ao
# golden side-by-side parity test (byte-identical contract proof):
infrastructure/executor/ao-engine/tests/ao_parity/run.sh
```
