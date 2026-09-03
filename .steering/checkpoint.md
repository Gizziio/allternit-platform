# Steering checkpoint

## Allternit Cloud: Stripe checkout live + console billing UI (2026-09-03)

### Goal
Close the paid loop UI-side: credit buying in the platform.allternit.com
cloud dashboard, Stripe fully hooked in, no real-money test required.

### Just did
- POST /api/v1/billing/checkout (Clerk-authed, creates Stripe Checkout
  sessions server-side; static pack catalog credits_10/25/50/100 1:1 USD,
  metadata clerk_user_id + allternit_credits_usd matching the webhook grant
  contract) + GET /api/v1/billing/packs (public). Deployed to mail; packs
  verified serving; 9 unit tests green.
- platform.allternit.com BillingPage: balance card, pack grid with buy
  buttons → Stripe Checkout redirect, success/cancel banners, graceful
  billing-not-configured state. Deployed to Cloudflare Pages (verified in
  live bundle).
- Stripe wiring (all via the rk_live key from macOS Keychain service
  "stripe-allternit", never printed): checkout-session create/expire perms
  verified (200/200); key installed in prod .env as STRIPE_SECRET_KEY.
- FOUND + FIXED: Stripe webhook was still pointed at the dead
  allternit-cloud-api.fly.dev URL. Created new endpoint
  https://api.allternit.com/api/v1/webhooks/stripe (5 billing events),
  installed its fresh signing secret as STRIPE_WEBHOOK_SECRET, disabled the
  old fly.dev endpoint.
- Webhook path smoke-tested with the production secret: signed
  checkout.session.completed → 200 + $10 grant + ledger row; replay → 200,
  no double grant; bad signature → 401. Smoke rows cleaned up.
- Cleaned stale instance hr_contabo_mail_001 (container lost in the 76GB
  docker prune; open session closed, instance stopped) — auto-stop warnings
  silenced. Zero prod errors.

### Next
- User can do a real $10 top-up from platform.allternit.com/billing whenever
  ready — the loop is live end-to-end. No code changes needed.
- Enroll a third Contabo VPS as an active workload node when purchased
  (procedure in docs/Operations/CAPACITY_PLAN.md).

### Open questions
- plan_tiers ↔ subscription metadata flow (allternit_plan_tier) is wired
  but no subscription product exists yet; credit packs are the live
  revenue path for now.
