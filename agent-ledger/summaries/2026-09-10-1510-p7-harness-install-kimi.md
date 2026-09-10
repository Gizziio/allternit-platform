# P7 ao harness install lands (rq-20260908-028)

- Date: 2026-09-10 (session 47865698, kimi orchestrator + orchestrated executor)
- PR: #260, merged `40e18cc5e` (branch `ao/harness-install`, commit `fef9d9ff3`)
- Worktree: `allternit-ao-harness-install` (cleaned up after merge)

## What landed

`ao harness install <tool>` — Rust port of HarnessRouter CE's per-backend
version-pinned install scripts (P7 of the ao v3 runtime plan):

- 16-tool manifest gains `license` + `install` (`{method, pinnedVersion,
  installArgs, verifyCmd}`) blocks; Brain `Ops/harness.json` copy updated,
  byte-identical, parity-enforced.
- License hard gate: only apache/mit/bsd install without ceremony;
  proprietary-terms (claude, cursor, antigravity, codebuddy/workbuddy, qoder)
  and undeclared (hermes, dsh, agy) refuse without `--accept-terms <tool>`;
  acceptance recorded per-pin in the managed dir; pin/class change re-flags.
- One managed dir (`~/.ao/harness/`, `AO_HARNESS_HOME` override); PATH injected
  only into ao-spawned subprocesses (P4 FsCtx — no fork of registration).
- `ao doctor` gains `ao-doctor: harness` section; exit 3 new for harness
  problems; ao_parity strips the additive section (documented).
- Network behind `InstallBackend` trait; unit tests use FakeBackend; real npm
  only in the demo.
- 8 tools honestly `unsupported` (no verified pinned public channel).

## Verification (orchestrator re-ran on the committed state — not trusted)

- `cargo test -p herdr --bin ao harness::` — 50/50.
- `cargo test -p herdr ao::` — 93/93.
- `tests/ao_parity/run.sh` — 62/0 on an isolated tmux server (the executor
  root-caused a 10-check mismatch to a poisoned shared tmux server cwd —
  environmental, not a code regression).
- Live gate refusal: `ao harness install claude` with mktemp `AO_HARNESS_HOME`
  refuses pre-fetch; no managed dir created.
- Executor hard gate v3 (evidence `~/.agent-orchestrator/evidence/ao-harness-install/`):
  clean-HOME install kimi+codex (real npm, pins verified) → doctor green →
  sync reaches → installed-kimi session appears in native listing. PASS.
  v1 failed honestly on clean-HOME kimi auth ("No model configured") — recorded.

## Incidents

- The repo steering commit-gate wedged repeatedly: the consult backend
  (`kimi-code` fallback / `allternit-rails steer consult`) hangs on this machine.
  Unglued per gate design (fail-open on consult failure) via hung-consult kills;
  final commit cleared with the documented kill switch `.steering/off`
  (removed after). Real steering outcome before the outage: the gate caught the
  `positionals[1..]` empty-slice panic — fixed, tests re-run.

## Deferred

- venv-pip path fixture-tested only (first real hermes/dsh install confirms).
- dsh verifyCmd assumed from HR pattern; openclaw npm not live-verified.
- P6a (uhp-gateway) follows per Binding 9 sequencing.
