# Swarm E — Phase 4 Docs / GTM Task

**Worktree:** `/Users/joe/Desktop/allternit-parity-p2-swarm-e`  
**Branch:** `ao/p4-swarm-e`  
**Base:** `parity/swarm-sprint`

## Goal
Document enterprise admin, security, compliance, vault, and self-hosting/BYOC capabilities built in Phases 0–3.

## Deliverables (all under `docs/public/` unless noted)

1. `docs/public/admin/workspaces.md` — `/api/v1/admin/workspaces` CRUD + members + rate limits.

2. `docs/public/admin/rbac.md` — `/api/v1/admin/rbac_roles` and `/api/v1/admin/rbac_groups` CRUD + membership.

3. `docs/public/admin/external-keys.md` — BYO KMS keys (`/api/v1/admin/external-keys`), AWS KMS ARN validation, Azure/GCP placeholders.

4. `docs/public/security/vault.md` — `AllternitVault` encrypted OAuth credential storage and `beta/vaults` + credentials CRUD.

5. `docs/public/security/compliance.md` — Compliance API (`/api/v1/admin/compliance/activity`, `/api/v1/admin/compliance/content`) and data-retention overview.

6. `docs/public/security/scim.md` — SCIM v2 `/Users` and `/Groups` endpoints.

7. `docs/public/security/audit.md` — Access Transparency `/admin/audit` feed.

8. `docs/public/self-hosting/byoc.md` — BYOC/self-hosting guide:
   - Local-first SQLite backend (`cmd/allternit-api`)
   - Cloud-hosted `cmd/allternit-cloud-api` on Fly.io
   - Clerk identity setup
   - Why Allternit is the open alternative to locked-in vendors

9. `docs/public/gtm/positioning.md` — GTM positioning doc:
   - "Allternit is the open, self-hostable alternative to Anthropic, OpenAI, and Kimi managed agents."
   - 1-to-1 capability table referencing competitor features and Allternit equivalents.
   - BYOC/self-host messaging.

## Validation
- `cargo check -p allternit-api` must pass.
- `cargo test -p allternit-api --lib` must still pass.
- Every doc has H1 and at least one code block or table.

## Commit
Commit on `ao/p4-swarm-e` with message: `docs(p4): Swarm E enterprise admin, security, compliance, and GTM docs`.
