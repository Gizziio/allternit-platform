# Access Transparency Audit Feed

The audit feed is an append-only log of organization-scoped events. Admins can write events explicitly and list events with cursor-based pagination.

## Authentication

Organization owner or admin only.

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/v1/admin/audit` | Write an audit event |
| `GET` | `/api/v1/admin/audit` | List audit events |

## Event fields

| Field | Type | Notes |
|-------|------|-------|
| `id` | string | UUID |
| `actor_id` | string | User ID who performed the action |
| `action` | string | Free-form action, e.g. `user.login` |
| `resource_type` | string | Category of resource, e.g. `workspace` |
| `resource_id` | string | ID of the affected resource |
| `metadata` | object \| null | Optional JSON payload |
| `created_at` | string | ISO 8601 timestamp |

## Write an event

```bash
curl -s -X POST "${ALLTERNIT_API_URL}/api/v1/admin/audit" \
  -H "Authorization: Bearer ${CLERK_JWT}" \
  -H "Content-Type: application/json" \
  -d '{
    "action": "workspace.create",
    "resource_type": "workspace",
    "resource_id": "ws_01J8Z...",
    "metadata": { "source": "web", "ip": "203.0.113.10" }
  }'
```

```json
{
  "id": "evt_01J8Z..."
}
```

## List events

```bash
curl -s "${ALLTERNIT_API_URL}/api/v1/admin/audit?limit=50" \
  -H "Authorization: Bearer ${CLERK_JWT}"
```

```json
{
  "events": [
    {
      "id": "evt_01J8Z...",
      "actor_id": "user_123",
      "action": "workspace.create",
      "resource_type": "workspace",
      "resource_id": "ws_01J8Z...",
      "metadata": { "source": "web", "ip": "203.0.113.10" },
      "created_at": "2026-08-09T09:00:00Z"
    }
  ],
  "next_cursor": "2026-08-09T09:00:00Z|evt_01J8Z...",
  "limit": 50
}
```

## Cursor pagination

The list endpoint orders events by `created_at ASC, id ASC`. The cursor format is `created_at|id`. Pass the returned `next_cursor` to fetch the next page:

```bash
curl -s "${ALLTERNIT_API_URL}/api/v1/admin/audit?limit=50&cursor=2026-08-09T09%3A00%3A00Z%7Cevt_01J8Z..." \
  -H "Authorization: Bearer ${CLERK_JWT}"
```

`limit` defaults to 50 and is capped at 100.

## Common actions

| Action | Use case |
|--------|----------|
| `user.login` | Authentication events |
| `workspace.create` / `workspace.delete` | Workspace lifecycle |
| `rbac_role.update` | Permission changes |
| `external_key.validate` | KMS key validation |
| `vault.credential.revoke` | Secret revocation |
| `compliance.request.create` | Compliance exports/deletes |

## Error codes

| Code | HTTP | Meaning |
|------|------|---------|
| `insufficient_role` | 403 | Caller is not an organization owner/admin |
| `invalid_cursor` | 400 | Cursor is not in `created_at|id` format |
