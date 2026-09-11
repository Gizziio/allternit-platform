# Session summary — credits-bridge (kimi-code)

> 2026-09-11 · PR #362 (merge 59222cd22) · branch `session/credits-bridge`

## What was done

PR 2 of the credits consolidation (follows PR #351, session/credits-unify).
Wires the Stripe-backed user wallet (allternit-cloud-api, Postgres) to the org
fabric credits ledger (allternit-api, SQLite) so the platform runs on one
money flow: Stripe → user wallet → explicit idempotent transfer → org ledger →
provisioning holds + metered usage.

**cloud-api**
- `POST /api/v1/internal/billing/credits/transfer` (new
  `routes/billing_transfer.rs`), gated by `ALLTERNIT_BILLING_SYNC_SECRET` like
  the entitlement sync routes. `direction=debit` / `direction=credit`
  (compensation), idempotent by `transaction_id` (also the wallet ledger row
  key; sources `fabric_transfer` / `fabric_transfer_refund`).
- `CostService::debit_credits_for_transfer`: ledger row + balance update in
  one transaction; refuses with the new `ApiError::PaymentRequired` (402)
  instead of clamping when the balance cannot cover the transfer — a clamped
  partial transfer would mint unbacked money on the remote ledger. Rolled
  back ledger row on refusal.
- Tests: debit + ledger row, idempotent replay, insufficient-refused (402,
  balance untouched, no ledger row).

**allternit-api**
- `wallet.rs`: `WalletClient` trait + `ReqwestWalletClient` (from_env via
  `cloudApiUrl` + `ALLTERNIT_BILLING_SYNC_SECRET`).
- `POST /api/v1/credits/transfer_from_wallet` (org member): wallet debit →
  local ledger credit with the same idempotency key; if the local credit
  fails after a successful debit, wallet refund with the same key
  (all-or-nothing across two ledgers, no distributed transactions).
- Tests with a fake WalletClient: happy path (wallet −$15, org +1500¢),
  insufficient (402, no local write, no refund call), ledger-failure
  compensation (debit then credit refund, same key).

**Console (platform.allternit.com)**
- BillingPage: "Organization compute credits" panel (org balance / available
  / held from `GET /api/v1/credits/balance`, amount input → transfer, live
  refresh of wallet + org balances).
- FabricPage: org compute-credits card with Top up link to /billing.
- `credits.ts`: `getOrgCreditsBalance` + `transferWalletToOrg` (gateway).

## Verification evidence

- `cargo test -p allternit-api --lib`: 920 passed; 5 failures identical to
  PR #351's verified pre-existing baseline (4× real-OS-control-plane spawn
  args, 1× rails gate).
- `cargo test -p allternit-cloud-api --lib`: 285 passed; 1 failure
  pre-existing (`contabo_runtime_service` needs a docker binary, absent here).
- `cargo build --release` both crates green (AGENTS rule 4).
- Console typecheck + vite build green; playwright smoke with mocked
  endpoints: transfer succeeded ("Transferred $15.00 to org-1"), org balance
  updated ($20.00, $18 available · $2 held), Fabric card renders.

## Incidents / deferrals

- **Deploy note:** the allternit-api/gateway deployment must set
  `ALLTERNIT_BILLING_SYNC_SECRET` to the same value as cloud-api's or
  transfers return wallet_credentials_rejected (logged, 500 to caller).
- Desktop sidecar not rebuilt locally (release-pipeline artifact), as in PR 1.
- V102 tables still present (frozen, no writers); drop after an upgrade cycle.
- Vercel checks fail account-wide (deploy rate limit) on every PR today;
  GitHub checks all green; CF Pages pending at merge (known main issue).
