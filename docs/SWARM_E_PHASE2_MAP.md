# Swarm E — Enterprise Auth & Vault — Phase 2 Map

Master handoff: `/Users/joe/Desktop/allternit-parity-handoff.md`

## Scope

1. **Admin workspaces API** — Add `/api/v1/admin/workspaces` CRUD with members (`/admin/workspaces/:id/members`). Workspace owners/admins can create workspaces, list members, add/remove members, and set member roles (`owner`, `admin`, `member`).

2. **RBAC groups and roles API** — Add `/api/v1/admin/rbac_roles` and `/api/v1/admin/rbac_groups` CRUD. Roles have a name and list of permissions. Groups have a name and list of role IDs. Users can be assigned to groups at `/admin/rbac_groups/:id/members`.

3. **External keys API (BYO KMS) scaffold** — Add `/api/v1/admin/external-keys` CRUD for organization-owned cloud KMS key registrations: create/list/retrieve/update/delete/validate. Store ARN/key ID, provider (`aws`, `azure`, `gcp`), and validation status.

## Known starting files
- `cmd/allternit-api/src/enterprise_auth.rs`
- `cmd/allternit-api/src/allternit_vault.rs`
- `cmd/allternit-api/src/rbac.rs`
- `cmd/allternit-api/src/main.rs`
- `cmd/allternit-api/src/lib.rs`

## Constraints
- Do NOT start Phase 3 work.
- Do NOT run builds, dev servers, or tests that require external services.
- Match existing repo idioms.
- Work only in `/Users/joe/Desktop/allternit-parity-p2-swarm-e`.
