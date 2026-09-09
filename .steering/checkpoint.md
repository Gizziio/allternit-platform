# Steering checkpoint — ao/ao-engine-parity (P1)

## Goal
P1 of the ao v3 runtime plan (queue rq-20260908-028): on the P0-vendored herdr engine in
`infrastructure/executor/ao-engine/`, implement `ao spawn|send|watch|status|kill|doctor` with
byte-level contract parity to the bash scripts in `~/.claude/skills/agent-orchestrator/scripts/`,
plus one additive engine patch (PTY-tee transcripts). Spec: Allternit Brain
`Research/specs/ao-engine-parity.md` (verify section is the hard gate); binding memo
`Research/drafts/prep-p1-socket-parity.md` (12 design decisions; PTY-tee is the only allowed
engine diff). Engine runs as named session `ao`.

## Just did
- Read spec + parity memo + all six contract scripts (byte-level contract captured).
- Deep-surveyed the vendored crate via 3 explore agents: PTY output flow (hook: on_read closure
  in pane.rs:2343 / PtyIoActorConfig), CLI dispatch (hand-rolled in cli.rs, add src/cli/ao.rs),
  full RPC schema reference. Key finding: `events.wait` does NOT support pane_exited matches
  (only pane_agent_status_changed) — spec decision #5's events.wait arm is disproven by source;
  probe-based liveness survives. No liveness field anywhere; exited panes keep stale shell_pid
  in process_info (spike must confirm against running server).
- Found P0 commit is unbuildable from a fresh checkout: repo .gitignore `build/` swallowed
  `vendor/libghostty-vt/src/build/` (+ gtk/build) at commit time. Restored both from upstream
  ghostty@c5a21edfc (verified the only vendor diffs vs that commit are the two documented herdr
  patches), added .gitignore negations.

## Next
1. Commit vendor repair (fix(ao-engine)), push; then build the engine and boot it as session ao.
2. Run the 3-item spike (post-exit pane.get/read/process_info; placeholder-tab side effects;
   read-after-exit) + exercise worktree.create/remove churn; record findings in P1 NOTES.
3. Implement the PTY-tee patch, then src/cli/ao.rs six subcommands, then the golden parity test.

## Open questions
- events.wait pane_exited unsupported at v0.9.0 (source-verified) → watch/status liveness will be
  probe-based (process_info shell_pid + kill(pid,0)) per memo fallback; will record as a
  spike-settled deviation if the running engine confirms.
- layout.apply rejects tab_id+workspace_id together (invalid_target) → spike must confirm the
  correct invocation shape (tab_id only).
- Decision #3 (engine worktree.create/remove) vs git-subprocess parity: will exercise in spike
  and record; git subprocess may win on byte-parity grounds.

---

<!-- previous checkpoints below -->
