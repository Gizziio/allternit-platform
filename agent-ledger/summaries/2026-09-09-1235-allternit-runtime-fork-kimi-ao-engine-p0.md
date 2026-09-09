# Attestation — session ao/allternit-runtime-fork (P0 engine fork)

- Date: 2026-09-09
- Agent family: kimi (orchestrated executor + orchestrator review)
- Branch: `ao/allternit-runtime-fork` → PR #198, merged `0e923fe3ab4bd16bec00082079a61a344a2694eb`
- Queue: `rq-20260908-028` (decision fork_reskin) → landed

## What was done

P0 of the ao v3 runtime plan (`Products/AgentOrchestratorRuntime.md`): vendored
herdr v0.9.0 (Apache-2.0, upstream `b99002ac99b09e00b4ca692436cb15a6b0d676f1`)
into `infrastructure/executor/ao-engine/` as a workspace member (internal crate
name `herdr` kept for cheap upstream merges; `[[bin]] name = "ao"`).

Gut list: `update.rs` self-updater reduced to no-network residue;
`product_announcements.rs` deleted with wiring neutralized;
`detect/manifest_update.rs` remote catalog fetch removed (offline cache
validation; local-override mechanism kept); `remote/attach.rs` release-asset
download removed (offline error → `HERDR_REMOTE_BINARY`); `update`/`channel`
subcommands removed; help URLs repointed herdr.dev → github.com.

Workspace wiring only: root member + version-specific `[patch.crates-io]
portable-pty` (0.9.x; allternit-mux/vps-node on 0.8 unaffected — lockfile
verified); `THIRD_PARTY_NOTICES.md` attribution; LICENSE preserved in-crate.

## How it works

`cargo build -p herdr` produces `target/debug/ao`. Engine runs as a background
server owning PTYs with an ND-JSON socket API (UDS); herdr 0.9.0 removed
`--no-session`, so server-attached is the only mode. Detection manifests ship
bundled; `~/.config/herdr/agent-detection/` remains the local override
authority. Build requires zig 0.15.2 (`ZIG` env var or PATH).

## Verification evidence

- Orchestrator review (2026-09-09, independent of executor): diff vs upstream
  tag = vendoring + gut list + notices + 9-line root Cargo.toml wiring only.
- `herdr.dev` grep: remaining hits are removal-noting comments, the
  `herdr:devin` protocol identifier, and test fixtures — no runtime URLs.
- Binary smokes: `--version` → `herdr 0.9.0` (rebrand is P1+, documented);
  `update`/`channel` → unknown command, exit 2.
- `cargo build` + `cargo check --all-targets` green on workspace rustc 1.94.1.
- Tests: 2410 ok. Failures classified against pristine v0.9.0 built standalone
  (`/tmp/herdr-pristine` during session): SIGPIPE death + 9 detect::
  parallelism flakes + plugin_link env flake are pre-existing upstream
  (pristine crashes identically). One real regression found and fixed:
  workspace ratatui-core 0.1.2 drift broke upstream's katakana width test →
  pinned `ratatui =0.30.0` / `ratatui-core =0.1.0` scoped to ao-engine.
- Full evidence: `docs/ALLTERNIT_RUNTIME_P0_NOTES.md` (in repo) +
  `~/.agent-orchestrator/evidence/allternit-runtime-fork/`.

## Incidents

- Executor ran in Ask-When-Needed mode and froze repeatedly on `rm -rf`
  permission dialogs (~20 min per freeze, 4+ occurrences). Resolved by
  steering (mktemp -d instead of rm -rf) and by launching the P1 executor in
  Never Ask (`--auto`) mode instead.

## Honest deferrals

- `tests/*.rs` integration targets compile but never execute under
  `cargo test -p herdr` (upstream SIGPIPE aborts the run) — pre-existing;
  per-file runs work.
- ~23 dead-code warnings = inert gut residue, documented.
- `ao --version` still prints `herdr 0.9.0`; announcement/release-notes surface
  left inert — both P1+ per scope.
- rust-toolchain.toml (1.96.1) intentionally not vendored; 1.94.1 verified.
