---
status: done
files_changed:
  - .steering/checkpoint.md
  - cmd/allternit-api/migrations/V37__beta_session_resources.sql
  - cmd/allternit-api/src/beta_session_routes.rs
  - docs/SWARM_B_PHASE1_NOTES.md
deviations: []
remaining: []
---

# Swarm B Phase 1 Notes

Phase 1 adds WebSocket fanout at `GET /api/v1/beta/sessions/:id/events/ws`. The connection is authorized before upgrade, reads the same ordered `beta_session_events` log as SSE, accepts the same `after` cursor, and continues polling for new events after replay.

Named session resources now support create, list, and delete operations. A resource accepts one of `github_token`, `vault_credential`, or `env_var` and exactly one inline `value` or opaque `ref`. Inline values require and use the API's existing platform-key encryption boundary at rest; list responses expose metadata and refs but never stored values.

Clients can append a reserved `user_interrupt` event through `POST /api/v1/beta/sessions/:id/interrupt`. Archived sessions are rejected, including a transaction-time status recheck to close the race with archival.

The existing beta-session unit-test module now checks the allowed resource-kind contract. Builds and tests were not run because the repository instructions prohibit builds/typechecks/dev servers during task work and the Phase 1 map prohibits tests requiring external services. Static formatting and `git diff --check` were used instead.

There were no implementation blockers. Phase 2 work remains intentionally untouched.
