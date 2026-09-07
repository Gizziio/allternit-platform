# bb Platform Audit + Incremental Parity Scaffold — Phase 1

> Session: `session/cacb228c-026d-4ea5-85fe-aa09788e3c7c`  
> Agent: kimi  
> Date: 2026-08-27  
> Commit: `87de5f02c`  

---

## What was asked

Audit the Allternit platform and all its surfaces, analyze bb (https://getbb.app / https://github.com/get-bb/bb), fork it, and map/port bb's capabilities 1:1 into Allternit.

## What was done

### 1. Read-only audits
Produced a comprehensive set of audit documents comparing Allternit and bb:

- `.parity-reports/allternit-audit.md` — full Allternit platform surface inventory.
- `/Users/joe/bb-fork-analysis/docs/allternit-mapping/bb-audit.md` — bb monorepo surface inventory.
- `/Users/joe/bb-fork-analysis/docs/allternit-mapping/bb-data-model-deep-dive.md` — bb SQLite/D1 schema deep dive (28 local tables + 9 cloud tables).
- `.parity-reports/allternit-api-schema-deep-dive.md` — Allternit API schema + route tree.
- `.parity-reports/allternit-web-schema-deep-dive.md` — Allternit web surface schema + views.
- `.parity-reports/bb-allternit-gap-spec.md` — concrete 1:1 mapping and Phase 1 implementation plan.

### 2. Integration approach selected
After presenting three options, **Option A — Incremental Parity** was approved. This treats bb as a reference spec and re-implements bb semantics inside Allternit's existing Rust/TypeScript architecture rather than vendoring or fully merging bb source.

### 3. Rust API scaffold
- Added migration `cmd/allternit-api/migrations/V92__bb_core_entities.sql` creating bb-compatible tables for projects, project sources, environments, hosts, threads, thread sections, events, prompt history, queued messages, and host daemon sessions.
- Implemented `cmd/allternit-api/src/bb/` module:
  - `models.rs` — Rust structs mirroring tables.
  - `contracts.rs` — request/response JSON types.
  - `db.rs` — rusqlite CRUD queries.
  - `routes.rs` — Axum handlers for `/api/v1/bb/*`.
  - `mod.rs` — module exports.
- Mounted `bb_router()` under `/api/v1` in `cmd/allternit-api/src/main.rs`.
- Exposed endpoints: projects CRUD, project sources, hosts CRUD, environments read, threads CRUD, send message, list events.

### 4. Web platform scaffold
- Updated `surfaces/ai.allternit.com/src/lib/db/schema-sqlite.ts`:
  - Added `mode` and `bbProjectId` to `Project`.
  - Added `bbProjectId` and `bbThreadId` to `Chat`.
  - Added `UserPreference` table.
- Added migration `surfaces/ai.allternit.com/src/lib/db/migrations-sqlite/0001_bb_web_entities.sql`.
- Added `surfaces/ai.allternit.com/src/lib/agents/bb-sync.ts` for API client calls.
- Added `surfaces/ai.allternit.com/src/views/bb/BBProjectView.tsx` minimal bb project/thread UI.

### 5. Verification
- `cargo check -p allternit-api` — clean.
- `cargo build -p allternit-api` — clean build.

## What was deferred or blocked

- **Web typecheck** — `pnpm install` fails while building `better-sqlite3` against Node v26.5.0 (6 native compile errors). This prevents `pnpm exec tsc --noEmit` from running in `surfaces/ai.allternit.com`. The TypeScript scaffold is written but not yet typechecked.
- **Full view wiring** — `bb` mode is not yet integrated into `useUnifiedProjects`, `ProjectDetailRouter`, or `ShellRail`.
- **Host runtime bridge** — bb's host-daemon workspace provisioning and provider bridges are not implemented; only the registry tables exist.
- **Terminal, plugin, CLI, mobile, desktop, and bb connect** surfaces are deferred to later phases.

## How to continue

1. Fix the `better-sqlite3` native build (use a Node version compatible with better-sqlite3 12.6.2, or install a prebuilt binary).
2. Run `pnpm exec tsc --noEmit` in `surfaces/ai.allternit.com` and fix bb-related type errors.
3. Wire `bb` mode into the unified project projection and shell rail.
4. Add unit/integration tests for `/api/v1/bb/*` routes.
5. Proceed with Phase 2: host-daemon bridge, terminal integration, plugin SDK mapping.

## Files changed

See commit `87de5f02c` for the full diff. Key files:

- `cmd/allternit-api/migrations/V92__bb_core_entities.sql`
- `cmd/allternit-api/src/bb/{models,contracts,db,routes,mod}.rs`
- `cmd/allternit-api/src/main.rs`
- `cmd/allternit-api/src/lib.rs`
- `surfaces/ai.allternit.com/src/lib/db/schema-sqlite.ts`
- `surfaces/ai.allternit.com/src/lib/db/migrations-sqlite/0001_bb_web_entities.sql`
- `surfaces/ai.allternit.com/src/lib/agents/bb-sync.ts`
- `surfaces/ai.allternit.com/src/views/bb/BBProjectView.tsx`
- `.parity-reports/bb-allternit-gap-spec.md`
