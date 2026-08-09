# Swarm E — Enterprise / Admin — Phase 3 Map

Master handoff: `/Users/joe/Desktop/allternit-parity-handoff.md`

## Scope

1. **SCIM v2 provisioning** — Add `/api/v1/scim/v2/Users` and `/Groups` endpoints:
   - Migrations for `scim_users` and `scim_groups` tables.
   - List/create/update/delete/activate/deactivate Users.
   - List/create/update/delete Groups with member lists.
   - Map SCIM users/groups to existing `admin/rbac_roles` and `admin/rbac_groups` where appropriate.
   - Add DB-backed tests.

2. **Access Transparency audit feed** — Add `/api/v1/admin/audit` endpoint:
   - Migration for `audit_events` table (actor, action, resource, timestamp, org_id).
   - Append-only feed with cursor pagination.
   - Tests for write and list paths.

3. **Compliance API scaffold** — Add `/api/v1/admin/compliance` endpoints:
   - List compliance activity for org.
   - Retrieve/delete per-app data (chats, projects, artifacts) by org.
   - Migrations for `compliance_requests` and `compliance_content_references`.
   - DB-backed tests.

4. **CMEK AWS KMS scaffold** — Extend external keys from Phase 2:
   - Support `provider = "aws_kms"` in external keys.
   - Add KMS key ARN validation and mock encrypt/decrypt test path.

## Known starting files
- `cmd/allternit-api/src/admin_workspace_routes.rs`
- `cmd/allternit-api/src/rbac_routes.rs`
- `cmd/allternit-api/src/external_keys_routes.rs`
- `cmd/allternit-api/src/main.rs`
- `cmd/allternit-api/src/lib.rs`

## Constraints
- Do NOT start Phase 4 work.
- Do NOT run builds/dev servers/tests requiring external services.
- Match existing repo idioms.
- Work only in `/Users/joe/Desktop/allternit-parity-p2-swarm-e`.
