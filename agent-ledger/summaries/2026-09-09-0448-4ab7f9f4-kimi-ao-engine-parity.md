# Session attestation — ao/ao-engine-parity (P1: ao-core subcommands, engine + contract parity)

- **Date:** 2026-09-09 (~04:48 local)
- **Session:** 4ab7f9f4-4cc4-4ee7-b013-c64e35f057c3 (kimi-code)
- **Branch:** `ao/ao-engine-parity` → **PR #205** → merge commit `aa8a6a6993` (merge commit, history preserved)
- **Spec:** Allternit Brain `Research/specs/ao-engine-parity.md` (rq-20260908-028, P1 of the ao v3 runtime plan)
- **Binding memo:** `Research/drafts/prep-p1-socket-parity.md` (12 design decisions; spike can disprove)

## What was done

P1 of the ao v3 runtime: the `ao` binary (built on the P0-vendored herdr v0.9.0 engine in
`infrastructure/executor/ao-engine/`) now implements `ao spawn|send|watch|status|kill|doctor`
with byte-level contract parity to the bash scripts in
`~/.claude/skills/agent-orchestrator/scripts/` (same arguments, exit codes, stdout formats,
semantics). Bash scripts remain untouched as fallback.

Implementation:

- **`src/cli/ao.rs` (new, ~1000 lines)** — all six subcommands over the engine socket API.
  Session defaults to `ao` (override: `--session`, `HERDR_SOCKET_PATH`, `HERDR_SESSION`).
  Engine auto-starts on `ao spawn` only. Worktree add/remove via git subprocess with the
  script's exact commands. Registry at `~/.agent-orchestrator/state.json` is the
  tmux remain-on-exit analog for DEAD listings.
- **`src/ao/mod.rs` + `src/ao/transcript.rs` (new)** — the ONE allowed engine diff: PTY-tee
  writing byte-0-complete transcripts to `~/.agent-orchestrator/logs/ao-<slug>-<ts>.log`,
  env-gated by `HERDR_AO_TRANSCRIPT`, synchronous write in `on_read`. Wired via a new
  `launch_env` param on `spawn_command_builder` (`src/pane.rs`, 3 call sites); marker env
  stripped from the child process.
- **Dispatch** — `src/cli.rs` (six ao words matched before engine commands; `status` now
  shadows engine status), `src/main.rs` (`mod ao`, help text, known-command words),
  `src/cli/spec.rs` (clap help/completion mirror).
- **`tests/ao_parity/run.sh` (new, committed)** — golden side-by-side test: script world vs
  ao world on the same spawn/send/watch/status/kill/worktree/exit scenario.
- **`docs/ALLTERNIT_RUNTIME_P1_NOTES.md`** — spike findings, contract mapping table,
  deviations, verification results, repro commands.

## Spike-driven deviations from the memo (all documented in the NOTES)

1. **Presence-probe liveness.** Post-exit `pane.get`/`pane.read`/`pane.process_info` all
   return `pane_not_found`, and the workspace vanishes from `workspace.list` → dead =
   absence; probing engine state is race-free. Decisions #5 (events.wait arm — not
   supported at v0.9.0) and #9 (held subscribe → replaced by plain post-grace probe)
   adjusted accordingly.
2. **Decision #3 reversed.** Engine `worktree.create` silently reuses existing branches
   where the script's `git worktree add -b` fatals, and `worktree.remove` left a stray
   workspace → ao-core shells out to git, byte-parity including failure modes.
3. `layout.apply` takes `tab_id` ONLY (tab_id+workspace_id → `invalid_target`).
4. `C-u` → translated to `ctrl+u` (`C-u` → `invalid_key`).
5. `ao doctor` adds one `ao-engine:` transport line (socket path + protocol 22 + version);
   everything else byte-identical.
6. Headless PTY is 120x40 vs tmux 80x24 — golden test avoids wrap-sensitive diffs.
7. `ao spawn` additionally refuses if a tmux session `ao-<slug>` exists (collision guard).

## Verification evidence

- **Golden parity test: 62 passed, 0 failed** (rerun for stability) — byte-identical
  outputs across script and ao worlds, incl. the 184KB burst transcript and instant-exit
  tail path. Evidence: `~/.agent-orchestrator/evidence/ao-engine-parity/golden-run/`.
- **Transcript tee verified under load** — burst transcripts byte-identical across worlds.
- **Guard cases** — duplicate slug, `$HOME` root, missing-session, `--rm-worktree`: all per
  contract (covered by golden test assertions).
- **`cargo test -p herdr`: 2164 ok** before the harness dies on the **pre-existing upstream
  SIGPIPE** (identical failure mode to the P0 baseline — no regression; log in evidence
  dir). Nine `detect::manifest` FAILED lines under the default parallel run all pass in
  isolation (59/59 with `--test-threads=1`) — pre-existing upstream parallelism artifact;
  this diff touches nothing in `detect`.
- Spike evidence: `~/.agent-orchestrator/evidence/ao-engine-parity-spike/`.

## Incidents / honest notes

- The P0 commit was unbuildable from a fresh checkout (repo `.gitignore` `build/` swallowed
  `vendor/libghostty-vt/src/build/` + `src/apprt/gtk/build/`) — repaired verbatim from
  ghostty@c5a21edfc with gitignore negations in separate commit `0bf0cad8a` (PR #205
  includes it).
- Merge conflict on `.steering/checkpoint.md` with the concurrent office-dedup session:
  resolved taking main's (their live steering state); this session's checkpoint content is
  preserved in the branch history.
- During guard testing early in the session, `git init` was accidentally run in `$HOME`;
  removed and verified gone. No lasting side effects.
- Dev engine (debug build) was stopped after testing; registry emptied; no stray
  `ao-gold*` sessions. The other worktree's engine (`ao-allternit-runtime-fork`) was left
  running — not this session's to stop.

## Deferrals (per plan, not this phase)

- P2–P5: TUI rebrand, machine/fabric/harness/peer surfaces.
- Deprecating the bash scripts — waits for human sign-off.
- Engine `worktree.*` socket API remains available for later phases (unused by ao-core).
