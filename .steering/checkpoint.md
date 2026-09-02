# Steering checkpoint

## Allternit Cloud: Phase 4 billing loop + Phase 5 capacity + Phase 6 convergence (2026-09-02)

### Goal
Make the paid billing loop production-quality in cmd/allternit-cloud-api
(Stripe → credits → provision → meter → deduct → auto-stop), then AllternitOS
convergence coordination, then multi-tenant VPS capacity planning.

### Just did
- Billing loop fixes (all in cmd/allternit-cloud-api): atomic+idempotent+ledgered
  credit deduction keyed by usage-session id (repeated stops can't double-charge);
  spend-cap = balance minus open-session accrued cost (no double-count);
  wake-on-demand now enforces spend-cap/hours; Stripe checkout.session.completed/
  invoice.paid grant credits via metadata (clerk_user_id + allternit_credits_usd,
  idempotent by stripe event id); new GET /api/v1/billing/credits endpoint;
  mirror_ws MAX→GREATEST. 83/83 lib tests + e2e_billing_paid_loop PASS on mail.
- Found + fixed prod schema drift (root-caused several live 60s-loop errors):
  26 int→bigint + 27 real→float8 columns (migrations_pg/002_widen_int_to_bigint.sql,
  applied to prod, replicates to standby via WAL); SUM(int8)→NUMERIC decode
  failures fixed with ::BIGINT / ::DOUBLE PRECISION casts; SQLite 2-arg MAX()
  → GREATEST (was silently zeroing hosted usage accounting on PG).
- Prod deploy on mail: new binary live, FLY_* vars stripped from .env,
  /api/v1/health healthy.
- Phase 6: wrote AllternitOS/docs/coordination/cloud-backend-status-2026-09-02.md
  (supersedes Hetzner-era handoff; flags two-ledger question, standby dual-use).
- Phase 5: wrote docs/Operations/CAPACITY_PLAN.md (~6-13x gross margin per
  Contabo VPS 8, scaling triggers, add-node SOP, node-selection gap).

### Next
- Verify zero-error reconcile loop after final redeploy, then commit + push.
- Phase 5.5 (future): node selection in ContaboRuntimeService so the third VPS
  can carry workloads (today everything lands on mail).

### Open questions
- Stripe live $1-scale test needs a price/checkout carrying the metadata
  contract (clerk_user_id, allternit_credits_usd) — user action in Stripe
  dashboard.
- One-ledger decision: cloud-api user_credits vs allternit-api UsageEvent
  reconciliation (raised in the AllternitOS coordination note).
