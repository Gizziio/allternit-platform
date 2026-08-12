# Swarm B — Agent Runtime Foundation — Phase 1 Map

Master handoff: `/Users/joe/Desktop/allternit-parity-handoff.md`

## Scope

1. **WebSocket event fanout for beta sessions** — Add `/api/v1/beta/sessions/:id/events/ws` that streams the same event log as the existing SSE endpoint. Reuse `beta_session_events` and support resuming from `after`.

2. **Session resources** — Add a `beta_session_resources` table and API to attach named resources to a session:
   - `POST /api/v1/beta/sessions/:id/resources`
   - `GET /api/v1/beta/sessions/:id/resources`
   - `DELETE /api/v1/beta/sessions/:id/resources/:resource_id`
   Resource kinds: `github_token`, `vault_credential`, `env_var` (value stored encrypted or as a ref).

3. **User interrupt events** — Allow clients to `POST /api/v1/beta/sessions/:id/interrupt` to append a `user_interrupt` event to the stream. Reject for archived sessions.

## Known starting files
- `cmd/allternit-api/src/beta_session_routes.rs`
- `cmd/allternit-api/migrations/V36__beta_sessions.sql`
- `cmd/allternit-api/src/main.rs`

## Constraints
- Do NOT start Phase 2 work.
- Do NOT run builds, dev servers, or tests that require external services.
- Match existing repo idioms.
- Work only in `/Users/joe/Desktop/allternit-parity-p1-swarm-b`.
