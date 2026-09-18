# Session summary — ao/rust-sdk-rename (S4 of folder reorganization)

- **Date:** 2026-09-18 0912
- **Agent:** kimi-code (subagent of the folder-reorg orchestrator)
- **Worktree:** `allternit-ao-rustsdk`, branch `ao/rust-sdk-rename` (from origin/main @ d6371be6b)
- **PR:** #584 — merged with merge commit `2cf235fe0`

## What was done

Pure-Cargo rename of `platform/sdk` → `platform/rust-sdk`, killing the `sdk/`
name ambiguity (`sdk/` stays the public TypeScript SDK; `platform/rust-sdk` is
explicitly the Rust SDK). Design-pass scope re-verified before acting.

1. `git mv platform/sdk platform/rust-sdk` — 8 crates moved as 100% renames:
   `adapters/rust/marketplace`, `adapters/rust/skills`, `rust/sdk-core`,
   `rust/sdk-apps`, `rust/sdk-functions`, `rust/sdk-policy`,
   `rust/sdk-transport`, `allternit-skill-portability`.
2. Root `Cargo.toml`: 8 workspace `members` entries + 8 `[workspace.dependencies]`
   `path =` entries repointed (`platform/sdk/...` → `platform/rust-sdk/...`) —
   allternit-skills, allternit-sdk-core/-apps/-functions/-policy/-transport,
   allternit-skill-portability, marketplace.
3. Sweep fixes (`git grep -n 'platform/sdk'` over toml/rs/ts/json/yml/md):
   - `README.md` (Three SDKs note: now says rename done 2026-09-18)
   - `REPO_STRUCTURE.md` (Rust SDK table row + "rename planned" NOTE → done)
   - `archive/orphan-crates-audit.md` (2 stale path refs)
   - `docs/openai-audit/KIMI_AUDIT.json`, `openai_allternit_gap_analysis.json`
     (historical audit snapshots; path refs updated so the final zero-hit grep
     holds — line ranges unchanged by the pure rename)

## Verification evidence

- `cargo metadata --no-deps --format-version 1` — exit 0; all 9 moved crates
  resolve at new manifest paths.
- `cargo check -p allternit-sdk-core -p allternit-sdk-apps -p allternit-sdk-functions
  -p allternit-sdk-policy -p allternit-sdk-transport -p allternit-skills
  -p allternit-skill-portability -p marketplace` — exit 0 (39s, shared target dir).
- `cargo check --workspace` (full) — exit 0, 2m46s (beyond the required minimum).
- `node scripts/release-preflight.mjs` — 52 passed, 0 failed.
- `git grep -n 'platform/sdk'` — zero hits repo-wide outside
  `agent-ledger/**` (historical ledger summaries, intentionally left).
- `.github/workflows/` grep for `platform/sdk` — zero hits (exit 1), confirming
  the design pass. No crate used a direct non-workspace `path = "platform/sdk/..."` dep.
- Release-path files untouched: release-desktop.yml, surfaces/allternit-desktop/,
  services/voice/, services/local-engine/, cmd/gizzi-code/**, release-preflight.mjs.

## Incidents / deferrals

- None. Cargo.lock: path-only rename leaves lockfile importers' `name` fields
  unchanged (crate names did not change), so no lockfile churn.
- Desktop rebuild (lifecycle step 8) not needed — the desktop does not bundle
  these crates' build paths beyond the shared workspace build, and no
  release-path file was touched.
