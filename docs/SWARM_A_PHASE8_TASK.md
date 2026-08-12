# Swarm A — Phase 8 Task

**Worktree:** `/Users/joe/Desktop/allternit-parity-p2-swarm-a`  
**Branch:** `ao/p8-a`  
**Base:** `parity/swarm-sprint`

## Goal
Add service accounts and spend-limit workflows to the admin API.

## Deliverables

1. **Service Accounts API**
   - Add `service_accounts` table with `id`, `org_id`, `name`, `client_id`, `hashed_secret`, `scopes`, `created_at`, `last_rotated_at`.
   - Add migration `V63__service_accounts.sql`.
   - Add `POST /api/v1/admin/service-accounts`, `GET /api/v1/admin/service-accounts`, `GET /api/v1/admin/service-accounts/:id`, `PATCH /api/v1/admin/service-accounts/:id`, `POST /api/v1/admin/service-accounts/:id/rotate`, `DELETE /api/v1/admin/service-accounts/:id`.
   - On creation/rotation, return a one-time `client_secret` (store only a hash).

2. **Spend Limits API**
   - Add `spend_limits` table with `org_id`, `monthly_usd_cap`, `current_month_spend`, `increase_request_status`, `increase_request_amount`, `increase_request_reason`.
   - Add migration `V64__spend_limits.sql`.
   - Add `GET /api/v1/admin/spend-limits`, `POST /api/v1/admin/spend-limits/increase-request`, `POST /api/v1/admin/spend-limits/approve` (admin only), `POST /api/v1/admin/spend-limits/reject` (admin only).
   - Add spend-check gate to LLM gateway that returns `429` with `budget_exceeded` code when cap is hit.

3. **Tests**
   - Add Rust tests for service account CRUD/rotation and spend limit approval flow.

## Validation
- `cargo check -p allternit-api` — pass
- `cargo test -p allternit-api --lib` — pass

## Commit
Commit on `ao/p8-a` with message: `feat(p8): Swarm A service accounts and spend limits`.
