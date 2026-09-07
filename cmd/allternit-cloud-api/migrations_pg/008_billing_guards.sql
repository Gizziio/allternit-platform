-- 008_billing_guards.sql
--
-- Chargeback hold on first purchases (PG mirror of
-- migrations/029_billing_guards.sql).
--
-- billing_purchase_trust tracks each user's paid purchase history so the
-- checkout surfaces can limit untrusted buyers (first purchase, or purchases
-- younger than CHARGEBACK_HOLD_DAYS) to small amounts while payments settle.
-- The webhook (checkout.session.completed, mode=payment) increments
-- paid_purchase_count; billing_checkout/billing_subscriptions read it.
--
-- The extra month-scoped inference index backs the free-allowance pre-check
-- (check_inference_allowed) and the daily reconciliation script.

CREATE TABLE IF NOT EXISTS public.billing_purchase_trust (
    user_id text NOT NULL PRIMARY KEY,
    first_paid_at timestamp with time zone,
    paid_purchase_count integer NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_inference_usage_user_month
    ON public.inference_usage(user_id, created_at DESC);
