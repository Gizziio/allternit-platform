# BA-0b CommRails crate rename — map

**Do not start BA-1** (live rail / kill seed bots). This phase is the crate + CLI + HTTP + env + TS filename rename only.

Product: Allternit Agents / Bot Agents. CommRails is crate + CLI + UI name. ao is the worker. Do not invent a fourth product. Do not call the product Runtime.

Worktree: this directory. Branch: `ao/ba-0b-commrails`. Do not touch worktree `allternit-ao-allternit-runtime-api`.

## Target names

| Old | New |
|---|---|
| directory `rails/` | `commrails/` |
| workspace member `"rails"` | `"commrails"` |
| workspace member `"rails/cli"` | `"commrails/cli"` |
| package `allternit-agent-system-rails` | `allternit-commrails` |
| lib `allternit_agent_system_rails` | `allternit_commrails` |
| bin `allternit-rails` | `allternit-commrails` |
| bin `allternit-rails-service` | `allternit-commrails-service` |
| nested crate/bin `rails` (`rails/cli`) | crate + bin `commrails` |
| rustc `use allternit_agent_system_rails::` | `use allternit_commrails::` |
| clap `#[command(name = "allternit-rails")]` | `allternit-commrails` |
| HTTP `/api/rails` and `/rails` | add `/api/commrails` and `/commrails` as canonical; **keep** old prefixes as aliases |
| env `ALLTERNIT_RAILS_*`, `GIZZI_RAILS_URL` | `ALLTERNIT_COMMRAILS_*`, `GIZZI_COMMRAILS_URL` canonical; old names still read |
| TS `comrails-store.ts`, `comrails-types.ts`, `comrails-mail.store.ts`, `comrails-mail.store.test.ts` | `commrails-*` (two m's) |
| service string `"allternit-agent-system-rails"` | `"allternit-commrails"` |

## Do not move (data, not product name)

- `.allternit/peers/`
- `.allternit/wih/`
- `.allternit/bus/`
- `.allternit/ledger/`
- thread ids `wih:executor-*`, `wih:bot-*`, `wih:group-*`

## Known dependents (update these)

Workspace root `Cargo.toml`:

- `members`: `"rails"` → `"commrails"`, `"rails/cli"` → `"commrails/cli"`
- `[workspace.dependencies] allternit-agent-system-rails = { path = "rails" }` → add `allternit-commrails = { path = "commrails" }`

One-release Cargo alias: add a tiny crate `commrails/compat` (or `commrails/alias`):

```toml
[package]
name = "allternit-agent-system-rails"
version = "0.1.0"
edition = "2021"
publish = false

[lib]
path = "src/lib.rs"
```

```rust
#![doc = "One-release alias. Depend on allternit-commrails."]
pub use allternit_commrails::*;
```

Wire it as a workspace member and keep `allternit-agent-system-rails = { path = "commrails/compat" }` in workspace.dependencies. `ao-engine` currently has `allternit-agent-system-rails = { workspace = true }` — point it at `allternit-commrails` instead; the alias exists so anything you miss still links.

Direct path dependents:

- `cmd/allternit-api/Cargo.toml` — `allternit-agent-system-rails = { path = "../../rails" }` → `allternit-commrails = { path = "../../commrails" }` and rustc imports in that crate
- `commrails/cli/Cargo.toml` (after move) — path `..` stays; package dep name becomes `allternit-commrails`
- `infrastructure/executor/ao-engine/Cargo.toml`

Bin shims (same source file, two `[[bin]]` names):

```toml
[[bin]]
name = "allternit-commrails"
path = "src/bin/allternit-commrails.rs"

[[bin]]
name = "allternit-rails"
path = "src/bin/allternit-commrails.rs"
```

Same pattern for `allternit-commrails-service` / `allternit-rails-service`. Nested CLI: bin `commrails` plus bin `rails` pointing at the same main.

Rename the `.rs` bin files when you `git mv` the directory. Keep the old bin **names** as shims.

## HTTP (allternit-api)

`cmd/allternit-api/src/main.rs` today:

```
.nest("/rails", rails_router())
.nest("/api/rails", rails_router())
```

Add:

```
.nest("/commrails", rails_router())
.nest("/api/commrails", rails_router())
```

Keep the `/rails` and `/api/rails` nests. Function `rails_router` may keep its Rust name (internal). Callers of `POST /api/rails/mail/share` must keep working. New callers should use `/api/commrails/mail/share`.

`cmd/gizzi-code/src/runtime/server/rails-bridge.ts`: default URL may stay `/api/rails` this phase (alias). Prefer reading `GIZZI_COMMRAILS_URL` then `GIZZI_RAILS_URL` then `http://127.0.0.1:8013/api/commrails`.

## Env (read new first, then old)

In `commrails/src/bin/allternit-commrails-service.rs` and `commrails/src/orchestrator/mod.rs` (exports for spawned peers):

- `ALLTERNIT_COMMRAILS_HOST` / `ALLTERNIT_RAILS_HOST`
- `ALLTERNIT_COMMRAILS_PORT` / `ALLTERNIT_RAILS_PORT`
- `ALLTERNIT_COMMRAILS_ROOT` / `ALLTERNIT_RAILS_ROOT`
- `ALLTERNIT_COMMRAILS_PEER_NAME` / `ALLTERNIT_RAILS_PEER_NAME`
- `ALLTERNIT_COMMRAILS_INBOX` / `ALLTERNIT_RAILS_INBOX`
- `ALLTERNIT_COMMRAILS_TASK_FILE` / `ALLTERNIT_RAILS_TASK_FILE`
- `GIZZI_COMMRAILS_URL` / `GIZZI_RAILS_URL`

Orchestrator export string should export **both** names this release so old executors still see `ALLTERNIT_RAILS_*`.

## TS file rename (mechanical)

Under `surfaces/ai.allternit.com/src/lib/bots/`:

- `comrails-store.ts` → `commrails-store.ts`
- `comrails-types.ts` → `commrails-types.ts`
- `comrails-mail.store.ts` → `commrails-mail.store.ts`
- `comrails-mail.store.test.ts` → `commrails-mail.store.test.ts`

Update every import. Do **not** delete seed data in the store (that is BA-1). Module comments: CommRails, two m's.

## Docs in-repo (this repo only)

Update strings in:

- `AGENTS.md` (CLI examples + crate name)
- `tools/agent-orchestrator/SKILL.md` and `.agents/skills/agent-orchestrator/SKILL.md` — prefer `allternit-commrails`; keep `allternit-rails` as shim
- `commrails/README.md` (after move)
- `docs/` files that are **current** (not `docs/archive/**`). Skip archive.

Do not edit Allternit Brain (you cannot see it). `brain_updates` in NOTES if you learn a fact that should go there.

## How to move the directory

```
git mv rails commrails
```

That is the only git command allowed. No commit, no push, no branch rename, no PR.

Then fix Cargo.toml paths, lib name, `use` lines (`rg allternit_agent_system_rails` and `allternit-agent-system-rails`).

## Cheap verify (allowed)

```
cargo test -p allternit-commrails
cargo test -p allternit-agent-system-rails
```

Do not `cargo test` the whole workspace. Do not start allternit-api. Do not pnpm build.

If `cargo test -p allternit-commrails` cannot run here, say so in NOTES and still leave the tree compiling-shaped (toml + rustc names consistent).

## Out of scope

- BA-1 live rail / seed bots
- Cloud Agents sessions API
- Fabric PWA bot chat
- Policy gateway
- Computer-orgo
- UHP
- Deploys, Stripe, Docker
- Rewriting HTTP handlers, mail protocol, peer protocol
