# P5 land — ao visibility + peers panel (PR #256)

- **Session:** ao orchestrator main (session_47865698) landing the P5 executor's work
- **Agent:** kimi (K2.7), orchestrated-executor pattern (tmux `ao-visibility-peers`, killed after sentinel)
- **Commit:** c197fba5ad5b5ec38de213e5927b7cd6be2937de (squash of `ao/visibility-peers`, PR #256)
- **Spec:** `Allternit Brain/Research/specs/ao-visibility-peers.md` (binding memo `prep-p5-visibility-peers.md`)

## What landed

The P5 "who needs you" panel, additive in the `ao` crate (no engine/herdr-core changes):

- **Panel view** — full overlay in the ao client shell, default bind `prefix+shift+v` (see fix below), scrollable, Esc closes.
- **Feed 1 — engine agents** via existing `agent.list` socket poll (2 s, poll-diff transitions; `events.subscribe` machinery doesn't exist client-side — documented deviation).
- **Feed 2 — native sessions** — Rust port of the gizzi native-sessions catalog LIST half: `NativeSession` schema, 27-entry harness table, all 16 walkers, sha256 fingerprint scheme + TS↔Rust parity gate (`tests/ao_visibility_parity/`). sqlite/protobuf readers deferred per spec.
- **Feed 3 — Rails peers** via `allternit-agent-system-rails` PeerRegistry, read-only, in-memory status recompute (never writes shared registry). Root: `--root` > `AO_PEERS_ROOT` > process cwd. `ao peer list|send` CLI.
- **Waiting-on-you list** — enters on Blocked transition, clears on transition out, `state_change_seq` ordering; rebuilt from current blocked set in headless mode.
- **Join-key correlation** — `AgentInfo.agent_session` vs catalog `harness+sessionId`; external fallback rows, no dedupe beyond join key.
- **Headless twin** — `ao visibility` emits the same merged `PanelSnapshot` JSON.

## Hard gate (plan verify line) — PASSED

Two agent panes in ONE engine server; `kimi-a` driven to a permission prompt surfaced blocked-first in the panel and the waiting-on-you list; approving cleared it (mkdir executed). A bare `kimi` session outside ao listed as an external native row with resume hint, absent from the engine feed, and — with hooks installed — correlated to its ao row by join key (no duplication). Evidence: `~/.agent-orchestrator/evidence/ao-visibility-peers/` (JSON twins + tmux pane captures + hook logs). Full evidence/deviations/incidents: `docs/AO_VISIBILITY_PEERS_NOTES.md` in the PR.

## Review findings during land (orchestrator, honest)

1. **Caught a real regression the executor's NOTES missed:** the visibility default bind `prefix+v` collides with the built-in `split_vertical` default. The keybind registry disables the later binding, so every config reload that touched keys reported `Partial` — **12 `app::tests::reload_config_*` tests failed** (verified failing in isolation on the merged branch; same test passes on clean main). The NOTES' "full suite 0 failures" claim was wrong (executor likely ran the suite before its final keybind edit). **Fix:** default bind changed to `prefix+shift+v` (`model.rs`; free, matches `prefix+shift+p` pattern). After fix: 12/12 reload_config + 74/74 `ao::` green; pushed as 8c1da3f99 before merge.
2. Full-suite `cargo test -p herdr` dies with SIGPIPE (signal 13) in this macOS environment and shows the pre-existing `detect::manifest*` network flake — both documented by the executor as present on clean main; classifications accepted (exact test names match the NOTES).
3. Executor's final step (conventional commits) deadlocked on a stale `index.lock` (no holder process); orchestrator removed the stale lock, verified the tree matched the NOTES, and committed in 3 logical commits.

## Outstanding work / follow-ups (not P5 scope)

- claude state reaches the panel only via screen manifests (its hook asset pushes session identity, not state) — documented.
- Engine full-lifecycle hook authority can hold later-turn blocked reports after suppression churn — engine-side, documented in NOTES.
- macOS AF_UNIX 104-byte path limit vs rails registry socket path in deep worktrees (demo used symlink workaround) — for the rails crate's future attention.
- PWA session pickup (P3 last hop) still blocked on proxy-auth semantics — see queue `p3_e2e_clerk_test` / follow-up events on `rq-20260908-028`.

## Changed on the user's machine (by the executor, kept intentionally)

- `ao integration install kimi`: `~/.kimi-code/hooks/herdr-agent-state.sh` + 14 hook entries in `~/.kimi-code/config.toml` (before/after copies in the evidence dir). This makes pane kimi state visible to ao globally.
