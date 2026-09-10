# AO UHP Gateway — P6b SCOPE (sentinel)

Date: 2026-09-10 · Branch: `ao/uhp-p6b` · Worktree: `allternit-ao-uhp-p6b`
Plan: `Products/AgentOrchestratorRuntime.md` §5 P6b · Parent: P6a (PR #265, `docs/AO_UHP_GATEWAY_NOTES.md`)

## Mission

Two halves, both required:

### Half 1 — remaining backend drivers (6)

Port CLI drivers for **gemini, qwen, opencode, cline, pi, dsh** into
`infrastructure/executor/uhp-gateway/src/drivers/`, following the existing
`kimi.rs` / `claude.rs` / `codex.rs` shape exactly (argv construction +
incremental NDJSON line parsing + session-ref capture for resume).

Port source (oracle): `vendor/harnessrouter-ce/runner/server.py`
- `_build_dsh` (line ~1630)
- `_build_pi` (line ~1861)
- `_build_qwen` (line ~3183)
- `_build_gemini` (line ~3333)
- `_build_cline` (line ~3430)
- `_build_opencode` (line ~3746, env note at ~3714)

Wire into `drivers/mod.rs`: `DriverKind` variants, `from_base` base strings
(`gemini`, `qwen`, `opencode`, `cline`, `pi`, `dsh` + `*-*` aliases as HR maps
them), `binary()`, `argv()`, `parse_line()`. Registered/seeded harnesses for
installed binaries only — do NOT claim availability for binaries absent on the
machine (`available` must reflect real `PATH` presence, as P6a did).

Installed on this machine: **qwen** ✓, **opencode** ✓.
NOT installed: gemini, cline, pi, dsh → **do not auto-install** (P7 license-gate
rules; installs need explicit human opt-in). Those four drivers are
fixture-tested only; live gates for them are an honest deferral.

Unit tests: per-driver argv fixtures (ported expectations from the `_build_*`
functions) + parse_line fixtures using HR pytest evidence files where they
exist (`test_gemini_backend.py`, `test_cline_followup.py` are the only dedicated
backend pytest files; for qwen/opencode/pi/dsh the oracle is the `_build_*`
source itself — state that honestly).

### Half 2 — conformance class rises to Full

`uhp-conformance --class full` = 40 core + 16 full checks green (56/56).
Full-class surface to implement (check ids in
`vendor/harnessrouter-ce/protocol/conformance/uhp_conformance/checks.py`):

- **F-01..F-08 harness config:** skills (SKILL.md bundle round-trip, refusal
  without SKILL.md, unrelated edit must not destroy skill contents),
  MCP servers + disabled tools round-trip, harness delete cleanup.
- **F-02** creating a harness with an unsupported base is refused — new bases
  from Half 1 must be accepted here.
- **R-01..R-08 session sharing:** publish a session (bodyless POST), share id
  is not an API credential, shared view read-only + exposes no credentials,
  revocation kills all links, deleting a session takes its share with it.
- Discovery `conformance_class` must become `"full"` with the matching
  capabilities list (see checks.py line ~120).

"extended" tier (X-*, files/artifacts) is OUT of scope — beyond P6b's bar.

## Hard gates (all must pass before sentinel update)

1. `cargo test -p uhp-gateway` — all green, including new driver fixtures.
2. `cargo test -p herdr ao::` — unchanged green (additive-only rule).
3. Recreate the conformance venv (it was tmp-cleaned):
   `python3 -m venv ~/.agent-orchestrator/uhp-venv && ~/.agent-orchestrator/uhp-venv/bin/pip install -e vendor/harnessrouter-ce/protocol/conformance`
4. Boot `ao serve` on a fresh port + mktemp data dir; run
   `uhp-conformance --class full --harness-id chrn_kimi` → 56/56.
5. Live driver gates (installed binaries only): through the running server,
   qwen and opencode each do a real blocking turn (short prompt, low-cost
   model if selectable) with correct streamed text; capture transcripts to
   `~/.agent-orchestrator/evidence/ao-uhp-p6b/`.
6. `cargo build -p herdr --release` not required; debug build + clippy-clean
   new code.

## Rules

- No herdr engine internals changed — additive only (`src/ao/*`, uhp-gateway
  crate). `THIRD_PARTY_NOTICES.md` already covers the vendor; update only if
  you import new referenced material.
- Honest reporting: fixture-tested ≠ live-verified. Say which is which.
- Commit per driver + per surface area (logical commits); push branch often.
- Env: `export PATH="/opt/homebrew/opt/zig@0.15/bin:$PATH"` for cargo.
- Steering commit-gate backend hangs on this machine: `touch .steering/off`
  before your first commit; do not commit the kill-switch file itself.
- Update this file's status as you go; write final NOTES as
  `docs/AO_UHP_P6B_NOTES.md` when gates pass.

## Done =

All 6 gates green + NOTES written + branch pushed. Then stop and report —
the orchestrator reviews, re-verifies independently, and lands the PR.
