# Attestation — session/cu25-migrationfix (refinery version collision fix)

**Date:** 2026-09-13, 16:15 local
**Agent:** kimi-code (orchestrator first-person, inline session)
**PR:** #484 — merged as `3ef291d80` (squash of `8d7c7ea82`)

## What shipped

Renumbered three cowork-line migrations to clear a version collision that was
failing every fresh-DB test building full app state:

- `V142__cowork_runs_ownership.sql` → `V168__` (collided with `V142__runtime_settings.sql`)
- `V143__cowork_approvals.sql` → `V169__` (collided with `V143__agent_hardening.sql`)
- `V144__cowork_approvals_decision.sql` → `V170__` (collided with `V144__deployment_run_triggered_by.sql`)

Content untouched (idempotent DDL); pure renames. Root cause: commit
`0fd578c8b` (cowork auth-scoping line) picked versions already in use; CI does
not run the cargo suites (gitleaks/vitest/typecheck/Cloudflare only), so the
collision reached main undetected between PR #474 and #480.

## Verification evidence (first-hand)

- Pre-fix main: `aci_batch` 20 passed / **9 failed** (`http_*` + 3 adversarial
  pipeline cases), all panicking at `RailsState::new` with
  `UNIQUE constraint failed: refinery_schema_history.version`; reproduced in
  isolation on a fresh per-test temp DB → ruled out test pollution.
- Same test at pre-collision commit `6a4bd66c4`: **passes** → bisected to the
  cowork merges, not cu24's diff (which touches no migration/rails code).
- Post-fix on branch: `aci_batch` **29/29**, `aci_batch_adversarial` **9/9**
  (35 attack cases), `aci_code` **17/17**; duplicate-version scan of
  `migrations/` → 0.
- GitHub Actions: green (Vercel fails = account-wide build rate limit,
  pre-existing).

## Notes / follow-ups

- Flagged on the PR: CI gap — the cargo aci suites that would have caught
  this are not in the check set. Suggest a follow-up to add a fast migration
  lint (duplicate-version scan is O(seconds)) to CI.
- Existing deployments that already applied the cowork DDL under the old
  version numbers: the migrations are idempotent (`CREATE TABLE IF NOT
  EXISTS` class), so re-application under the new numbers is a no-op.
