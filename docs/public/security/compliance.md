# Compliance

The compliance API gives organization admins visibility and control over user-generated content: chats, projects, and artifacts. It supports export/delete requests and direct per-app listing and deletion.

## Authentication

Organization owner or admin only.

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/v1/admin/compliance/activity` | List export/delete requests |
| `POST` | `/api/v1/admin/compliance/requests` | Create an export or delete request |
| `GET` | `/api/v1/admin/compliance/requests/:id` | Get request details with references |
| `GET` | `/api/v1/admin/compliance/chats` | List organization-visible chats |
| `DELETE` | `/api/v1/admin/compliance/chats?id=:id` | Delete a chat and its messages |
| `GET` | `/api/v1/admin/compliance/projects` | List organization-visible projects |
| `DELETE` | `/api/v1/admin/compliance/projects?id=:id` | Delete a project and its files |
| `GET` | `/api/v1/admin/compliance/artifacts` | List organization-visible artifacts |
| `DELETE` | `/api/v1/admin/compliance/artifacts?id=:id` | Delete an artifact and its revisions |

## Request kinds and apps

| `kind` | Meaning |
|--------|---------|
| `export` | Request a snapshot of selected app data |
| `delete` | Request deletion of selected app data |

| `app_filters` value | Scope |
|---------------------|-------|
| `chats` | `conversations` + `conversation_messages` + `replies` |
| `projects` | `cowork_projects` + `cowork_project_files` |
| `artifacts` | `artifacts` + `artifact_sections` + `artifact_revisions` |

If `app_filters` is omitted, the request covers all three apps.

## Create a compliance request

```bash
curl -s -X POST "${ALLTERNIT_API_URL}/api/v1/admin/compliance/requests" \
  -H "Authorization: Bearer ${CLERK_JWT}" \
  -H "Content-Type: application/json" \
  -d '{
    "kind": "export",
    "app_filters": ["chats", "projects"]
  }'
```

```json
{
  "id": "req_01J8Z...",
  "kind": "export",
  "status": "running",
  "requested_by": "user_123",
  "created_at": "2026-08-09T09:00:00Z",
  "updated_at": "2026-08-09T09:00:00Z"
}
```

The request enumerates organization-visible records as `compliance_content_references` rows and transitions to `running`. Full export packaging is follow-on work; the reference list is the scaffold output today.

## Get request details

```bash
curl -s "${ALLTERNIT_API_URL}/api/v1/admin/compliance/requests/req_01J8Z..." \
  -H "Authorization: Bearer ${CLERK_JWT}"
```

```json
{
  "request": {
    "id": "req_01J8Z...",
    "kind": "export",
    "status": "running",
    "requested_by": "user_123",
    "created_at": "2026-08-09T09:00:00Z",
    "updated_at": "2026-08-09T09:00:00Z"
  },
  "references": [
    {
      "id": "ref_01J8Z...",
      "app": "chats",
      "record_id": "conv_123",
      "status": "pending",
      "processed_at": null,
      "created_at": "2026-08-09T09:00:00Z"
    }
  ]
}
```

## List app records

```bash
curl -s "${ALLTERNIT_API_URL}/api/v1/admin/compliance/chats?limit=10&offset=0" \
  -H "Authorization: Bearer ${CLERK_JWT}"
```

```json
{
  "app": "chats",
  "records": [
    {
      "id": "conv_123",
      "title": "Q3 planning",
      "owner_id": "user_456",
      "created_at": "2026-08-01T12:00:00Z"
    }
  ],
  "total": 42,
  "limit": 10,
  "offset": 0
}
```

## Delete a record

```bash
curl -s -X DELETE "${ALLTERNIT_API_URL}/api/v1/admin/compliance/chats?id=conv_123" \
  -H "Authorization: Bearer ${CLERK_JWT}"
```

Deletion cascades to child tables (messages/replies for chats, files for projects, sections/revisions for artifacts). Records are scoped by organization membership, so a record outside the admin's organization returns `404`.

## Data retention overview

| Data class | Storage | Retention control |
|------------|---------|-------------------|
| Chat history | SQLite (`conversations`, `conversation_messages`) | Delete via compliance endpoints or per-conversation delete |
| Projects | SQLite (`cowork_projects`, `cowork_project_files`) | Delete via compliance endpoints |
| Artifacts | SQLite (`artifacts`, `artifact_revisions`) | Delete via compliance endpoints |
| Vault credentials | SQLite (`allternit_vault_credentials`) | Encrypted at rest; revoke via vault endpoints |
| Audit events | SQLite (`audit_events`) | Append-only; retention policy is deployment-specific |

## Error codes

| Code | HTTP | Meaning |
|------|------|---------|
| `insufficient_role` | 403 | Caller is not an organization owner/admin |
| `invalid_kind` | 400 | `kind` is not `export` or `delete` |
| `request_not_found` / `record_not_found` | 404 | Resource missing or not in this organization |
