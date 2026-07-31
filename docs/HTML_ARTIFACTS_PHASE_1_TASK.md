# Phase 1 — Backend: device-token auth + stable-key versioning for canvases

Read `docs/HTML_ARTIFACTS_MAP.md` first for full context. This phase is
scoped to `cmd/allternit-api` ONLY. Do not touch `cmd/gizzi-code` or
`surfaces/allternit-mobile/ios` in this phase.

## Scope

### 1. Extend device-token auth to canvas routes

`verify_runtime_device_token` (`src/connector_routes.rs:117-206`) already
verifies `allternit_runtime_…`-prefixed bearer tokens and is proven in
production for MCP calls, but only wired into `mcp_proxy_internal`/`/internal/*`
on the *public* router (`main.rs:374`). Canvas routes
(`canvas_routes.rs`, mounted `main.rs:291` behind `auth_middleware`,
`:350-354`) currently only accept Clerk JWT or desktop-bootstrap shared-secret
headers.

Extend `auth_middleware` (`src/auth.rs`, ~line 692-780) so it ALSO accepts a
valid `allternit_runtime_…` device token as an authenticated identity,
resolving to the same `user_id`/session context a Clerk JWT would produce
(read how `verify_runtime_device_token` resolves identity today and match
that resolution — a device token is tied to a session/user already, don't
invent a new identity model). This should be additive — Clerk JWT and
desktop-bootstrap auth must keep working exactly as before. Read the full
existing `auth_middleware` function before editing; match its existing
error-handling and response conventions exactly.

### 2. Stable-key upsert on canvas create

Add an optional `artifact_key: Option<String>` field to the `POST
/agent-sessions/:session_id/canvases` request body (`create_canvas`,
`canvas_routes.rs:124`). When present:
- Look up an existing row in `agent_canvases` matching
  `(session_id, artifact_key)`.
- If found: update it in place (same code path as `update_canvas`'s
  `UPDATE ... WHERE id = ?`, reuse that logic rather than duplicating it —
  extract a shared helper if that's cleaner) and **bump a version counter**
  (see migration below), returning the existing `id`.
- If not found: create a new row as today, but store the `artifact_key` and
  initialize the version counter to 1.
- When `artifact_key` is absent, behavior is unchanged (always creates a new
  row) — this must stay backward compatible for existing canvas callers
  that don't know about artifacts.

### 3. Migration

Add `migrations/V33__agent_canvas_artifact_key.sql` (check right before you
write it that V33 isn't already taken by something else that's landed since
this doc was written — if it is, use the next free number and note the
deviation in your NOTES file). Add to `agent_canvases`:
- `artifact_key TEXT NULL`
- `version INTEGER NOT NULL DEFAULT 1`
- A unique index on `(session_id, artifact_key)` where `artifact_key IS NOT
  NULL` (partial/filtered unique index — check what the DB engine here
  actually is, i.e. read an existing migration for the SQL dialect in use,
  and match it; don't assume Postgres syntax if it's actually SQLite/MySQL
  or vice versa).

### 4. Response shape

`GET /canvases/:canvas_id` and the list/create/update responses should
include `artifact_key` and `version` in the returned JSON so callers (the
CLI, the iOS app) can see them. Keep the rest of the response shape
unchanged.

## Constraints

- No changes to `cmd/gizzi-code` or `surfaces/allternit-mobile/ios` in this
  phase.
- No changes to `artifact_routes.rs` (the unrelated document-artifact
  system) — different feature, do not touch.
- Run `git status --porcelain -- cmd/allternit-api` before you start editing
  and again before you finish, to make sure you're not colliding with
  concurrent work outside this worktree (you're in an isolated git worktree
  on branch `ao/html-artifacts` so this should be clean, but verify — don't
  assume).
- Actually build it: `cargo build -p allternit-api` (or whatever the correct
  package/workspace invocation is — check `Cargo.toml`) must succeed. Run
  `cargo test` for anything touching `canvas_routes.rs`/`auth.rs` if tests
  exist for them; if none exist for this code today, you don't need to add a
  full test suite, but do at least one manual verification: start the
  server locally if you reasonably can, and `curl` through the new
  upsert-by-key flow twice with the same `artifact_key` to confirm the
  second call updates (same `id`, `version` incremented) rather than
  creating a second row. If you can't get the server running locally (e.g.
  missing DB/env setup), say so explicitly in your NOTES file rather than
  skipping verification silently.
- Match existing code style/idioms in this file — read surrounding
  functions in `canvas_routes.rs` and `auth.rs` before writing, don't
  introduce a different error-handling or response-building pattern than
  what's already there.

## Deliverable

When finished, write `docs/HTML_ARTIFACTS_PHASE_1_NOTES.md` starting with
YAML frontmatter:

```yaml
status: done|blocked
files_changed: [list of repo-relative paths]
deviations: [what you changed vs this spec, and why]
remaining: [anything left undone or deferred]
```

Then prose notes: the exact new/changed route contract (request/response
JSON shapes, field names) — Phase 2 (gizzi-code CLI) will read this to know
exactly what to call. Include how you verified the upsert behavior actually
works (curl output or equivalent), and the auth verification (how you
confirmed a device token now authenticates against canvas routes — actual
command/output, not just "should work").

That file existing = phase done. Do not start Phase 2 work.
