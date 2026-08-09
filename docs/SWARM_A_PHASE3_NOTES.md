---
status: done
files_changed:
  - cmd/allternit-api/migrations/V48__idempotency_and_rate_limits.sql
  - cmd/allternit-api/src/idempotency.rs
  - cmd/allternit-api/src/rate_limit.rs
  - cmd/allternit-api/src/lib.rs
  - cmd/allternit-api/src/main.rs
  - cmd/allternit-api/Cargo.toml
  - Cargo.lock
deviations:
  - Rate-limit enforcement uses an in-memory process-wide sliding window; a distributed/shared backend is Phase 4.
  - Idempotency cache is SQLite-backed and scoped to the public API router only.
remaining:
  - Wire idempotency middleware into the LLM gateway as well.
  - Expose rate-limit overrides via admin API/UI.
---

# Swarm A — Phase 3 Notes

## What changed

1. **Idempotency keys** — `cmd/allternit-api/src/idempotency.rs`
   - Middleware honors `Idempotency-Key` on POST/PUT/PATCH.
   - SQLite cache table scoped by organization/user + key.
   - Replays completed responses, returns `409 Conflict` for in-flight duplicates, expires stale rows.
   - Mounted on the protected public API router in `main.rs`.

2. **Rate-limit enforcement** — `cmd/allternit-api/src/rate_limit.rs`
   - In-memory sliding-window limiter keyed by organization/user.
   - Reads override from `organizations.api_rate_limit_rpm` or uses default 600 RPM.
   - Returns `429 Too Many Requests` with `Retry-After` header.
   - Mounted on the protected public API router.

3. **Migrations** — `V48__idempotency_and_rate_limits.sql`.

4. **Dependencies** — added `tempfile` to dev-dependencies for route tests.

## Verification

- `cargo check -p allternit-api` — pass.
- `cargo test -p allternit-api --lib` — **190 passed; 0 failed**.

## Blockers

None.
