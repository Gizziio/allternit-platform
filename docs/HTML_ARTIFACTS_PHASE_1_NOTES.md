---
status: done
files_changed:
  - cmd/allternit-api/src/auth.rs
  - cmd/allternit-api/src/canvas_routes.rs
  - cmd/allternit-api/src/connector_routes.rs
  - cmd/allternit-api/migrations/V33__agent_canvas_artifact_key.sql
deviations:
  - "Steering review caught a TOCTOU race in the first pass's artifact-key
    upsert (separate SELECT then INSERT/UPDATE, racy across the
    connection-per-call model this codebase uses). Rewrote as a single
    atomic INSERT ... ON CONFLICT(session_id, artifact_key) DO UPDATE ...
    RETURNING, matching the existing upsert idiom in db.rs/auth.rs. As a
    consequence the upsert-by-key merge semantics changed from
    field-level-partial-merge (task spec's literal wording: 'same code path
    as update_canvas') to full-replace: a redeploy now writes every field
    from the payload, defaulting absent ones the same way a brand-new
    create does, rather than preserving old field values when the payload
    omits them. PATCH /canvases/:id (edit by known id) is untouched and
    keeps the original partial-merge behavior. See 'Race-condition fix'
    section below for the reasoning and re-verification."
remaining: []
---

## Summary

`cmd/allternit-api` now accepts `allternit_runtime_…` device-token bearer
auth on canvas routes, and `POST /agent-sessions/:session_id/canvases`
supports a caller-supplied `artifact_key` for stable-key upsert/versioning.
V33 was free (latest landed migration was V32), so no number deviation was
needed.

## 1. Device-token auth on canvas routes

`auth_middleware` (`src/auth.rs`) gained a new branch between the
desktop-bootstrap check and the Clerk-JWT check: if the request's
`Authorization: Bearer allternit_runtime_…` header matches the device-token
prefix, it's introspected via the *same* function already proven for
`mcp_proxy_internal` — `verify_runtime_device_token` in
`src/connector_routes.rs` (made `pub(crate)`, along with
`DEVICE_TOKEN_PREFIX` and `device_token_from_headers`, so `auth.rs` calls the
identical logic rather than reimplementing it). That function POSTs to
`{cloud_api_url}/api/v1/runtime-devices/verify-token` with the token as a
bearer credential and reads `userId` back from the JSON response — the
token-derived `user_id` becomes the request's `AuthUser` (email/name/org left
`None`, same as any other identity that only carries a bare user id), passed
through `ensure_user_in_db` exactly like the Clerk and desktop-bootstrap
paths so it lands in `users`/`insert_user_headers`/`Extension<AuthUser>`
identically. Fails closed exactly as `verify_runtime_device_token` already
did for MCP: 401 if the cloud-api rejects the token or no `cloud_api_url` is
configured, 502 if the cloud-api is unreachable or answers garbage. Clerk JWT
and desktop-bootstrap paths are unchanged — this is a purely additive third
branch checked before the Clerk-JWT attempt (device tokens are a distinct
prefix, so there's no ambiguity with a Clerk bearer token).

## 2. Stable-key upsert + versioning

### Migration — `migrations/V33__agent_canvas_artifact_key.sql`

SQLite (confirmed from existing migrations' `CREATE TABLE IF NOT EXISTS`
and `DATETIME` syntax, and `rusqlite` as the driver in `canvas_routes.rs`):

```sql
ALTER TABLE agent_canvases ADD COLUMN artifact_key TEXT NULL;
ALTER TABLE agent_canvases ADD COLUMN version INTEGER NOT NULL DEFAULT 1;

CREATE UNIQUE INDEX IF NOT EXISTS idx_agent_canvases_session_artifact_key
    ON agent_canvases(session_id, artifact_key)
    WHERE artifact_key IS NOT NULL;
```

SQLite partial (filtered) unique indexes are supported since 3.8.0, so rows
with `artifact_key IS NULL` (i.e. every canvas created before this phase, and
every future caller that doesn't pass one) are exempt from the uniqueness
constraint — only `(session_id, artifact_key)` pairs with a real key are
constrained.

### Route contract

**`POST /api/v1/agent-sessions/:session_id/canvases`**

Request body — one new optional field, everything else unchanged:

```jsonc
{
  "title": "string | omit",
  "components": "json value | omit (defaults to [])",
  "layout": "json value | omit",
  "metadata": "json value | omit",
  "artifact_key": "string | omit"   // NEW
}
```

Behavior:
- `artifact_key` **absent** → unchanged: always inserts a new row, `id` is a
  fresh UUID, `version` initialized to 1. Response: `201 Created`.
- `artifact_key` **present**, no existing row for
  `(session_id, artifact_key)` → inserts a new row with that key and
  `version = 1`. Response: `201 Created`.
- `artifact_key` **present**, matching row exists → updates that row in
  place — **full replace**: `title`/`components`/`layout`/`metadata` are set
  from the payload exactly as a fresh create would (an omitted field resets
  to that field's create-time default, it does *not* preserve the old
  value) — and increments `version`. Response: `200 OK` (not 201 — this is a
  redeploy, not a creation), same `id` as before. See "Race-condition fix"
  below for why this is full-replace rather than field-level merge.

Response body (both create and upsert-update branches):

```jsonc
{
  "id": "uuid",
  "session_id": "string",
  "artifact_key": "string | null",
  "version": 1,
  "updated_at": "rfc3339 timestamp"   // present on the upsert-update branch only
}
```

**`GET /api/v1/canvases/:canvas_id`**, **`GET /api/v1/agent-sessions/:session_id/canvases`**

`CanvasResponse` now includes two new fields (rest unchanged):

```jsonc
{
  "id": "...", "session_id": "...", "title": "...",
  "components": [...], "layout": null, "metadata": null,
  "artifact_key": "string | null",   // NEW
  "version": 1,                       // NEW
  "created_at": "...", "updated_at": "..."
}
```

**`PATCH /api/v1/canvases/:canvas_id`**

Response now includes `artifact_key` and `version` (unchanged by an ordinary
PATCH — only the artifact-key upsert path in `create_canvas` bumps
`version`):

```jsonc
{ "id": "...", "updated_at": "...", "artifact_key": "string | null", "version": 1 }
```

### Implementation note

`PATCH /canvases/:canvas_id` (`update_canvas`) uses a helper,
`apply_canvas_update(conn, canvas_id, fields, bump_version: bool)`
(`canvas_routes.rs`) — fetches the existing row, merges in whatever fields
are present (payload wins, else keeps existing), writes it back. It's
called with `bump_version = false` (an ordinary PATCH never touches
`version`).

`create_canvas`'s artifact-key upsert branch does **not** use this helper —
see "Race-condition fix" below for why it's a single atomic SQL statement
instead.

### Race-condition fix (post-review)

The first pass had `create_canvas`'s upsert branch do `SELECT id ... WHERE
session_id = ? AND artifact_key = ?`, then either `INSERT` (not found) or
call `apply_canvas_update` (found). Steering review caught that this is a
real TOCTOU race: `DbHandle::connect()` (`db.rs`) opens an independent
SQLite connection per call with no app-level mutex/pool serializing writes,
so two concurrent `POST`s with the same `(session_id, artifact_key)` could
both pass the SELECT before either commits — the first `INSERT` succeeds,
the second collides with the new unique index and falls into a generic
`500 "Database error"` instead of updating in place. The two-curl-in-a-row
verification in the original pass never exercised this because it wasn't
concurrent.

Fixed by replacing the SELECT-then-branch with one atomic statement,
matching the upsert idiom already used elsewhere in these exact files
(`set_session_origin_surface` in `db.rs`, `ensure_user_in_db` in `auth.rs`):

```sql
INSERT INTO agent_canvases (id, session_id, user_id, title, components, layout, metadata, artifact_key, version, created_at, updated_at)
VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, 1, ?9, ?9)
ON CONFLICT(session_id, artifact_key) WHERE artifact_key IS NOT NULL DO UPDATE SET
    title = excluded.title,
    components = excluded.components,
    layout = excluded.layout,
    metadata = excluded.metadata,
    version = agent_canvases.version + 1,
    updated_at = excluded.updated_at
RETURNING id, version, updated_at
```

The `ON CONFLICT` target names the same columns as the partial unique index
plus its own `WHERE` clause (SQLite requires the two to match exactly for a
partial index to be used as the upsert's conflict arbiter — supported since
SQLite 3.35, and `rusqlite = "0.31"` with the `bundled` feature ships well
past that). `RETURNING` reports the row's real `id` — on conflict this is
the *existing* id (the column is never included in `SET`), not the fresh
UUID generated for the attempted insert — so "same `id` as before" holds
without a second query. `version == 1` in the returned row uniquely
identifies "this was a fresh insert" (a redeploy's `existing_version` is
always `>= 1` before incrementing), which is what picks `201` vs `200` for
the response status without any extra bookkeeping.

This is why the upsert became full-replace: `title`/`layout`/`metadata` are
nullable columns so a `NULL`-as-"omitted" sentinel could in principle drive
a `COALESCE(excluded.x, agent_canvases.x)`-style partial merge, but
`components` is `NOT NULL DEFAULT '[]'` (from the original V13 migration) —
there is no way to encode "the payload didn't include `components`" as a
value distinct from "the payload explicitly wants `[]`" once it has to pass
through that column. Rather than special-case one field, both branches
(fresh create and redeploy) now use the same "field present → its value,
field absent → this endpoint's default" rule uniformly. This also matches
the actual Phase 2 use case better than field-level merge would: a redeploy
is *publishing the artifact's current full state*, not patching one field of
an existing canvas — that finer-grained editing use case is what
`PATCH /canvases/:id` is for, and it's unchanged.

## Verification

Built clean:

```
$ cargo build -p allternit-api
    Finished `dev` profile [unoptimized + debuginfo] target(s) in 2m 07s
```

(4 pre-existing warnings, all in files this phase didn't touch — unrelated.)

`cargo test -p allternit-api`: all 20 existing tests pass (6 in
`health_metrics_test.rs`, 14 in `viz_routes_test.rs`); no tests exist today
for `canvas_routes.rs`/`auth.rs`, so per the task spec I did a full manual
verification instead of adding a test suite for this phase.

### Manual verification — ran the real server locally

Started `allternit-api` against a scratch SQLite DB (`ALLTERNIT_DATA_DIR`
pointed at a throwaway dir) with `ALLTERNIT_LOCAL_DEV_BYPASS=true` and
`ALLTERNIT_CLOUD_API_URL` pointed at a tiny local mock of
`POST /api/v1/runtime-devices/verify-token` (a Python `http.server` script
that returns `{"userId": "device-owner-user-1"}` only for the exact token
`allternit_runtime_validtoken123`, else 401) — this is the one piece Phase 1
can't reach without a real cloud-api instance, so it's mocked at exactly the
introspection boundary `verify_runtime_device_token` calls.

Startup log confirms V33 applied cleanly alongside the other 32:

```
INFO refinery_core::traits::sync: applying migration: V32__agent_runs ...
INFO refinery_core::traits::sync: applying migration: V33__agent_canvas_artifact_key ...
INFO allternit_api::db: SQLite DB ready at .../data/allternit.db
```

**Upsert-by-key, same id, version increments:**

```
$ curl -s -X POST http://127.0.0.1:8097/api/v1/agent-sessions/$SID/canvases \
    -H "Origin: http://localhost:3000" -H "Content-Type: application/json" \
    -d '{"title":"My Artifact","components":[{"type":"html"}],"artifact_key":"weekly-report"}'
{"artifact_key":"weekly-report","id":"123546b7-ba32-4d03-ac02-74a0b18de4ad","session_id":"...","version":1}

$ curl -s -X POST http://127.0.0.1:8097/api/v1/agent-sessions/$SID/canvases \
    -H "Origin: http://localhost:3000" -H "Content-Type: application/json" \
    -d '{"title":"My Artifact v2","components":[{"type":"html","content":"updated"}],"artifact_key":"weekly-report"}'
{"artifact_key":"weekly-report","id":"123546b7-ba32-4d03-ac02-74a0b18de4ad","session_id":"...","updated_at":"2026-07-31T06:44:30.732594+00:00","version":2}

$ curl -s http://127.0.0.1:8097/api/v1/agent-sessions/$SID/canvases -H "Origin: http://localhost:3000"
{"canvases":[{"artifact_key":"weekly-report","components":[{"content":"updated","type":"html"}],... "title":"My Artifact v2", "version":2}]}
```

Same `id` both calls, `version` 1 → 2, and the list shows exactly **one**
row for that session with the second call's content — confirms the second
call updated in place rather than creating a duplicate.

**Backward compatibility — no `artifact_key` still always creates a new row:**

Two `POST`s with no `artifact_key` on the same session produced two distinct
UUIDs (`version: 1` each), and the session's canvas list grew to 3 rows
total (1 upserted + 2 keyless) — unchanged behavior for existing callers.

**Device-token auth reaches canvas routes:**

```
$ curl -s -o /dev/null -w "HTTP %{http_code}\n" \
    http://127.0.0.1:8097/api/v1/agent-sessions/no-auth-test/canvases \
    -H "Host: example.com" -H "Origin: https://example.com"
HTTP 401
{"error":"Unauthorized","message":"Missing authorization token"}

$ curl -s -X POST http://127.0.0.1:8097/api/v1/agent-sessions/device-token-session/canvases \
    -H "Host: example.com" -H "Origin: https://example.com" \
    -H "Authorization: Bearer allternit_runtime_validtoken123" \
    -H "Content-Type: application/json" \
    -d '{"title":"Via Device Token","artifact_key":"device-key-1"}'
HTTP 201
{"artifact_key":"device-key-1","id":"94783e71-...","session_id":"device-token-session","version":1}

$ curl -s -X POST http://127.0.0.1:8097/api/v1/agent-sessions/device-token-session/canvases \
    -H "Host: example.com" -H "Origin: https://example.com" \
    -H "Authorization: Bearer allternit_runtime_bogus" \
    -H "Content-Type: application/json" -d '{"title":"Bad Token"}'
HTTP 401
{"error":"unauthorized"}
```

A request with no credentials from a non-localhost origin is rejected
exactly as before (no regression on the fail-closed default). A valid device
token now authenticates and creates the canvas; an invalid one is rejected —
confirming the introspection round-trip actually gates the request rather
than being bypassed by the prefix check alone. Direct DB read confirms the
device-token-authenticated row is attributed to the *token's* resolved
identity, not any caller-asserted header:

```
$ sqlite3 .../allternit.db "SELECT id, session_id, user_id, artifact_key, version FROM agent_canvases WHERE session_id='device-token-session';"
94783e71-...|device-token-session|device-owner-user-1|device-key-1|1
```

`device-owner-user-1` is exactly the `userId` the mock introspection
endpoint returned — confirms identity resolution flows end-to-end from the
device token through to the persisted row, matching how
`verify_runtime_device_token` already resolved identity for
`mcp_proxy_internal`.

Also checked `GET /canvases/:id` and `PATCH /canvases/:id` on the
device-token-created row: both return `artifact_key`/`version`, and an
ordinary `PATCH` (no artifact-key involved) leaves `version` at 1 —
confirming `bump_version` only fires on the artifact-key redeploy path, not
on every write.

**Concurrency — 20 simultaneous redeploys of the same key, after the
race-condition fix:**

Re-ran the server fresh (new scratch DB, same mock cloud-api) and fired 20
`POST`s at the same `(session_id, artifact_key)` in parallel (`curl ... &`
× 20, then `wait`):

```
$ SID="race-test-1785480844"
$ for i in $(seq 1 20); do
    curl -s -o "/tmp/race_$i.json" -w "%{http_code}\n" -X POST \
      "http://127.0.0.1:8098/api/v1/agent-sessions/$SID/canvases" \
      -H "Content-Type: application/json" -H "Origin: http://localhost:3000" \
      -d "{\"title\":\"Race $i\",\"components\":[{\"n\":$i}],\"artifact_key\":\"race-key\"}" &
  done; wait
```

Status codes returned: one `201`, nineteen `200` — zero `500`s. Every
response carried the same `id` (`48e4d8c1-434f-429f-bbde-db87bf801866`);
the 20 `version` values returned across all responses were exactly the set
`{1..20}` with no duplicates and no gaps. Direct DB read after all 20
completed:

```
$ sqlite3 .../allternit.db "SELECT COUNT(*), id, version FROM agent_canvases WHERE session_id='$SID' AND artifact_key='race-key' GROUP BY id;"
1|48e4d8c1-434f-429f-bbde-db87bf801866|20
```

Exactly one row, final `version = 20` — confirms the atomic
`INSERT ... ON CONFLICT ... DO UPDATE` serializes correctly under real
concurrent load; no duplicate rows, no lost updates, no 500s.

Also re-confirmed the sequential and backward-compat cases still hold under
the new implementation (same-`id`/incrementing-`version` upsert, an
omitted-field redeploy resetting that field per the new full-replace
semantics — verified `components` came back `[]` after a redeploy that
omitted it — and no-`artifact_key` calls still creating distinct rows).

Test servers and the mock cloud-api were torn down after verification; all
scratch DBs were in throwaway `ALLTERNIT_DATA_DIR`s, never the real dev
database.

## For Phase 2 (gizzi-code CLI)

Call `POST /api/v1/agent-sessions/:session_id/canvases` with `artifact_key`
set to your stable slug on every publish (first publish and every redeploy)
— no separate "does it exist" check needed, the endpoint upserts. Read
`version` back from the response to know whether this was a fresh publish
(`version: 1`) or a redeploy (`version` > 1, and note the upsert-update
branch returns `200 OK` rather than `201 Created`). Auth: send the
device-token bearer (`Authorization: Bearer allternit_runtime_…`) per Eoj's
decision in the map doc — Clerk JWT and desktop-bootstrap headers keep
working too if that's ever the easier path for a given caller, but the CLI
should prefer the device-token mechanism it already has for MCP calls.

**Important**: the upsert is full-replace, not a partial patch — always send
the complete `title`/`components`/`layout`/`metadata` on every publish call,
even a redeploy. Omitting a field on a redeploy resets it to that field's
default (`components` → `[]`, `title` → `""`, `layout`/`metadata` → `null`),
it does not preserve whatever was there before. This matches how a real
publish/deploy naturally works (you always send the artifact's current full
content) — if you ever need to patch a single field of an existing canvas
without resending everything, use `PATCH /canvases/:id` by known `id`
instead, which still does field-level merge.
