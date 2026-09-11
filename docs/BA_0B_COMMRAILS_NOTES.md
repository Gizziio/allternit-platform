---
status: done
files_changed:
  - Cargo.toml
  - AGENTS.md
  - commrails/Cargo.toml
  - commrails/README.md
  - commrails/cli/Cargo.toml
  - commrails/cli/src/main.rs
  - commrails/compat/Cargo.toml
  - commrails/compat/src/lib.rs
  - commrails/src/bin/allternit-commrails.rs
  - commrails/src/bin/allternit-commrails-service.rs
  - commrails/src/orchestrator/mod.rs
  - commrails/src/service.rs
  - commrails/src/verification/provider_factory.rs
  - commrails/tests/invariants.rs
  - cmd/allternit-api/Cargo.toml
  - cmd/allternit-api/src/main.rs
  - cmd/allternit-api/src/rails/mod.rs
  - cmd/allternit-api/src/rails_client_impl.rs
  - cmd/allternit-api/src/agent_routes.rs
  - cmd/allternit-api/src/agent_email_routes.rs
  - cmd/allternit-api/src/bot_desktop_routes.rs
  - cmd/allternit-api/src/remote_peers.rs
  - cmd/allternit-api/src/stream/mod.rs
  - cmd/allternit-api/src/webhook_trigger_routes.rs
  - infrastructure/executor/ao-engine/Cargo.toml
  - infrastructure/executor/ao-engine/src/ao/peers/mod.rs
  - infrastructure/executor/ao-engine/src/client/visibility_feed.rs
  - cmd/gizzi-code/src/runtime/server/rails-bridge.ts
  - surfaces/ai.allternit.com/src/lib/bots/commrails-store.ts
  - surfaces/ai.allternit.com/src/lib/bots/commrails-types.ts
  - surfaces/ai.allternit.com/src/lib/bots/commrails-mail.store.ts
  - surfaces/ai.allternit.com/src/lib/bots/commrails-mail.store.test.ts
  - surfaces/ai.allternit.com/src/shell/ShellRail.tsx
  - surfaces/ai.allternit.com/src/components/agents/FloatingAvatar.tsx
  - surfaces/ai.allternit.com/src/lib/bots/BotInboxContent.tsx
  - surfaces/ai.allternit.com/src/lib/bots/group-rooms-sync.ts
  - surfaces/ai.allternit.com/src/lib/bots/group-rooms-api.ts
  - surfaces/ai.allternit.com/src/lib/agents/tools/agent-comm.tool.ts
  - surfaces/ai.allternit.com/src/lib/agents/tools/agent-comm.tool.test.ts
  - surfaces/ai.allternit.com/src/views/bots/BotInboxView.tsx
  - tools/agent-orchestrator/SKILL.md
  - .agents/skills/agent-orchestrator/SKILL.md
  - docs (29 current non-archive .md files, crate/CLI name strings only)
deviations:
  - "docs/ files that are current" was implemented as a string rename (allternit-agent-system-rails/allternit-rails -> commrails names) across all 29 non-archive docs that name the crate/CLI, including dated RAILS_* TASK/NOTES records; the old bin/HTTP/env names still work, so no doc became false. docs/BA_0B_* spec files and docs/archive/** untouched.
  - Reverted an accidental sed change to persisted localStorage section ids ('comrails-bots'/'comrails-groups' kept as-is in commrails-store.ts; only imports/module comments renamed there).
remaining:
  - scripts/maintenance/cleanup.sh line 28 still rm -rf's "${PROJECT_ROOT}/rails/target" — outside the allowed edit set; harmless (stale path, no such dir after rename).
  - scripts/capture_and_check/mock_api.py mocks /api/v1/rails/gate/autoland — a different (autoland) API surface, out of scope.
  - CI/release workflows (.github/) were not checked for rails/ paths; none were found by grep.
brain_updates:
  - "CommRails is the renamed crate/CLI/HTTP surface for what was allternit-agent-system-rails (BA-0b, 2026-09-10). Package allternit-commrails, bins allternit-commrails / allternit-commrails-service / commrails; old names (allternit-rails, allternit-rails-service, rails, /api/rails, ALLTERNIT_RAILS_*, GIZZI_RAILS_URL) are one-release shims. Compat crate commrails/compat keeps allternit-agent-system-rails linking."
---

# BA-0b CommRails rename — notes

## What was renamed

- `git mv rails commrails`; `git mv` of both bin sources to `allternit-commrails.rs` / `allternit-commrails-service.rs`. The only git verbs used were `git mv`, per constraints.
- Package `allternit-commrails`, lib `allternit_commrails` (commrails/Cargo.toml).
- Nested CLI crate/package `commrails` (was `rails`), dep `allternit-commrails = { path = ".." }`.

## How the shims work

- `commrails/Cargo.toml` has four `[[bin]]` targets: `allternit-commrails` + `allternit-rails` both → `src/bin/allternit-commrails.rs`; `allternit-commrails-service` + `allternit-rails-service` both → `src/bin/allternit-commrails-service.rs`. Cargo builds the same source under both names.
- `commrails/cli/Cargo.toml` has bins `commrails` and `rails`, both → `src/main.rs`.
- `commrails/compat/` is a tiny alias crate: package name `allternit-agent-system-rails`, `pub use allternit_commrails::*;`. Wired as a workspace member; root `Cargo.toml` keeps `allternit-agent-system-rails = { path = "commrails/compat" }` in `[workspace.dependencies]` so anything missed still links. It is the only remaining crate with the old name (verified by repo-wide grep).
- HTTP: `cmd/allternit-api/src/main.rs` now nests `/commrails` and `/api/commrails` on the same `rails_router()`; `/rails` and `/api/rails` kept. Internal Rust names (`rails_router`, `RailsState`, `cmd/allternit-api/src/rails/mod.rs`) unchanged.
- Env: `allternit-commrails-service` reads `ALLTERNIT_COMMRAILS_{HOST,PORT,ROOT}` first, then falls back to `ALLTERNIT_RAILS_*`. The orchestrator spawn command exports **both** `ALLTERNIT_COMMRAILS_{PEER_NAME,INBOX,ROOT,TASK_FILE}` and the legacy `ALLTERNIT_RAILS_*` names so old executors still see them.
- `cmd/gizzi-code/src/runtime/server/rails-bridge.ts`: `GIZZI_COMMRAILS_URL` → `GIZZI_RAILS_URL` → default `gatewayUrl("/api/commrails")`.
- TS: `comrails-{store,types,mail.store,mail.store.test}.ts` → `commrails-*` via `git mv`; all 11 importers updated. Seed bot data in the store untouched (BA-1).
- On-disk data paths (`.allternit/peers|wih|bus|ledger`) and thread ids unchanged.
- `ao-engine` and `cmd/allternit-api` now depend on `allternit-commrails` directly.

## Verification

- `cargo test -p allternit-commrails` — PASS: 5/5 integration tests (invariants.rs), 1/1 doc-test, both bin targets compile (including the old-name shims).
- `cargo test -p allternit-agent-system-rails` — PASS (compat alias links and tests clean).
- Repo-wide grep: no `allternit_agent_system_rails` / `allternit-agent-system-rails` remains in any `.rs`/`.toml` outside `commrails/compat`.
- Per constraints: no workspace-wide cargo build/test, no allternit-api server start, no pnpm, no Docker, no git commit/push/PR.
