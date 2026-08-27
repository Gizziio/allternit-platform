# Swarm E — Enterprise Auth & Vault — Map

This is the context map for Swarm E — Enterprise Auth & Vault. The master handoff checklist is at:
`/Users/joe/Desktop/allternit-parity-handoff.md`

## Scope for Phase 0
- Add admin-scoped API keys with RBAC in allternit-api.
- Add access-token model (create/rotate/revoke/expiration) for Codex-style CLI auth.
- Scaffold `AllternitVault` for OAuth-based credentials scoped to agent/session.
- Integrate authn/authz checks into the gateway idempotency middleware path.

## Known starting files
- `cmd/allternit-api/src/auth.rs`
- `cmd/allternit-api/src/main.rs`

## Constraints
- Do NOT start Phase 1 work yet.
- Do NOT run builds, dev servers, or tests that require external services.
- Match existing repo idioms (naming, module structure, error handling).
- Do NOT mutate the canonical repo; work only in `/Users/joe/Desktop/allternit-parity-swarm-e`.
