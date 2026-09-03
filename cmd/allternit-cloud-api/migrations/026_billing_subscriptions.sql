-- Stripe subscription bookkeeping and per-user Stripe customer links.
--
-- billing_subscriptions mirrors the Stripe subscription lifecycle events the
-- webhook receives (customer.subscription.*) so monthly credit grants on
-- invoice.paid can resolve the subscription id back to a user and plan
-- without trusting invoice metadata (invoice metadata is NOT subscription
-- metadata). user_billing_accounts links a Clerk user id to their Stripe
-- customer id so the billing-portal endpoint can open a portal session
-- without the client knowing Stripe identifiers.

CREATE TABLE IF NOT EXISTS billing_subscriptions (
    stripe_subscription_id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    plan_id TEXT NOT NULL,
    plan_tier TEXT NOT NULL,
    status TEXT NOT NULL,
    stripe_customer_id TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TRIGGER IF NOT EXISTS update_billing_subscriptions_timestamp
AFTER UPDATE ON billing_subscriptions
BEGIN
    UPDATE billing_subscriptions SET updated_at = CURRENT_TIMESTAMP WHERE stripe_subscription_id = NEW.stripe_subscription_id;
END;

CREATE INDEX IF NOT EXISTS idx_billing_subscriptions_user
    ON billing_subscriptions(user_id);

CREATE TABLE IF NOT EXISTS user_billing_accounts (
    user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    stripe_customer_id TEXT NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TRIGGER IF NOT EXISTS update_user_billing_accounts_timestamp
AFTER UPDATE ON user_billing_accounts
BEGIN
    UPDATE user_billing_accounts SET updated_at = CURRENT_TIMESTAMP WHERE user_id = NEW.user_id;
END;
