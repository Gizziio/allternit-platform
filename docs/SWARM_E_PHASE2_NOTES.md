---
status: done
files_changed:
  - cmd/allternit-api/migrations/V41__admin_workspaces.sql
  - cmd/allternit-api/migrations/V42__rbac_roles_and_groups.sql
  - cmd/allternit-api/migrations/V43__external_keys.sql
  - cmd/allternit-api/src/admin_workspace_routes.rs
  - cmd/allternit-api/src/rbac_routes.rs
  - cmd/allternit-api/src/external_keys_routes.rs
  - cmd/allternit-api/src/rbac.rs
  - cmd/allternit-api/src/lib.rs
  - cmd/allternit-api/src/main.rs
  - docs/SWARM_E_PHASE2_MAP.md
  - docs/SWARM_E_PHASE2_TASK.md
deviations:
  - Kept migration versions V41-V43 as instructed even though they may conflict with Swarm B; the parent agent will resolve the merge.
remaining:
  - Real cloud-provider validation for external keys (DescribeKey/GetKey/GetCryptoKey) is a Phase 3 follow-on; the validate endpoint currently flips status locally.
  - Fine-grained RBAC permission enforcement beyond the coarse owner/admin/member tier is not yet wired into route guards.
  - Audit logging for admin workspace, RBAC, and external key mutations is not implemented.
---

# Swarm E — Enterprise Auth & Vault — Phase 2 Notes

## What changed

This worktree now contains the complete Swarm E Phase 2 implementation for the
enterprise control-plane surface:

1. **Admin workspaces API** (`cmd/allternit-api/src/admin_workspace_routes.rs`)
   - `POST|GET /api/v1/admin/workspaces`
   - `GET|PUT|DELETE /api/v1/admin/workspaces/:id`
   - `GET|POST /api/v1/admin/workspaces/:id/members`
   - `PUT|DELETE /api/v1/admin/workspaces/:id/members/:member_id`
   - Roles: `owner`, `admin`, `member`.

2. **RBAC roles and groups API** (`cmd/allternit-api/src/rbac_routes.rs`)
   - `POST|GET /api/v1/admin/rbac_roles` and `GET|PUT|DELETE /api/v1/admin/rbac_roles/:id`
   - `POST|GET /api/v1/admin/rbac_groups` and `GET|PUT|DELETE /api/v1/admin/rbac_groups/:id`
   - `GET|POST /api/v1/admin/rbac_groups/:id/members`
   - `DELETE /api/v1/admin/rbac_groups/:id/members/:user_id`

3. **External keys API (BYO KMS scaffold)** (`cmd/allternit-api/src/external_keys_routes.rs`)
   - `POST|GET /api/v1/admin/external-keys`
   - `GET|PUT|DELETE /api/v1/admin/external-keys/:id`
   - `POST /api/v1/admin/external-keys/:id/validate`
   - Supports `aws`, `azure`, `gcp` providers and stores ARN/key ID plus validation status.

4. **Database migrations** (`cmd/allternit-api/migrations/V41__*.sql` through `V43__*.sql`)
   - New tables: `admin_workspaces`, `admin_workspace_members`, `rbac_roles`,
     `rbac_groups`, `rbac_group_roles`, `rbac_group_members`, `external_keys`.

5. **Wiring** (`cmd/allternit-api/src/lib.rs`, `cmd/allternit-api/src/main.rs`)
   - Declared the new route modules and merged their routers into the `/api/v1`
     protected router.

6. **Tests**
   - Extended `rbac.rs` with unit tests for `is_admin_role` and `is_org_admin`.
   - Added DB-backed round-trip and authorization tests to
     `admin_workspace_routes.rs`, `rbac_routes.rs`, and `external_keys_routes.rs`.

## Verification

- `cargo check -p allternit-api` — finished with only pre-existing warnings.
- `cargo test -p allternit-api --lib` — **146 passed, 0 failed**.

## Blockers

No blockers. All offline tests pass. The only known coordination point is the
migration version overlap with Swarm B, which the parent agent will handle.

## What remains for Phase 3

- Replace the scaffold `validate` endpoint with real cloud-provider KMS calls
  (assume-role + `DescribeKey` / `GetKey` / `GetCryptoKey`).
- Enforce the fine-grained permissions stored in `rbac_roles` beyond the current
  owner/admin/member gating.
- Add audit logging for workspace, RBAC, and external-key mutations.
