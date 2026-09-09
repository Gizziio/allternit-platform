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
- P1 implementation complete and verified: PTY-tee transcript patch (`src/ao/`, wired through
  `spawn_command_builder` in pane.rs); `src/cli/ao.rs` six subcommands with verbatim
  contract messages/exit codes; registry at `~/.agent-orchestrator/state.json` as the
  remain-on-exit analog; dispatch in cli.rs/main.rs/spec.rs.
- Golden parity test rerun: 62 passed, 0 failed (byte-identical across worlds, burst
  transcripts identical).
- `cargo test -p herdr`: 2164 ok, dies on pre-existing upstream SIGPIPE (same as P0).
  9 detect::manifest FAILED under parallel run all pass in isolation (59/59) — pre-existing
  upstream parallelism artifact, untouched by this diff.
- Spike findings + deviations recorded in `docs/ALLTERNIT_RUNTIME_P1_NOTES.md`
  (status: done). Evidence copied to `~/.agent-orchestrator/evidence/ao-engine-parity/`.
- Smoke-test leftovers cleaned: dev engine stopped, registry emptied, no stray ao-gold*
  sessions.

## Next
1. Commit, push, `gh pr create` + `gh pr merge --merge`; record PR/SHA.
2. Shared-checkout ritual: pull --ff-only, ledger attestation summary + LEDGER.md entry,
   commit on main with STEER_GUARD_OFF=1, push.
3. Brain update as draft (no confirm). Then worktree/branch cleanup.

## Open questions
- None for P1. P2-P5 (TUI rebrand, machine/fabric/harness/peer surfaces) remain per plan;
  bash script deprecation waits for human sign-off.
