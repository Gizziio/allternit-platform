# Session summary — credits-unify (kimi-code)

> 2026-09-11 · PR #351 (merge d7f1b19de) · branch `session/credits-unify`

## What was done

PR 1 of the credits consolidation (parent plan: one money flow — Stripe →
user wallet (cloud-api) → org fabric ledger; PR 2 adds the transfer bridge).
Scope: one ledger per deployment inside allternit-api.

1. **V102 folded into the fabric ledger.** `credits.rs` is now a shim over
   `fabric::credits::CreditsLedger` with unchanged public signatures, so the
   computer provisioning gate (`computer_routes.rs:706`), the internal admin
   grant route, and desktop-session consume (`bot_desktop_quotas.rs:314`) all
   move the same org balance without call-site changes. `has_minimum_balance`
   now checks spendable balance (balance − open holds). Lifetime purchased/
   consumed counters are derived from the fabric ledger. The V102 tables are
   frozen (not dropped) — no writers remain.
2. **Idempotent startup backfill** (`migrate_v102_balances`, hooked into
   main.rs after benchmark seeding): per-org idempotency keys
   (`v102-migration-{org}`), grant rows for positive legacy balances,
   overdraft charge rows for negative ones. Rerunnable on every boot.
3. **Purchase mint closed.** `POST /api/v1/credits/purchase` previously wrote
   credits with a client-supplied reference and no payment verification
   (any org member could mint balance). Now: cloud billing configured →
   `409 billing_redirect` to platform billing; self-hosted → org-admin-only
   manual settlement. `purchase_mode()` is a pure, unit-tested function.
4. **Double-billing removed.** Scheduler, fabric OS-provision, and
   agent-cloud OS-provision paths no longer `charge_hold` the one-hour
   estimate. Holds stay open for the resource lifetime (blocking
   `available_cents`) and are released on terminate (terminate_resource
   releases open holds; hardening reaper still backstops orphans).
   Model-capacity holds release immediately (capacity is billed per-token).
5. **Metered debt recorded, not dropped.** New
   `CreditsLedger::charge_overdraft`: usage-worker and model-gateway charges
   past zero write a charge row and take the balance negative (debt) instead
   of warn-and-drop. Model inference gained an explicit pre-dispatch
   spendable-balance gate (402) placed AFTER model lookup (404 wins for
   unknown models) so zero-balance users don't accrue synchronous debt.

## Verification evidence

- `cargo check -p allternit-api` clean.
- `cargo test -p allternit-api --lib`: 904 passed, 5 failed — all 5
  pre-existing on origin/main, confirmed by running the same tests on a
  stash-clean baseline in this worktree: 4× real-OS-control-plane tests
  (stale `allternitos_control_plane` binary now requires
  `--reconciler-path/--vast-provider` args the test harness doesn't pass)
  and 1× `rails::tests::gate_data_plane_round_trip`. None credits-related.
- `cargo build --release -p allternit-api` green (AGENTS rule 4).
- GitHub checks all green; Vercel checks fail with the account-level
  deploy-rate-limit state affecting every PR since earlier today;
  Cloudflare Pages check pending at merge time (known main-branch issue per
  the railpolish-0911 ledger entry).

## Incidents / honest deferrals

- Desktop sidecar not rebuilt locally — sidecar artifacts come out of the
  release pipeline; noted for the next desktop release cut.
- PR 2 (wallet→org-ledger bridge: cloud-api internal transfer endpoint,
  `/api/v1/credits/transfer_from_wallet`, console UI) is the follow-up
  session; plan file lives in the parent session plan.
- Legacy `organization_credits`/`credit_transactions` tables retained for
  audit; drop in a later release after one upgrade cycle.
- `user_credits.balance_usd` f32 seam in cloud-api untouched (PR 2 concern).
