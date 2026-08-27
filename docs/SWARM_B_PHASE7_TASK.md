# Swarm B — Phase 7 Task

**Worktree:** `/Users/joe/Desktop/allternit-parity-p2-swarm-b`  
**Branch:** `ao/p7-b`  
**Base:** `parity/swarm-sprint`

## Goal
Add event push webhooks for sessions and deployments.

## Deliverables

1. **Webhook subscriptions API**
   - Add `webhook_subscriptions` table with `id`, `org_id`, `url`, `events` (JSON array), `secret`, `active`, `created_at`.
   - Add migration `V61__webhooks.sql`.
   - Add `POST /beta/webhooks`, `GET /beta/webhooks`, `GET /beta/webhooks/:id`, `PATCH /beta/webhooks/:id`, `DELETE /beta/webhooks/:id`.

2. **Webhook delivery**
   - In `append_event` for sessions and deployment run updates, look up matching active webhook subscriptions and POST a JSON payload to each URL.
   - Sign payloads with HMAC-SHA256 using the subscription secret (`X-Allternit-Signature`).
   - Store delivery attempts in a `webhook_deliveries` table for retries.

3. **Tests**
   - Add Rust tests for CRUD and signed delivery.

## Validation
- `cargo check -p allternit-api` — pass
- `cargo test -p allternit-api --lib` — pass

## Commit
Commit on `ao/p7-b` with message: `feat(p7): Swarm B webhook subscriptions and delivery`.
