# GC Engine — Phase 1 Task (only phase — read GC_ENGINE_MAP.md first)

You are executing inside `/Users/macbook/Desktop/allternit-workspace/allternit`. Read
`docs/GC_ENGINE_MAP.md` in full before starting — it contains file:line references you need and
explains *why* project scoping matters, don't skip it.

## Constraints

- **No dev servers, no `npm run build`, no `pnpm build`.** `cargo check -p allternit-api` and
  `cargo check -p allternit-gc-agents` are allowed and required before you finish.
- **No git operations** (no commits, no branches) — the orchestrator handles git.
- Match the existing code style in `cmd/allternit-api/src/agent_operations_routes.rs` exactly:
  `rusqlite::params!`, the `db_error()` / `unauthorized()` helpers, `AuthUser`/`get_user(&headers)`
  auth pattern, `serde(rename_all = "camelCase")` for JSON, `json!()` macro for ad hoc responses.
- **Never fabricate data.** If the crate can't produce a result (compile failure you can't fix in
  a reasonable amount of time, missing workspace, clone failure), return a genuine HTTP error with
  a clear message — never synthetic/random numbers. This was explicitly fixed earlier today by the
  orchestrator; regressing it is an automatic fail on review.
- Do not touch the Evaluation Harness or Factory Task routes/tables — GC only.
- Do not change the JSON response *shape* the frontend already consumes for these routes (field
  names stay the same); you may add new required query/path params as specified below.

## Step 1 — Verify the crate compiles standalone

```
cargo check -p allternit-gc-agents
```

If it fails, fix the minimal set of compile errors to get it green (likely dependency-version
drift in `tree-sitter`/`tree-sitter-typescript`/`tree-sitter-rust` — check
`domains/governance/garbage-collection/gc-agents/Cargo.toml` against what's actually resolved in
the workspace lockfile). Record exactly what you changed and why in the NOTES file. Do not touch
files outside `domains/governance/garbage-collection/gc-agents/` to fix this — if the fix requires
changes elsewhere, stop and describe the problem in NOTES with `status: blocked` instead of
guessing.

## Step 2 — Schema migration

Create `cmd/allternit-api/migrations/V19__gc_project_scoping.sql` (check `cmd/allternit-api/migrations/`
first in case a newer migration landed since this spec was written — use the next free number).

Additive only, no destructive changes to existing rows:

1. Add to `cowork_projects` (or create a new minimal table if you judge that's cleaner — your call,
   document the choice and reasoning in NOTES): a `git_remote TEXT` column (nullable — a project
   may point at a local workdir instead of a remote) and whatever else is strictly needed to
   resolve "where is this project's code" (e.g. a `default_branch TEXT` with a sensible default).
2. Add `project_id TEXT NOT NULL` to `gc_policies`. Since existing rows have no project, either:
   - Drop and recreate `gc_policies` with project scoping and re-seed the six default policies
     per-project lazily (on first fetch for a project with no policy rows yet — implement that
     lazy-seed in the route handler, not just in the migration), OR
   - Add the column as nullable, migrate existing global rows to a well-known sentinel project
     (e.g. create one `cowork_projects` row representing "default/local workspace" and backfill),
     then tighten to NOT NULL in a follow-up statement.
   Pick whichever is cleaner given rusqlite/SQLite's `ALTER TABLE` limitations (SQLite can't add a
   NOT NULL column without a default in older versions — check what's actually supported here) and
   explain the choice in NOTES.
3. Add `project_id TEXT` to `gc_runs`, with an index `idx_gc_runs_project` (in addition to the
   existing `idx_gc_runs_user`).

## Step 3 — Wire the crate into `execute_gc()`

In `cmd/allternit-api/Cargo.toml`, add under `[dependencies]`:
```
allternit-gc-agents = { workspace = true }
```
(Same pattern as `allternit-cowork-runtime` a few lines above it — copy that style.)

Rewrite `execute_gc()` in `agent_operations_routes.rs` (currently returns the honest-empty stub) to:

1. Take a `project_id: &str` parameter (threading it through from the route handlers — see Step 4).
2. Resolve the project's row from `cowork_projects` (404 if not found or not owned by `user_id`).
3. Resolve a workspace path for that project:
   - If `git_remote` is set: reuse the clone pattern from `vm_session_routes.rs`
     (`build_bootstrap_script` / the local-exec clone path ~line 1061-1085) to get a fresh
     (or cached, your call — document it) local checkout. You do not need the full VM sandbox
     machinery — a plain `git clone --depth 1 <remote> <tmp_or_cache_dir>` (optionally
     `--branch <default_branch>`) using `std::process::Command` or `tokio::process::Command`,
     matching how the existing code shells out to git, is sufficient. Put clones under a
     consistent cache directory (e.g. `<state_dir>/gc-workspaces/<project_id>/`) so repeated runs
     don't reclone from scratch every time — `git pull` if it already exists.
   - If no `git_remote`: error clearly ("project has no repository configured") rather than
     guessing a path.
4. Call the matching analyzer from `allternit_gc_agents` for the given `agent` name against that
   workspace path. Read `domains/governance/garbage-collection/gc-agents/src/agents.rs` and
   `lib.rs` to find the real entry points (the six agent names in `agent_operations_routes.rs`'s
   `GC_AGENTS` const must map onto whatever the crate actually calls them — check for a mismatch
   and reconcile naming if needed, documenting it in NOTES).
5. Map the crate's `GcAgentResult`/`GcIssue` into the existing response JSON shape (`id`, `agent`,
   `severity`, `location`, `description`, `suggestion`, `fixed`, `lineNumber` per issue; top-level
   `runId`, `agentName`, `executedAt`, `issuesFound`, `issuesFixed`, `entropyReduction`, `metadata`)
   — keep the shape identical to what's there now so the frontend needs no changes.
6. Persist into `gc_runs` with the real `project_id`.

Update `gc_queue`, `gc_policies` (GET + PUT), `gc_cleanup`, `gc_history` route handlers to accept
`project_id` (query param `?projectId=` is fine — pick one convention and use it consistently) and
thread it through. If `projectId` is omitted, return `422` with a clear error body
(`{"error": "projectId is required"}`) — do not silently default to a fabricated project.

## Step 4 — Minimal frontend plumbing

In `surfaces/ai.allternit.com/src/views/settings/AgentOpsPanel.tsx`, find where GC routes are
called. Add a `projectId` resolved from whatever "current project" mechanism already exists in
that surface (search for how `cowork_projects` / projects are fetched elsewhere in
`surfaces/ai.allternit.com/src` — there is likely a hook or a `GET /projects`-style endpoint
already in use for the Cowork feature). If none exists, fetch the first available project for the
signed-in user (simplest correct GET call) and pass its id through, with a `// TODO: real project
picker` comment at the call site. Do not build a picker UI — plumbing only.

## Step 5 — Verify

```
cargo check -p allternit-gc-agents
cargo check -p allternit-api
```
Both must pass clean (warnings OK, errors not OK). Do not run the API server yourself or hit
live routes — the orchestrator will do that in review.

## Deliverable

Write `docs/GC_ENGINE_PHASE_1_NOTES.md` when finished, starting with YAML frontmatter:

```yaml
---
status: done|blocked
files_changed:
  - path/one
  - path/two
deviations:
  - "what you changed vs the spec, and why"
remaining:
  - "anything left undone or deferred"
---
```

Followed by prose covering: what the gc-agents crate needed to compile (if anything), the exact
schema you chose for project scoping and why, how "current project" resolves on the frontend today,
and the mapping between `GC_AGENTS` names and the crate's actual agent identifiers.

That file existing = done. Do not start any other work after writing it.
