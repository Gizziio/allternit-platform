---
status: done
files_changed:
  - cmd/allternit-api/migrations/V52__scim_users_and_groups.sql
  - cmd/allternit-api/migrations/V53__audit_events.sql
  - cmd/allternit-api/migrations/V54__compliance_requests.sql
  - cmd/allternit-api/migrations/V55__compliance_content_references.sql
  - cmd/allternit-api/migrations/V56__external_keys_aws_kms.sql
  - cmd/allternit-api/src/scim_routes.rs
  - cmd/allternit-api/src/admin_audit_routes.rs
  - cmd/allternit-api/src/compliance_routes.rs
  - cmd/allternit-api/src/external_keys_routes.rs
  - cmd/allternit-api/src/lib.rs
  - cmd/allternit-api/src/main.rs
deviations:
  - CMEK AWS KMS validate endpoint is a scaffold (ARN validation + local status flip); real cloud KMS calls are Phase 4.
remaining:
  - SCIM /Groups patch operations and filter query syntax.
  - Real-time audit event ingestion from other services.
  - Compliance data-retention enforcement (actual deletion jobs).
  - Azure/GCP CMEK providers.
---

# Swarm E — Phase 3 Notes

## What changed

1. **SCIM v2 provisioning** — `cmd/allternit-api/src/scim_routes.rs`
   - `/api/v1/scim/v2/Users` list/create/update/delete/activate/deactivate.
   - `/api/v1/scim/v2/Groups` list/create/update/delete with member lists.
   - Mapping tables from SCIM users/groups to existing RBAC roles/groups.
   - DB-backed tests for user and group round-trips.

2. **Access Transparency audit feed** — `cmd/allternit-api/src/admin_audit_routes.rs`
   - `audit_events` table and `/api/v1/admin/audit` cursor-paginated feed.
   - Tests for append and list.

3. **Compliance API scaffold** — `cmd/allternit-api/src/compliance_routes.rs`
   - `/api/v1/admin/compliance/activity` and `/api/v1/admin/compliance/content` endpoints.
   - Tables for compliance requests and content references.
   - DB-backed tests.

4. **CMEK AWS KMS scaffold** — `cmd/allternit-api/src/external_keys_routes.rs`
   - Added `provider = "aws_kms"` support to external keys.
   - ARN validation and mock validate path.

5. **Migrations** — V52–V56.

6. **Wiring** — modules declared in `lib.rs`, routers mounted in `main.rs`.

## Verification

- `cargo check -p allternit-api` — pass.
- `cargo test -p allternit-api --lib` — **194 passed; 0 failed**.

## Blockers

None.
