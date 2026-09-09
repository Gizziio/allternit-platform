# ALLTERNIT_RUNTIME_MAP — ao v3 engine fork (P0 analysis map)

You are the executor for Phase P0 of the Allternit agent-orchestrator runtime plan. This map is your full context. Human-approved spec: queue item rq-20260908-028, decision `fork_reskin`.

## What P0 is

Vendor herdr v0.9.0 (https://github.com/herdrdev/herdr, tag v0.9.0) into this Rust workspace as an engine crate at **`infrastructure/executor/ao-engine/`**, gut it of its three herdr.dev network couplings, build it as one `ao` binary, keep the diff mergeable with upstream, Apache-2.0 compliance. Nothing else. ao subcommands, TUI rebrand, fabric/harness/peer surfaces are P1+ — do NOT start them.

## Why herdr

herdr is a single-crate Rust binary (not a workspace), ~395 files under src/, toolchain channel 1.96.1 (rust-toolchain.toml), deps include tokio, ratatui 0.30, crossterm, vendored portable-pty patch, interprocess, clap 4.5, schemars, bincode. It is a background server owning PTYs with a JSON socket API, agent state detection, session persistence, and multi-machine SSH management. Its internal crate name is `herdr` — KEEP that name so future upstream merges stay textual. The user-facing binary target is `ao`.

License: Apache-2.0 since 0.8.0 (was AGPL before — never copy pre-0.8.0 code). No NOTICE file upstream. Preserve LICENSE in-crate; attribute in the workspace THIRD_PARTY_NOTICES.md.

## Gut list (the entire phone-home surface — remove/replace)

1. `src/update.rs` — self-updater (~3800 lines), fetches https://herdr.dev/latest.json / preview.json + brew API. Gut entirely; `herdr update` command goes away (ao updates via harness later).
2. `src/product_announcements.rs` — in-app announcement banners riding the update manifest. Gut entirely.
3. `src/detect/manifest_update.rs` remote fetch — background fetch of https://herdr.dev/agent-detection/index.toml. Disable the fetch; instead VENDOR the agent-detection TOML manifests into the crate (e.g. `assets/agent-detection/` or src-adjacent dir) and load locally. Keep the local-override dir mechanism (~/.config/herdr/agent-detection/) working.

Grep for `herdr.dev` across the vendored source after gutting — the only remaining hits should be comments/docs, no runtime URLs. Also check for any other external network calls and report them in your NOTES.

## Integration requirements

- Add `infrastructure/executor/ao-engine` to the workspace root Cargo.toml members.
- Keep herdr's own Cargo.toml package name `herdr` (internal), but add/keep a `[[bin]]` that builds the binary as **`ao`** (rename the binary target, not the crate — e.g. `[[bin]] name = "ao" path = "src/main.rs"`). If main.rs or build wiring references the binary name, adjust minimally.
- Herdr vendors a `[patch.crates-io]` override of portable-pty 0.9.0 via a `vendor/` dir inside its repo. PORT that patch into the workspace carefully: check whether the workspace root Cargo.toml already has a `[patch]` section; if the portable-pty patch would affect the whole workspace, instead prefer making the patch target scoped (e.g. keep herdr's vendor dir inside ao-engine and put the patch table in ao-engine's Cargo.toml if cargo allows per-member patches — verify; if patches must be workspace-root, evaluate whether the patched portable-pty breaks other workspace members, and if it does, document the conflict honestly in NOTES instead of silently breaking them).
- rust-toolchain: herdr pins channel 1.96.1. The workspace has its own rust-toolchain.toml. Do NOT change the workspace toolchain; if herdr's edition/MSRV conflicts, document it. Try building with the workspace toolchain first.
- Do not run a full workspace build if it's huge — `cargo build -p herdr` (or -p ao-engine per your naming) plus `cargo test -p` for the crate is the gate. If the workspace build is required for member resolution, keep scope to the one crate.

## Repo rules you MUST follow (from workspace AGENTS.md)

- You are already in a session worktree on branch ao/allternit-runtime-fork. Work only here. Never touch the shared checkout.
- Maintain `.steering/checkpoint.md` (Goal / Just did / Next / Open questions) at every milestone. Steering reviews your checkpoints; treat [steering] injections as authoritative.
- git commits pass a steering commit-gate; commit logically with conventional prefixes (feat(ao-engine):, chore(ao-engine):, docs(ao-engine): ...). Push the branch to origin when checkpointing.
- Do not fix unrelated pre-existing breakage; note it.
- No secrets, no .env, no Stripe keys in commits.

## Deliverable sentinel

When finished, write `docs/ALLTERNIT_RUNTIME_P0_NOTES.md` starting with YAML frontmatter:

```yaml
status: done|blocked
files_changed: [paths]
deviations: [what + why]
remaining: [items]
```

then prose notes: what you did, how to verify, test results, pre-existing failures, gut-list grep evidence, any conflicts. That file existing = done.

Also append milestone notes to `.allternit/shared-context.md` when present (append-only, `### allternit-runtime-fork <ISO ts>`), and drop evidence (build logs, grep output) in `~/.agent-orchestrator/evidence/allternit-runtime-fork/`.
