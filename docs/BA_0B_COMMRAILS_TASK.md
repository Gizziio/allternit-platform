# BA-0b CommRails crate rename — task

Read `docs/BA_0B_COMMRAILS_MAP.md` first. It is the full analysis. This file is the only work you do. **Do not start BA-1.**

You are in the allternit-platform repo worktree. You cannot read `~/Desktop/Allternit/`. Everything you need is in the MAP + this task.

## Goal

Rename the Rails crate/CLI/HTTP surface to **CommRails** with one-release shims so nothing currently calling `allternit-rails` or `/api/rails` breaks.

When finished:

- Directory is `commrails/` (was `rails/`)
- Package `allternit-commrails`, lib `allternit_commrails`
- Bins `allternit-commrails` and `allternit-commrails-service` exist
- Old bins `allternit-rails` and `allternit-rails-service` still exist as shims (same source)
- Nested CLI crate/bin is `commrails`; old bin name `rails` still exists as a shim
- `cmd/allternit-api` serves `/api/commrails` **and** `/api/rails` (same router)
- Env reads `ALLTERNIT_COMMRAILS_*` / `GIZZI_COMMRAILS_URL` first, then the old `*_RAILS_*` names
- On-disk `.allternit/peers|wih|bus` paths unchanged
- TS `comrails-*` files renamed `commrails-*` with imports updated; seed data left in place
- Tiny compat crate so `allternit-agent-system-rails` still links for one release
- `ao-engine` and `cmd/allternit-api` depend on `allternit-commrails`

## Hard rules (Allternit)

- Never wrap OpenAI or Anthropic paid agent APIs.
- No Stripe. No deploys. No `confirm: true`. No Docker-for-dev requirement.
- Client-facing copy (if any): Register 1 — plain, no hype, no guarantees.
- Product name is Allternit Agents / Bot Agents. CommRails is the crate/CLI/rail. ao is the worker. Do not invent a new product name. Do not call the product Runtime.
- Do not steal or edit the Cloud Agents worktree.

## Implement exactly

Follow the MAP tables. Sequence:

1. `git mv rails commrails` (only git command allowed — no commit, no push, no PR).
2. Rename package/lib/bin in `commrails/Cargo.toml` and `commrails/cli/Cargo.toml`. Keep old bin **names** as extra `[[bin]]` entries pointing at the new source files.
3. `git mv` the bin source files (`src/bin/allternit-rails.rs` → `allternit-commrails.rs`, same for `-service`). Update clap command name. `use allternit_commrails::…`.
4. Add `commrails/compat` alias crate (`pub use allternit_commrails::*;`, package name `allternit-agent-system-rails`).
5. Root `Cargo.toml` members + workspace.dependencies. Point `cmd/allternit-api` and `ao-engine` at `allternit-commrails`.
6. `rg allternit_agent_system_rails allternit-agent-system-rails` in `*.rs *.toml` (not docs/archive) and fix remaining production code. Compat crate is the only remaining package with the old name.
7. HTTP: nest `/api/commrails` and `/commrails` next to existing `/api/rails` and `/rails` in `cmd/allternit-api/src/main.rs`.
8. Env: new names first, old names fallback. Orchestrator spawn exports **both**.
9. Rename `comrails-*.ts` → `commrails-*.ts` and fix imports. Do not remove seed bots.
10. Update `AGENTS.md`, `tools/agent-orchestrator/SKILL.md`, `.agents/skills/agent-orchestrator/SKILL.md`, `commrails/README.md`. Skip `docs/archive/**`.

## Constraints

- No git operations except `git mv` as above. No commit. No push. No PR.
- No workspace-wide `cargo test` / `cargo build`. Allowed: `cargo test -p allternit-commrails` and `cargo test -p allternit-agent-system-rails`.
- No dev servers. No pnpm. No Docker. No Stripe.
- Do not edit files outside: `commrails/**` (after move), `commrails/compat/**`, root `Cargo.toml`, `cmd/allternit-api/**` (Cargo.toml + main.rs nest + rustc imports if they use the old crate), `infrastructure/executor/ao-engine/Cargo.toml` (+ rustc imports if any), `cmd/gizzi-code/src/runtime/server/rails-bridge.ts` (env fallback only), `surfaces/ai.allternit.com/src/lib/bots/commrails-*` and their importers, `AGENTS.md`, `tools/agent-orchestrator/SKILL.md`, `.agents/skills/agent-orchestrator/SKILL.md`, current (non-archive) docs that name the crate/CLI.
- Do not start BA-1.
- Match repo idiom: existing Cargo workspace layout, Axum `.nest`, clap 4.

## Platform

If `.allternit/shared-context.md` exists, append `### ba-0b-commrails <ISO ts>` with a one-line milestone when you finish.

## Done sentinel

When finished, write `docs/BA_0B_COMMRAILS_NOTES.md` starting with YAML frontmatter:

```yaml
---
status: done | blocked
files_changed: []
deviations: []
remaining: []
brain_updates: []
---
```

Then prose notes: what you renamed, how shims work, whether `cargo test -p allternit-commrails` ran and its result. That file existing = done. `brain_updates` = facts the Allternit brain lacks (empty list if none).

Also `touch docs/BA_0B_COMMRAILS_NOTES.sentinel`.
