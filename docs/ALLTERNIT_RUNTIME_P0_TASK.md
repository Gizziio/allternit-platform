# ALLTERNIT_RUNTIME_P0_TASK — Phase 0 only

Read `docs/ALLTERNIT_RUNTIME_MAP.md` first — it is your full analysis and context. Execute exactly what is below and nothing beyond. Do NOT start any P1+ work (no ao subcommands, no TUI string rebrand, no fabric/harness/peer code).

## Scope (checkable)

1. Fetch herdr v0.9.0 source: `git clone --depth 1 --branch v0.9.0 https://github.com/herdrdev/herdr` into a temp dir, or download the tag tarball. Record the exact upstream SHA. Vendor it into `infrastructure/executor/ao-engine/` in this worktree (exclude `.git`, keep LICENSE, assets, build.rs, rust-toolchain.toml note, src/, vendored portable-pty as needed).
2. Add the crate to the workspace root `Cargo.toml` members list. Internal crate name stays `herdr`; the binary target is renamed to **`ao`** via `[[bin]]`.
3. Apply the gut list: remove/replace `src/update.rs` + its CLI wiring, `src/product_announcements.rs` + wiring, and the remote fetch in `src/detect/manifest_update.rs` (vendor the agent-detection TOML manifests locally instead; keep the local-override directory mechanism). Where removal breaks references (CLI subcommands, config keys), remove the wiring too — minimal, compile-driven edits only.
4. Apache-2.0 compliance: herdr LICENSE preserved in-crate; add the herdr attribution entry to the workspace `THIRD_PARTY_NOTICES.md` (match its existing format).
5. Verify: after gutting, `grep -rn "herdr.dev" infrastructure/executor/ao-engine/src` shows no runtime URL usage (comments/docs hits acceptable — list them in NOTES); `cargo build -p herdr` green; `cargo test -p herdr` results match upstream expectations (run the same tests on a pristine copy if you need a baseline, or note upstream-known failures honestly).
6. Report conflicts: portable-pty `[patch.crates-io]` scope, workspace toolchain vs herdr's 1.96.1 pin, workspace MSRV/edition clashes, herdr tests requiring a TTY/network. Document, don't silently work around.

## Constraints

- No new external services, no network calls added; the crate must work offline after vendoring (except what remains of legitimate user-invoked behavior).
- No rewriting core logic; deletion + minimal rewiring only. The diff vs upstream tag v0.9.0 must stay reviewable.
- Do not commit secrets. Conventional commit prefixes. Push branch when checkpointing.
- Keep `.steering/checkpoint.md` current at each milestone above.

## Definition of done

`docs/ALLTERNIT_RUNTIME_P0_NOTES.md` exists with the YAML frontmatter specified in the MAP (`status`, `files_changed`, `deviations`, `remaining`), prose notes, and evidence paths. Blocked is an acceptable status if you hit a documented conflict you cannot resolve within scope — honesty over force.
