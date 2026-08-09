# Memory Stores API

A memory store is a named, user-scoped container that agents read from and write long-term memory into. This scaffold owns the store record and its `redaction_policy`. Reading and writing actual memory contents through a store is out of scope for this slice.

All routes are nested under `/api/v1/beta/memory-stores`.

> Base URL: `http://localhost:8013/api/v1`  
> Auth: `Authorization: Bearer <clerk_jwt>`

---

## Create a memory store

`POST /beta/memory-stores`

### Request body

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | yes | Unique name for this user. |
| `redaction_policy` | object | no | Policy applied before content is persisted or surfaced. Defaults to `{}`. |
| `metadata` | object | no | Arbitrary key/value object. Defaults to `{}`. |

### Example

```bash
curl -X POST http://localhost:8013/api/v1/beta/memory-stores \
  -H "Authorization: Bearer $CLERK_JWT" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "support-knowledge-base",
    "redaction_policy": {"pii": true, "mask_credit_cards": true},
    "metadata": {"domain": "support", "team": "success"}
  }'
```

### Response

```json
{
  "memory_store": {
    "id": "mem_01J3X8X8X8X8X8X8X8X8X8X8",
    "organization_id": "org_123",
    "name": "support-knowledge-base",
    "redaction_policy": {"pii": true, "mask_credit_cards": true},
    "metadata": {"domain": "support", "team": "success"},
    "created_at": "2026-08-09T09:30:00Z",
    "updated_at": "2026-08-09T09:30:00Z"
  },
  "id": "mem_01J3X8X8X8X8X8X8X8X8X8X8"
}
```

Duplicate names for the same user return `400 Bad Request`.

---

## List memory stores

`GET /beta/memory-stores`

Returns the caller's stores, newest first.

### Example

```bash
curl http://localhost:8013/api/v1/beta/memory-stores \
  -H "Authorization: Bearer $CLERK_JWT"
```

### Response

```json
{
  "memory_stores": [
    {
      "id": "mem_01J3X8X8X8X8X8X8X8X8X8X8",
      "organization_id": "org_123",
      "name": "support-knowledge-base",
      "redaction_policy": {"pii": true},
      "metadata": {"domain": "support"},
      "created_at": "2026-08-09T09:30:00Z",
      "updated_at": "2026-08-09T09:30:00Z"
    }
  ]
}
```

---

## Get a memory store

`GET /beta/memory-stores/:id`

### Example

```bash
curl http://localhost:8013/api/v1/beta/memory-stores/mem_01J3X8X8X8X8X8X8X8X8X8X8 \
  -H "Authorization: Bearer $CLERK_JWT"
```

---

## Delete a memory store

`DELETE /beta/memory-stores/:id`

### Example

```bash
curl -X DELETE http://localhost:8013/api/v1/beta/memory-stores/mem_01J3X8X8X8X8X8X8X8X8X8X8 \
  -H "Authorization: Bearer $CLERK_JWT"
```

Returns `204 No Content` on success.

---

## Redaction policy

`redaction_policy` is an opaque JSON object interpreted by the agent runtime and memory layer. The scaffold persists and returns it unchanged. A common shape is:

```json
{
  "pii": true,
  "mask_credit_cards": true,
  "mask_emails": false,
  "allowed_entities": ["customer_id", "ticket_id"]
}
```

Content read/write APIs and memory versioning are not yet exposed through this endpoint.

---

## Status codes

| Status | Meaning |
|--------|---------|
| 201 | Memory store created. |
| 200 | List/get succeeded. |
| 204 | Memory store deleted. |
| 400 | Missing name, or `redaction_policy`/`metadata` is not an object, or duplicate name. |
| 404 | Memory store not found or not owned by caller. |
