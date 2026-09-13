# Session attestation — session/console-fe-p5 (2026-09-13)

**PR:** #460 (merge `829728668`) — `feat(platform-console): Phase 5 — Manage surface`
**Program:** Frontend console port, Phase 5 of 7.

## What was done

Full Manage surface in `surfaces/platform.allternit.com`, shapes confirmed against Rust handlers (citations in new lib clients):

- **Members** — Clerk org membership, admin-gated actions from orgRole, graceful not-in-org/read-only.
- **Service accounts** — CRUD+rotate over `/admin/service-accounts`, one-time client_secret reveal, comma-string scopes, no fake last-used column.
- **Spend limits** — caps + spend in cents, request/approve/reject workflow surfaced prominently, member balance card always visible, 403 → calm read-only notice.
- **Security** — real retention (`/admin/compliance/retention-policy`, found during implementation) + residency picker (`/admin/data-residency` + `/regions`); donor threat-stats skipped because its routes don't exist in this backend (grep-verified) — nothing faked.
- **Webhooks** — Subscriptions tab over `/api/v1/beta/webhooks` (12-event registry + wildcard rule, deliveries drawer) + Triggers tab (donor UX ported onto the api client; inbound URL corrected to the gateway origin — donor's window.location.origin was wrong here). 400-requires-org → honest EmptyState.
- **Tags** — over `/api/v1/tags` with the real resource_type/resource_id form shape and key/value length constraints.
- **Gateway keys tab** on ApiKeysPage (scoped tab untouched/default) — CRUD over `/api/v1/gateway/keys`, one-time reveal, PATCH null-clears, revoke.

Six stubs removed (13 → 7: gizzi/usage, manage/rate-limits relocated in Phase 4, and Cloud Agents stubs remain for Phase 6).

## Verification evidence

- tsc 0 errors; build success; preview 200 on all 7 routes; release-preflight 35/0. Parent re-verified independently.

## Honest deferrals

- Admin access-tokens UI not built (optional scope; same pattern as service accounts when wanted).
- Signed-in interactive smoke — program-wide deferral. No desktop rebuild (not desktop-bundled).
