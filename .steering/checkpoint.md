# Steering Checkpoint — P7 ao harness install

## Goal
P7 of ao v3 runtime plan: `ao harness install <tool>` (Rust port of HR CE
entrypoint install scripts, version-pinned per backend), per-tool license
tags + hard gate, one managed dir (`~/.ao/harness`, `AO_HARNESS_HOME`
override), `ao doctor` extension. Spec: `Allternit Brain/Research/specs/
ao-harness-install.md`; positioning note wins on disagreement. Worktree:
`allternit-ao-harness-install`, branch `ao/harness-install`.

## Just did
- Read brief/spec/positioning note; explored ao crate (P4 harness sync at
  `src/ao/harness/`, P5 catalog at `src/ao/native/`, `ao doctor` in
  `src/cli/ao.rs`).
- Fetched HR CE `docker/entrypoint.sh` as install reference (npm -g
  --prefix, venv+pip pinned, gh-release; "executable IS installed").
- Verified license/pin facts: codex Apache-2.0 npm @openai/codex@0.154.0;
  kimi MIT npm @moonshot-ai/kimi-code@0.42.0 (tarball LICENSE; GitHub
  metadata says Apache-2.0 — noted); qwen Apache-2.0 0.23.3; opencode MIT
  1.18.30; openclaw MIT 2026.9.3; claude proprietary-terms 2.1.267; grok
  Apache-2.0 per its README (no verified pinned channel); gizzi MIT
  (cmd/gizzi-code/LICENSE); hermes/dsh undeclared per spec (HR CE: hermes
  venv hermes-agent==0.19.0, dsh 0.1.2rc1); agy undeclared; cursor /
  antigravity / codebuddy / workbuddy / qoder proprietary-terms, method
  unsupported (no verified pinned channel).
- Key constraints found: parity harness asserts repo `harness.json` copy
  byte-identical to Brain `Ops/harness.json`; `ao_parity/run.sh` diffs
  `ao doctor` stdout vs script reference (ao-engine line stripped) — new
  doctor section must be strippable + exit-code-neutral when managed dir
  absent; `ao visibility --home` exists for native listing; driver
  `installed()` probes PATH — managed bin must join FsCtx path_dirs so
  sync reaches installed tools.

## Just did (continued, post-hard-gate)
- Hard gate v1/v2 FAILED honestly (no auth in clean HOME; JSON parse
  pollution), v3 PASSED — verdicts + transcripts in
  `~/.agent-orchestrator/evidence/ao-harness-install/`, summary in NOTES.
- Root-caused the recurring ao_parity 10-check mismatch (identical across
  5 runs, all in tmux-pane-lifecycle checks, disjoint from the P7 diff):
  the MACHINE-GLOBAL tmux server (pid 70283, started 2026-09-09 10:41,
  hosts this live orchestrator session) has cwd = the DELETED P2 worktree
  `allternit-ao-tui-machines`. Proven by minimal repro: `tmux new-session
  -d -c /tmp 'pwd…'` on this server runs the pane IN the deleted dir
  (getcwd fails) and `pane_current_path` reports the deleted path — so
  `ao-status` workdirs, `ao-kill --rm-worktree` pane-dir checks, and every
  fresh pane are poisoned. P1's green 62/0 ran on the PREVIOUS tmux server
  (socket dir mtime 09-09 10:41 > P1's 04:48–09:42 green runs).
- Fix without killing the live server: run parity under an isolated tmux
  server (`TMUX_TMPDIR=/tmp/ao-p7-tmux-isolated`, `env -u TMUX`) — panes
  start in the right cwd there (verified). Full ao_parity re-run on the
  isolated server in flight; result goes into NOTES verbatim.

## Next
1. ~~ao_parity isolated re-run~~ DONE — 62 passed, 0 failed (PARITY_EXIT=0)
   after also fixing a golden-script drift (ao-spawn edited 09-09 10:26 to
   suppress git worktree stderr; engine `spawn --worktree` stderr → null to
   match — one line in src/cli/ao.rs, documented in NOTES).
2. ~~Full cargo suite~~ DONE — 2504 passed, then the documented pre-existing
   SIGPIPE upstream death; 9 detect:: parallel flakes all pass serially
   (111/0). Both classes spec-sanctioned. Recorded in NOTES.
3. Finalize NOTES (done), commit on `ao/harness-install` (NO push —
   orchestrator opens the PR per P4 precedent).

## Open questions
- Environmental follow-up for a human/machine reboot: the default tmux
  server (pid 70283) cwd is the deleted tui-machines worktree; every
  pane-spawning test on the default socket is poisoned until it restarts
  (it hosts the live ao-harness-install orchestrator pane, so P7 did NOT
  kill it). Parity was verified under an isolated TMUX_TMPDIR server.
- Orchestrator owner decision: the 09-09 10:26 ao-spawn suppression that
  moved the parity contract — if unintentional, revert script + engine
  line together (both flagged in NOTES).
