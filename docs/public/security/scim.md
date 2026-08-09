# SCIM v2 Provisioning

Allternit exposes a SCIM v2 scaffold for user and group provisioning. The endpoints follow the core SCIM schema shape and map SCIM users/groups to the internal `rbac_roles` and `rbac_groups` tables by name.

## Authentication

Organization owner or admin only.

## Endpoints

### Users

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/v1/scim/v2/Users` | Create a user |
| `GET` | `/api/v1/scim/v2/Users` | List users |
| `GET` | `/api/v1/scim/v2/Users/:id` | Get a user |
| `PUT` | `/api/v1/scim/v2/Users/:id` | Replace a user |
| `PATCH` | `/api/v1/scim/v2/Users/:id` | Patch a user (active toggle) |
| `DELETE` | `/api/v1/scim/v2/Users/:id` | Delete a user |

### Groups

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/v1/scim/v2/Groups` | Create a group |
| `GET` | `/api/v1/scim/v2/Groups` | List groups |
| `GET` | `/api/v1/scim/v2/Groups/:id` | Get a group |
| `PUT` | `/api/v1/scim/v2/Groups/:id` | Replace a group |
| `DELETE` | `/api/v1/scim/v2/Groups/:id` | Delete a group |

## User role mapping

The first SCIM `role` maps to the organization tier:

| SCIM role | Organization role |
|-----------|-------------------|
| `owner` | `owner` |
| `admin` / `administrator` | `admin` |
| anything else or absent | `member` |

Additional roles whose `display` or `value` matches an `rbac_roles.name` in the organization are linked via `scim_user_rbac_role_mappings`.

## Group mapping

A SCIM group whose `displayName` matches an `rbac_groups.name` is linked via `scim_group_rbac_group_mappings`. Group members are stored in `scim_group_members`.

## Create a SCIM user

```bash
curl -s -X POST "${ALLTERNIT_API_URL}/api/v1/scim/v2/Users" \
  -H "Authorization: Bearer ${CLERK_JWT}" \
  -H "Content-Type: application/json" \
  -d '{
    "schemas": ["urn:ietf:params:scim:schemas:core:2.0:User"],
    "externalId": "alice@example.com",
    "userName": "alice",
    "name": { "givenName": "Alice", "familyName": "Anderson" },
    "emails": [{ "value": "alice@example.com", "primary": true }],
    "active": true,
    "roles": [{ "value": "role_01J8Z...", "display": "Agent Reader" }]
  }'
```

```json
{
  "schemas": ["urn:ietf:params:scim:schemas:core:2.0:User"],
  "id": "scim_user_01J8Z...",
  "externalId": "alice@example.com",
  "userName": "alice",
  "name": { "givenName": "Alice", "familyName": "Anderson" },
  "emails": [{ "value": "alice@example.com", "primary": true, "type": "work" }],
  "active": true,
  "roles": [{ "value": "role_01J8Z..." }],
  "meta": {
    "resourceType": "User",
    "created": "2026-08-09T09:00:00Z",
    "lastModified": "2026-08-09T09:00:00Z"
  }
}
```

## Create a SCIM group

```bash
curl -s -X POST "${ALLTERNIT_API_URL}/api/v1/scim/v2/Groups" \
  -H "Authorization: Bearer ${CLERK_JWT}" \
  -H "Content-Type: application/json" \
  -d '{
    "schemas": ["urn:ietf:params:scim:schemas:core:2.0:Group"],
    "externalId": "eng-group",
    "displayName": "Engineering",
    "members": [{ "value": "scim_user_01J8Z...", "type": "User" }]
  }'
```

```json
{
  "schemas": ["urn:ietf:params:scim:schemas:core:2.0:Group"],
  "id": "scim_group_01J8Z...",
  "externalId": "eng-group",
  "displayName": "Engineering",
  "members": [{ "value": "scim_user_01J8Z...", "type": "User" }],
  "meta": {
    "resourceType": "Group",
    "created": "2026-08-09T09:00:00Z",
    "lastModified": "2026-08-09T09:00:00Z"
  }
}
```

## List users

```bash
curl -s "${ALLTERNIT_API_URL}/api/v1/scim/v2/Users?startIndex=1&count=50" \
  -H "Authorization: Bearer ${CLERK_JWT}"
```

```json
{
  "schemas": ["urn:ietf:params:scim:api:messages:2.0:ListResponse"],
  "totalResults": 1,
  "startIndex": 1,
  "itemsPerPage": 1,
  "Resources": [{ ... }]
}
```

## Deactivate a user

```bash
curl -s -X PATCH "${ALLTERNIT_API_URL}/api/v1/scim/v2/Users/scim_user_01J8Z..." \
  -H "Authorization: Bearer ${CLERK_JWT}" \
  -H "Content-Type: application/json" \
  -d '{"active": false}'
```

## Scope notes

The current SCIM implementation is a scaffold. Full protocol details such as complex filtering, patch operations beyond `active`, ETags, and bulk operations are follow-on work. The existing endpoints are sufficient for IdPs that push users and groups via `POST`/`PUT` and deactivate users via `PATCH`.
