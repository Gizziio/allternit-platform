# RBAC Roles and Groups

Fine-grained access control for organizations. An RBAC **role** is a named list of permissions. An RBAC **group** is a named bundle of roles. Users are assigned to groups, and SCIM-provisioned users can be mapped to roles by name.

## Authentication

All endpoints require an organization owner or admin. The coarse tier check (`rbac::is_org_admin`) is layered underneath; role permissions are not yet enforced as a middleware gate in this phase.

## Endpoints

### Roles

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/v1/admin/rbac_roles` | Create a role |
| `GET` | `/api/v1/admin/rbac_roles` | List roles |
| `GET` | `/api/v1/admin/rbac_roles/:id` | Get a role |
| `PUT` | `/api/v1/admin/rbac_roles/:id` | Update a role |
| `DELETE` | `/api/v1/admin/rbac_roles/:id` | Delete a role |

### Groups

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/v1/admin/rbac_groups` | Create a group |
| `GET` | `/api/v1/admin/rbac_groups` | List groups |
| `GET` | `/api/v1/admin/rbac_groups/:id` | Get a group |
| `PUT` | `/api/v1/admin/rbac_groups/:id` | Update a group |
| `DELETE` | `/api/v1/admin/rbac_groups/:id` | Delete a group |
| `GET` | `/api/v1/admin/rbac_groups/:id/members` | List group members |
| `POST` | `/api/v1/admin/rbac_groups/:id/members` | Add a member |
| `DELETE` | `/api/v1/admin/rbac_groups/:id/members/:user_id` | Remove a member |

## Role fields

| Field | Type | Notes |
|-------|------|-------|
| `id` | string | UUID |
| `name` | string | 1–128 characters |
| `permissions` | string[] | Free-form permission strings, e.g. `read:agents` |
| `created_by` | string | User ID |
| `created_at` | string | ISO 8601 timestamp |
| `updated_at` | string | ISO 8601 timestamp |

## Create a role

```bash
curl -s -X POST "${ALLTERNIT_API_URL}/api/v1/admin/rbac_roles" \
  -H "Authorization: Bearer ${CLERK_JWT}" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Agent Reader",
    "permissions": ["read:agents", "read:skills"]
  }'
```

```json
{
  "id": "role_01J8Z...",
  "name": "Agent Reader",
  "permissions": ["read:agents", "read:skills"],
  "created_by": "user_123",
  "created_at": "2026-08-09T09:00:00Z",
  "updated_at": "2026-08-09T09:00:00Z"
}
```

## Create a group with roles

```bash
curl -s -X POST "${ALLTERNIT_API_URL}/api/v1/admin/rbac_groups" \
  -H "Authorization: Bearer ${CLERK_JWT}" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Engineering",
    "role_ids": ["role_01J8Z..."]
  }'
```

```json
{
  "id": "group_01J8Z...",
  "name": "Engineering",
  "role_ids": ["role_01J8Z..."],
  "created_by": "user_123",
  "created_at": "2026-08-09T09:00:00Z",
  "updated_at": "2026-08-09T09:00:00Z"
}
```

## Manage group membership

Add a user to a group:

```bash
curl -s -X POST "${ALLTERNIT_API_URL}/api/v1/admin/rbac_groups/group_01J8Z.../members" \
  -H "Authorization: Bearer ${CLERK_JWT}" \
  -H "Content-Type: application/json" \
  -d '{"user_id": "user_456"}'
```

List members:

```bash
curl -s "${ALLTERNIT_API_URL}/api/v1/admin/rbac_groups/group_01J8Z.../members" \
  -H "Authorization: Bearer ${CLERK_JWT}"
```

```json
{
  "members": [
    {
      "id": "gm_01J8Z...",
      "user_id": "user_456",
      "created_at": "2026-08-09T09:05:00Z"
    }
  ]
}
```

Remove a member:

```bash
curl -s -X DELETE "${ALLTERNIT_API_URL}/api/v1/admin/rbac_groups/group_01J8Z.../members/user_456" \
  -H "Authorization: Bearer ${CLERK_JWT}"
```

## SCIM integration

SCIM user `roles` are matched against `rbac_roles.name`. SCIM group `displayName` is matched against `rbac_groups.name`. This lets an IdP push users and groups without knowing Allternit UUIDs.

## Error codes

| Code | HTTP | Meaning |
|------|------|---------|
| `insufficient_role` | 403 | Caller is not an organization owner/admin |
| `invalid_name` | 400 | Name is empty or longer than 128 characters |
| `invalid_permissions` | 400 | A permission string is empty |
| `invalid_role_id` | 400 | A role assigned to a group does not exist |
| `role_not_found` / `group_not_found` / `member_not_found` | 404 | Resource missing |
