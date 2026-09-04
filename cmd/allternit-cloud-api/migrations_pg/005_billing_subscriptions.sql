-- 005_billing_subscriptions.sql
--
-- Stripe subscription bookkeeping and per-user Stripe customer links (PG
-- mirror of migrations/026_billing_subscriptions.sql).
--
-- billing_subscriptions mirrors the Stripe subscription lifecycle events the
-- webhook receives (customer.subscription.*) so monthly credit grants on
-- invoice.paid can resolve the subscription id back to a user and plan
-- without trusting invoice metadata (invoice metadata is NOT subscription
-- metadata). user_billing_accounts links a Clerk user id to their Stripe
-- customer id so the billing-portal endpoint can open a portal session
-- without the client knowing Stripe identifiers.

CREATE TABLE IF NOT EXISTS public.billing_subscriptions (
    stripe_subscription_id text NOT NULL PRIMARY KEY,
    user_id text NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    plan_id text NOT NULL,
    plan_tier text NOT NULL,
    status text NOT NULL,
    stripe_customer_id text,
    created_at timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_billing_subscriptions_user
    ON public.billing_subscriptions(user_id);

CREATE TABLE IF NOT EXISTS public.user_billing_accounts (
    user_id text NOT NULL PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
    stripe_customer_id text NOT NULL,
    created_at timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP
);

