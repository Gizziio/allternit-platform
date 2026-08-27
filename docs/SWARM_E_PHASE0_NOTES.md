---
status: done
files_changed:
  - .steering/checkpoint.md
  - cmd/allternit-api/migrations/V36__enterprise_auth_and_vault.sql
  - cmd/allternit-api/src/allternit_vault.rs
  - cmd/allternit-api/src/auth.rs
  - cmd/allternit-api/src/enterprise_auth.rs
  - cmd/allternit-api/src/lib.rs
  - cmd/allternit-api/src/llm_gateway/proxy.rs
  - cmd/allternit-api/src/main.rs
  - docs/SWARM_E_PHASE0_NOTES.md
deviations:
  - Builds and tests were not run because the repository instructions prohibit them unless explicitly requested.
  - The commit could not be created because the sandbox denies writes to the linked worktree index under the canonical checkout's .git directory.
remaining:
  - Add provider-specific OAuth refresh orchestration and external secret-manager adapters in Phase 1.
---

# Swarm E Phase 0 Notes

Phase 0 adds three persisted credential types without storing bearer plaintext. Organization owners and admins can create, list, and revoke organization-scoped admin API keys with explicit RBAC scopes. Users can create expiring CLI access tokens, rotate them atomically, list safe metadata, and revoke them. Both credential types authenticate through the shared API middleware, attach their verified identity and scope context, and are authorized as read or write requests before reaching protected handlers.

`AllternitVault` provides encrypted-at-rest OAuth credential storage keyed by user, provider, and agent/session scope. Its protected API supports scoped upsert and revocation, while the service API provides retrieval for later connector/runtime integration. Enterprise credentials need the corresponding `vault:write` scope to mutate vault data.

The LLM gateway idempotency lookup and stale-row deletion are now bound to the already-authenticated virtual key. A caller cannot replay another key's stored response by presenting the same idempotency value.

No external-service behavior was introduced. The only delivery blocker is repository metadata access: `git add` cannot create the linked-worktree `index.lock` because the canonical checkout's `.git` directory is read-only in this session. The changes remain ready to stage and commit on `ao/swarm-e`. Phase 1 should add OAuth refresh-token lifecycle orchestration, provider adapters, audit events, and optional external KMS/secret-manager backends around the vault boundary.
