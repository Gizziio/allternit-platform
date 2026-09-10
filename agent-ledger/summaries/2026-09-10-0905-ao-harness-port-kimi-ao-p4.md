# Attestation — session ao/harness-port (P4 harness sync port)

- Date: 2026-09-10
- Agent family: kimi (executor in tmux `ao-harness-port` + orchestrator review/merge)
- Branch: `ao/harness-port` → PR #250, merged `847331b12f`
- Queue: `rq-20260908-028` — P0–P4 landed

## What was done

P4 per the plan doc §5: ported the Allternit ops harness-sync JS
(`Ops/harness-sync.js` + `harness-sync/lib.js`, 600 lines, Node) into the ao
binary as `ao harness status|sync|uninstall|describe`, covering all **16
tools** of the live manifest (the plan doc said six; the live manifest's 16 is
the contract). New module `infrastructure/executor/ao-engine/src/ao/harness/`
(mod.rs 778 lines, json_val 550, skills 479, rules 249, mcp_json 292,
mcp_toml 246, mcp_cli 106, collate 139) + embedded verbatim manifest + parity
harness `tests/ao_harness_parity/run.sh` (636 lines). Engine internals
untouched (wiring = 1 line each in `src/ao/mod.rs`, `src/cli.rs`).

## How it works / verification

- **Hard gate = byte-parity, verified twice.** Executor: 21/21 parity checks
  (cold sync tree diff, warm status stdout, idempotent re-sync, dry-run zero
  writes, uninstall ±dry-run, --tools filter, absent rows, drift recovery,
  cursor frontmatter/.jsonc/symlinked skills, localeCompare-order hashing,
  flat skillsFormat, error exits, **live smokes on the real $HOME**).
  Orchestrator independently re-ran the full parity harness on the
  merged-with-main tree: **21/21 passed**; re-ran unit tests: 33/33.
- Full `cargo test -p herdr`: 2456 passed then the pre-existing upstream
  SIGPIPE harness death — same class recorded at P1 (2164) and P2 (2409);
  evidence-backed classification, not papered over.
- PR #250 checks: SW-cache guard, gitleaks, typography green (Rust-only PR —
  typecheck/smoke workflows don't match this path filter).

## Incidents

- None blocking. Two port bugs caught by unit tests pre-parity (TOML args
  pretty-vs-compact; rules/TOML append blank-line separator), fixed against
  real-JS node probes.
- Branch landed behind a moved main; merged origin/main cleanly
  (`.steering/checkpoint.md` scratch stashed/dropped — session scratch only).

## Honest deferrals

- Documented no-manifest-coverage deviations (number lexemes preserved vs JS
  normalized, non-ASCII collation fallback, CLI-spawn stderr text) — none
  exercised by the real manifest.
- Retirement is docs/status only per spec hard gate #4: the JS files remain
  in place intentionally.
- Pre-existing SIGPIPE / detect:: flakes unchanged.

## Retirement note

`Allternit Brain/Ops/harness-sync.js` is retired in favor of `ao harness` as
of this merge. The gizzi-code/desktop call sites of the JS (if any) are a
follow-up: search for invocations before removing anything.
