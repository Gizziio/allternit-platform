# Session cu5-approvals — product-scoped approvals bound to action hashes

- Date: 2026-09-08 (swarm session, orchestrated by Kimi Code goal run)
- Branch: session/cu5-approvals → PR #144 → merge a6bb0a6df

## What was done
Per decision D2 (approvals belong to the Allternit Computer Use product, spanning all engines, not CUA-only):

- New `cmd/allternit-api/src/aci_approvals.rs`: canonical-JSON SHA-256 action hashing; global grant store — grants bound to action-payload hash, single-use (redeem consumes), expiring (TTL default 300s), every redemption attempt recorded as a receipt.
- `aci_safety.rs`: `ConfirmationClass` taxonomy (reversible/risky/irreversible) + classifiers + `enforce_confirmation` as the ONE policy gate for all entry routes.
- Enforcement wired across: ACU loop (retry redeems grant; mismatch/expired/consumed/denied → 403 `approval_denied`; handoff approve/deny mirror into grants), direct computer tool (`computer_control.rs`), REST computer routes (`computer_routes.rs`), tool routes (`tool_routes.rs`).
- TS client `approvals.ts`/`canonical.ts` documented as UX pre-filter only; docs/public/aci/index.md gained "Server-side approvals" section.

## Verification
cargo check clean; cargo test aci 26 passed, computer_control 7 passed; full allternit-api 698 passed / 4 failed (all pre-existing: agent_cloud_routes spawn a stale external binary, module untouched by this PR); sdk/computer-use tsc clean + 98/98 tests.

## Honest deferrals / incidents
- Grants route-scoped by design (descriptor embeds route) — ACU-loop grant not replayable on /tools/execute (documented).
- Process-global grant store chosen over AppState field to avoid churning ~20 literal test constructors.
- Bot-desktop's own surface untouched per brief.
