# Swarm E — Enterprise Auth & Vault — Phase 1 Map

Master handoff: `/Users/joe/Desktop/allternit-parity-handoff.md`

## Scope

1. **Vaults API** — Promote `AllternitVault` to a full `beta/vaults` resource:
   - `POST /api/v1/beta/vaults`
   - `GET /api/v1/beta/vaults`
   - `GET /api/v1/beta/vaults/:id`
   - `DELETE /api/v1/beta/vaults/:id`
   - `POST /api/v1/beta/vaults/:id/credentials`
   - `GET /api/v1/beta/vaults/:id/credentials`
   - `DELETE /api/v1/beta/vaults/:id/credentials/:credential_id`
   Keep the existing encrypted OAuth credential storage; add vault metadata and scope credentials by vault.

2. **Inference hooks scaffold** — Add pre/post-inference HTTP hook configuration and middleware in `cmd/allternit-api/src/llm_gateway/`:
   - Configurable `pre_inference_url` and `post_inference_url` per organization.
   - On each LLM request, POST the request body to `pre_inference_url`; abort on non-2xx if configured.
   - After response, POST response metadata to `post_inference_url` (async, best-effort).

3. **Scope enforcement for enterprise endpoints** — Ensure admin API keys and access tokens require the correct scopes (`api:read`, `api:write`, `vault:read`, `vault:write`) and that `CredentialContext.allows_request` is used on the new vault routes.

## Known starting files
- `cmd/allternit-api/src/enterprise_auth.rs`
- `cmd/allternit-api/src/allternit_vault.rs`
- `cmd/allternit-api/src/llm_gateway/proxy.rs`
- `cmd/allternit-api/src/auth.rs`
- `cmd/allternit-api/src/main.rs`

## Constraints
- Do NOT start Phase 2 work.
- Do NOT run builds, dev servers, or tests that require external services.
- Match existing repo idioms.
- Work only in `/Users/joe/Desktop/allternit-parity-p1-swarm-e`.
