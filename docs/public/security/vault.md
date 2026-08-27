# Vault

`AllternitVault` stores OAuth credentials and other secrets at rest using the API's token crypto layer (`token_crypto::seal` / `token_crypto::open`). Vaults are organization-scoped resources; credentials inside a vault are encrypted and can be revoked without deleting the vault.

Two surfaces exist today:

1. **Legacy agent/session credential store** — `/api/v1/vault/credentials` keyed by `user_id`, `provider`, `agent_id`, and `session_id`.
2. **Beta vault resources** — `/api/v1/beta/vaults` and `/api/v1/beta/vaults/:id/credentials`, which allow first-class vault CRUD and credential lifecycle.

## Authentication

Vault routes accept Clerk sessions or scoped enterprise credentials. Enterprise tokens must include a scope that grants the requested action:

| Scope | Grants |
|-------|--------|
| `vault:read` | `GET` on `/vault/*` and `/beta/vaults/*` |
| `vault:write` | `POST` / `DELETE` on vault routes |
| `api:read` / `api:write` | Read/write on non-vault API routes |
| `*` | Everything |

`CredentialContext.allows_request` maps `GET`/`HEAD` to `read` and mutating methods to `write`, and any path containing `/vault/` or `/vaults` to the `vault` resource.

## Endpoints

### Legacy credentials

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/v1/vault/credentials` | Store an agent/session credential |
| `DELETE` | `/api/v1/vault/credentials/:id` | Revoke a credential |

### Beta vaults

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/v1/beta/vaults` | Create a vault |
| `GET` | `/api/v1/beta/vaults` | List organization vaults |
| `GET` | `/api/v1/beta/vaults/:id` | Get a vault |
| `DELETE` | `/api/v1/beta/vaults/:id` | Delete a vault |
| `POST` | `/api/v1/beta/vaults/:id/credentials` | Store a credential in a vault |
| `GET` | `/api/v1/beta/vaults/:id/credentials` | List credentials in a vault |
| `DELETE` | `/api/v1/beta/vaults/:id/credentials/:credential_id` | Revoke a vault credential |

## Vault fields

| Field | Type | Notes |
|-------|------|-------|
| `id` | string | UUID |
| `name` | string | 1–128 characters |
| `description` | string \| null | Optional |
| `created_by` | string | User ID |
| `created_at` | string | ISO 8601 timestamp |
| `updated_at` | string | ISO 8601 timestamp |

## Create a vault

```bash
curl -s -X POST "${ALLTERNIT_API_URL}/api/v1/beta/vaults" \
  -H "Authorization: Bearer ${CLERK_JWT}" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Production OAuth",
    "description": "OAuth tokens for production agents"
  }'
```

```json
{
  "id": "vault_01J8Z...",
  "name": "Production OAuth",
  "description": "OAuth tokens for production agents"
}
```

## Store a credential in a vault

```bash
curl -s -X POST "${ALLTERNIT_API_URL}/api/v1/beta/vaults/vault_01J8Z.../credentials" \
  -H "Authorization: Bearer ${CLERK_JWT}" \
  -H "Content-Type: application/json" \
  -d '{
    "provider": "slack",
    "agent_id": "agent_123",
    "oauth_value": "xoxb-...",
    "expires_at": "2026-09-09T09:00:00Z"
  }'
```

```json
{
  "id": "cred_01J8Z...",
  "vault_id": "vault_01J8Z...",
  "provider": "slack",
  "agent_id": "agent_123",
  "session_id": null,
  "expires_at": "2026-09-09T09:00:00Z"
}
```

The plaintext `oauth_value` is sealed before it is written to `allternit_vault_credentials.encrypted_value`. The returned credential list never includes the plaintext.

## List credentials

```bash
curl -s "${ALLTERNIT_API_URL}/api/v1/beta/vaults/vault_01J8Z.../credentials" \
  -H "Authorization: Bearer ${CLERK_JWT}"
```

```json
{
  "credentials": [
    {
      "id": "cred_01J8Z...",
      "provider": "slack",
      "agent_id": "agent_123",
      "session_id": null,
      "expires_at": "2026-09-09T09:00:00Z",
      "created_at": "2026-08-09T09:00:00Z",
      "updated_at": "2026-08-09T09:00:00Z"
    }
  ]
}
```

## Revoke a credential

```bash
curl -s -X DELETE "${ALLTERNIT_API_URL}/api/v1/beta/vaults/vault_01J8Z.../credentials/cred_01J8Z..." \
  -H "Authorization: Bearer ${CLERK_JWT}"
```

Revocation sets `revoked_at` without deleting the row, preserving an audit trail.

## Legacy credential store

The `AllternitVault::put` method is still used by existing callers. It stores credentials keyed by `(user_id, provider, agent_id, session_id)` where `vault_id IS NULL` and supports upsert. Use the beta vault routes for new integrations.

## Error codes

| Code | HTTP | Meaning |
|------|------|---------|
| `organization_required` | 403 | Vaults require an active organization |
| `insufficient_scope` | 403 | Enterprise token lacks `vault:read`/`vault:write` |
| `invalid_name` | 400 | Vault name empty or longer than 128 characters |
| `invalid_request` | 400 | Missing `provider` or `oauth_value` |
| `vault_not_found` / `credential_not_found` | 404 | Resource missing |
