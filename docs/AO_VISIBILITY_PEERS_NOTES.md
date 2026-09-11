# AO_VISIBILITY_PEERS_NOTES — P5 "who needs you" panel

**Session:** P5 executor, 2026-09-10
**Worktree:** `allternit-ao-visibility-peers` · **Branch:** `ao/visibility-peers`
**Spec:** `Allternit Brain/Research/specs/ao-visibility-peers.md` (binding memo
`Research/drafts/prep-p5-visibility-peers.md` wins on disagreement)
**Scope discipline:** additive only, mirroring the P4 `src/ao/harness/` pattern.
No engine (herdr core: `src/app/`, `src/terminal/`, `src/detect/`, socket
handlers) internals were changed. All engine behaviors described under
"Incidents" were observed, classified, and worked around from the client side —
never patched.

---

## What was implemented

1. **Panel view** — a new full overlay in the ao client shell
   (`ClientShellOverlay::Visibility`, Navigator pattern), opened with
   `prefix+v` (default; configurable via `keys.visibility`). Renders the merged,
   blocked-first panel: waiting-on-you list, engine agents, native sessions
   (with live-join markers and `external` fallback), Rails peers, harness
   inventory. Scrollable (j/k/PgUp/PgDn/Home), Esc closes.
2. **Feed 1 — engine agents** — existing socket API only
   (`agent.list` poll). No new engine RPC, no `events.subscribe` use (see
   Deviations).
3. **Feed 2 — native sessions** — Rust port of the catalog LIST half:
   `NativeSession` schema, the 27-entry harness table, and all 16 walkers
   (claude-like+forks, gizzi/qwen, codex, grok, kimi, kimi-cli, copilot, pi/omp,
   cursor, openhands, muse, vibe, gemini, droid, cline, amp) from
   `packages/@allternit/native-sessions/src/catalog.ts`, plus the sha256
   fingerprint scheme. sqlite/protobuf readers and the gizzi session DB are
   deferred (spec binding decision 3). Live state only via the `agent_session`
   join key; unjoined rows render as external catalog entries.
4. **Feed 3 — Rails peers** — links `allternit-commrails` (workspace
   dep) and reads `<root>/.allternit/peers/registry.json` **read-only**, reusing
   rails `Peer` types. Two deliberate deviations from `PeerRegistry::list()`:
   statuses are recomputed in memory (missing inbox socket ⇒ Dead) and never
   written back; a UI poll must not mutate shared registry state.
   Root resolution: `--root` flag > `AO_PEERS_ROOT` env > **ao process cwd**
   (documented here per spec: the registry is local-only, so a wrong root means
   an empty peers section). New CLI: `ao peer list`, `ao peer send`.
5. **Waiting-on-you list** — persistent client-side `WaitingList`: enters on a
   poll-diff transition to Blocked, clears on transition out (or agent gone),
   ordered by `state_change_seq` desc. In the headless CLI (no poll history) it
   is rebuilt from the current blocked set.
6. **Join-key correlation** — `AgentInfo.agent_session {agent, kind, value}`
   matched against the native catalog's `harness+sessionId` (id kind, with
   prefix/suffix tolerance) or path (path kind). No-join rows render external;
   no dedupe beyond the join key (spec binding decision 6).
7. **Headless twin** — `ao visibility [--root DIR] [--cwd DIR] [--home DIR]`
   prints the same merged `PanelSnapshot` as JSON; the engine section degrades
   to an error note when no server answers.

## File map

| Area | Files |
|---|---|
| Native catalog port | `infrastructure/executor/ao-engine/src/ao/native/{mod,catalog,fingerprint}.rs` |
| Peers feed + CLI | `infrastructure/executor/ao-engine/src/ao/peers/mod.rs` (wired in `src/cli.rs`) |
| Merge model, WaitingList, join, headless feed | `infrastructure/executor/ao-engine/src/ao/visibility/mod.rs`, `src/cli/visibility.rs` |
| Client poller | `infrastructure/executor/ao-engine/src/client/visibility_feed.rs` |
| Shell overlay | `src/client/shell/{state,overlay_input,overlays,actions}.rs`, `src/client/{events,mod}.rs` |
| Keybind | `src/input/keybindings.rs` (`OpenVisibility`), `src/config/model.rs` (`keys.visibility`), `src/config/keybinds.rs`, help entry in `src/input/keybind_help.rs` |
| Crate link | `infrastructure/executor/ao-engine/Cargo.toml` (`allternit-commrails = { workspace = true }`, `tempfile` dev-dep) |
| Parity gate | `infrastructure/executor/ao-engine/tests/ao_visibility_parity/` (TS↔Rust fingerprint parity) |

## Test evidence (exact commands + results)

- `cargo test -p herdr --bin ao ao::` — **74 passed, 0 failed** on the final
  code state (2026-09-10; catalog walkers incl. fixtures, peers registry parse +
  dead-dimming, waiting-list transitions, join correlation incl. tolerance,
  blocked-first ordering, panel build).
- Full `cargo test -p herdr` — **0 failures** on the worktree at final code
  state. Note: one earlier full-suite run showed 9–10 `detect::manifest*`
  failures; these are a **pre-existing flake** — the same tests fail (~10) on a
  clean main checkout's full suite, pass in isolation, and passed on re-run.
  Classified, not fixed (out of P5 scope).
- `infrastructure/executor/ao-engine/tests/ao_visibility_parity/run.sh` —
  **"PARITY OK"** (Rust fingerprint output byte-identical to the TS harness
  reference for fixed vectors; env-gated cargo test).
- `cargo build -p herdr --bin ao` and `cargo build -p allternit-commrails
  --bin allternit-commrails` — clean (only the repo's standing contributor-policy
  warning).

## Hard-gate demo evidence

Script (run 4× against fresh headless servers; final authoritative run is the
last one): `HERDR_SOCKET_PATH=/tmp/ao-p5-demo/herdr.sock ao server` →
`ao workspace create --cwd <worktree>` → `ao pane split` →
`ao agent start kimi-a --kind kimi <pane>` + `kimi-b` on a second pane →
wait ~75 s → `ao pane send-text <pane> "create the directory /tmp/ao-p5-demo/newdir for me"` +
`send-keys Enter` → poll `ao agent list` → `ao visibility` snapshots →
TUI (`tmux new-session … 'HERDR_SOCKET_PATH=… ao'`, `C-b v`,
`tmux capture-pane -p -e`) → approve dialog (`send-keys Enter`) → re-capture.
Peers: `allternit-commrails peer register demo-peer --vendor kimi` from the worktree
root + a python UDS listener holding the inbox socket (macOS AF_UNIX path limit
is 104 bytes; the registry's socket path is ~117 chars, so the listener binds a
short path and the registry path is a symlink to it — noted as a real deployment
constraint for deep worktrees). Bare kimi: `tmux new-session … 'cd /tmp/ao-p5-bare
&& exec kimi'` (answers the workspace-trust dialog), one trivial prompt to
materialize the session dir.

Evidence dir: `~/.agent-orchestrator/evidence/ao-visibility-peers/`

- `visibility-blocked-final.json` + `agent-list-blocked-final.json` — **the
  gate, one server**: engine order `[('kimi-a','blocked',7), ('kimi-b','idle',2)]`
  (blocked-first), `waitingOnYou: [kimi-a (w2:p1)]`, peers `[demo-peer, active]`,
  bare kimi `58d1765a` as external native row, `live: null`.
- `panel-blocked.txt` — **TUI render of the same state**: `× kimi-a (kimi)` in
  "waiting on you", `● kimi-a — blocked` above `○ kimi-b — idle`, native rows
  with `· external` markers. (The `.png` files are full-desktop captures;
  the tmux capture is the authoritative TUI image — the TUI ran in a
  non-frontmost terminal, stated honestly.)
- Transition out: `send-keys Enter` approved the dialog; `kimi-a` went
  blocked(7) → idle(9), the mkdir executed (`/tmp/ao-p5-demo/newdir` created).
  `panel-unblocked.txt` shows `nobody is blocked on you right now` and both
  agents idle; `visibility-unblocked-final.json` has `waitingOnYou: []`.
- `visibility-bare.json` — bare kimi (cwd `/private/tmp/ao-p5-bare`) present as
  an external catalog row with `resumeHint`, `live: null`, and **absent from the
  engine feed** (no duplication).
- `visibility-baseline.json` (first run) — **join-key match with real hook-pushed
  ids**: engine `kimi-a` carried `agent_session = session_6a6ad8fc-…`
  (pushed by kimi-code's `PermissionRequest`/`SessionStart` hooks through
  `herdr-agent-state.sh`) and the panel correlated it to the native catalog row
  `joinedNative: "kimi+6a6ad8fc-0d12-483b-b00e-6096d986a2f3"` — ao session and
  native row shown **alongside, not duplicated**.
- `hook-debug.log` / `hook-debug-2.log` — real kimi-code hook event stream
  (SessionStart / UserPromptSubmit / PreToolUse / PermissionRequest) captured
  with temporary debug logging in the user-global hook (removed at cleanup).
- `feed-debug.log` — watcher tick log proving the client poller hits the correct
  socket and posts samples every 2 s.
- Integration install: `integration-install-kimi.log`,
  `kimi-config-herdr-refs.before/.after` (14 herdr hook entries added to
  `~/.kimi-code/config.toml`).

**Gate verdict: PASS** — every clause evidenced on a single engine server with
real hook-driven state transitions, plus headless JSON twins and TUI renders.

## Demo-day check answers (required by spec, verified before the demo)

1. **kimi agent-state hook install path:** NO ao spawn path installs it.
   `ao integration install kimi` (`src/cli/integration.rs`) is a separate,
   user-global step; it writes `~/.kimi-code/hooks/herdr-agent-state.sh` and the
   `[[hooks]]` entries in `~/.kimi-code/config.toml`. Panes spawned by ao carry
   `HERDR_ENV=1`, `HERDR_SOCKET_PATH`, `HERDR_PANE_ID`, so the hook fires **if
   installed** — it was not installed on this machine, so the demo installed it
   first (see "Changed on the user's machine" below).
2. **claude hook asset:** EXISTS — `src/integration/assets/claude/herdr-agent-state.sh`
   pushes `pane.report_agent_session` ONLY (session id + transcript path), no
   state pushes. Consequence (as the spec anticipated): claude dedupe works via
   the join key once installed, but claude Blocked state reaches the panel only
   through screen manifests, not hooks. claude CLI is installed on this machine
   but not logged in, so the demo used two kimi panes.
3. **Peer registry root:** no `.allternit/peers/` existed in any checkout
   (only a stale test registry under `~/.allternit`). Default root = ao process
   cwd; the demo registered `demo-peer` from the worktree root so the panel's
   peers section is non-empty. Documented in the code
   (`src/ao/peers/mod.rs`, `src/client/visibility_feed.rs`).

## Poll cadence (fixed numbers)

- Engine feed (`agent.list`): every **2 s** — this is also what derives
  waiting-on-you transitions.
- Native catalog walk + peers registry: every **15 s**, cached between ticks
  (27 harness dirs under $HOME are cheap to stat, but there is no need to re-walk
  them every 2 s).

## Deviations from spec (honest list)

1. **Poll-diff instead of `events.subscribe`.** The spec preferred the existing
   `events.subscribe pane.agent_status_changed` push; the ao client has no
   subscription machinery on that socket today, so the panel polls `agent.list`
   (2 s) and diffs transitions. WaitingList semantics (enter on transition to
   Blocked, clear on transition out, `state_change_seq` ordering) are identical;
   only the delivery mechanism differs. The server-side subscription stays
   unused.
2. **sqlite/protobuf catalog readers and gizzi session DB deferred** — per
   binding memo decision 3 (LIST half only). External rows therefore render as
   catalog entries with `resumeHint`.
3. **Claude state not hook-pushed** (asset is session-identity only) — claude
   Blocked appears via screen manifests if at all; join-key dedupe unaffected.
4. **Temporary debug scaffolding removed before commit**: env-gated watcher
   logging and hook-script debug lines were used during diagnosis and reverted;
   the committed poller is the plain 2 s loop.

## Incidents (all classified, none papered over)

1. **Engine full-lifecycle hook routing holds later reports.** The engine's
   kimi full-lifecycle authority path (`src/terminal/state.rs`
   `route_full_lifecycle_hook_report` / `set_agent_session_ref_for_session_start`,
   engine-internal — NOT modified) can hold `PermissionRequest`→blocked reports
   after early suppression churn (unanchored SessionStart registers a
   ProcessExit-suppressed replacement; subsequent same-session reports need
   `process_present && session_anchored` to reconcile). Observable effect: the
   FIRST permission prompt on a fresh server reliably lands (blocked in ≤60 s,
   reproduced on two fresh servers); later turns on a server that has seen
   suppression churn can be held, and manual state pushes are held too. This is
   engine reconciliation timing, out of P5 scope; the demo used fresh servers
   for the authoritative captures and documents the behavior here.
2. **kimi-code fires SessionStart lazily** (on first prompt, not while sitting
   at the idle input box), and its hook payloads carry real session ids —
   verified via temporary debug logging in the user-global hook script.
3. **kimi permission flow sometimes wedges in a PreToolUse retry loop**
   (repeated PreToolUse hook events, no dialog) on later turns — kimi-side/model
   behavior, unrelated to the panel; worked around by using first-turn prompts
   on fresh servers.
4. **Squeezed panes wrap the approval dialog**, and the engine's screen-manifest
   fallback can classify the wrapped render as non-blocked when full-lifecycle
   authority is not yet established — another reason the blocked state is
   authoritative only via the hook path.
5. **macOS AF_UNIX 104-byte path limit** vs the rails registry's
   `<cwd>/.allternit/peers/inbox/<id>.sock` (~117 chars in a deep worktree):
   the demo bound a short-path socket and symlinked the registry path. Real
   constraint for deep worktrees; noted for the rails crate's future attention
   (not changed here — rails is a linked dependency, and ao only reads).
6. **Pre-existing test flake**: `detect::manifest*` full-suite failures (see
   Test evidence) — present on main, unrelated to P5.
7. **Pane tmux `-c` did not stick** in this environment (tmux default-path
   behavior); demo commands use explicit `cd` inside the pane command.

## Changed on the user's machine (outside the repo)

- `ao integration install kimi` was run: `~/.kimi-code/hooks/herdr-agent-state.sh`
  installed and 14 `[[hooks]]` entries appended to `~/.kimi-code/config.toml`
  (before/after copies in the evidence dir). Kept intentionally — it is the
  supported user-global integration and makes pane kimi state visible to ao.
- Temporary debug logging added to that hook during diagnosis was removed;
  the file is back to the integration-managed content.

## Cleanup state

- Demo server stopped; demo tmux sessions (`ao-p5-tui`, `ao-p5-bare`) killed;
  demo pane kimi processes terminated. Scratch under `/tmp/ao-p5-demo`,
  `/tmp/ao-p5-bare`, `/tmp/ao-p5-inbox`, `/tmp/ao-visibility-feed-debug.log`
  removed. Worktree `.allternit/peers/` (untracked demo registry) removed —
  re-create any time with `allternit-commrails peer register <name> --vendor <v>`.
- Evidence preserved under `~/.agent-orchestrator/evidence/ao-visibility-peers/`.
