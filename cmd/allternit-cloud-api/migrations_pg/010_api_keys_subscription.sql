-- 010_api_keys_subscription.sql
--
-- Extend API keys with subscription tier and quota tracking.
-- API keys created through the Console or CLI will now be tied
-- to the user's subscription tier, with monthly quota enforcement.

-- Add subscription and quota fields to api_keys
ALTER TABLE public.api_keys
ADD COLUMN IF NOT EXISTS subscription_tier text,
ADD COLUMN IF NOT EXISTS monthly_quota_usd numeric,
ADD COLUMN IF NOT EXISTS usage_this_period_usd numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS period_started_at timestamp with time zone;

-- Index for querying by subscription tier (analytics, quota checks)
CREATE INDEX IF NOT EXISTS idx_api_keys_subscription_tier
    ON public.api_keys(subscription_tier);

-- Index for querying keys needing quota reset (period-based)
CREATE INDEX IF NOT EXISTS idx_api_keys_period_started_at
    ON public.api_keys(period_started_at)
    WHERE period_started_at IS NOT NULL;

-- Add subscription_tier to users table for quick lookup
ALTER TABLE public.users
ADD COLUMN IF NOT EXISTS subscription_tier text DEFAULT 'free';

-- Track quota per user (aggregated across all their keys)
CREATE TABLE IF NOT EXISTS public.user_quota_periods (
    id text NOT NULL PRIMARY KEY,
    user_id text NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    period_started_at timestamp with time zone NOT NULL,
    period_ends_at timestamp with time zone NOT NULL,
    quota_limit_usd numeric NOT NULL,
    usage_usd numeric DEFAULT 0,
    created_at timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_user_quota_periods_user
    ON public.user_quota_periods(user_id);

CREATE INDEX IF NOT EXISTS idx_user_quota_periods_current
    ON public.user_quota_periods(user_id, period_started_at, period_ends_at)
    WHERE period_started_at <= CURRENT_TIMESTAMP AND period_ends_at > CURRENT_TIMESTAMP;

-- Function to get current quota period for a user
CREATE OR REPLACE FUNCTION get_current_quota_period(p_user_id text)
RETURNS TABLE (
    id text,
    user_id text,
    period_started_at timestamp with time zone,
    period_ends_at timestamp with time zone,
    quota_limit_usd numeric,
    usage_usd numeric
) AS $$
BEGIN
    RETURN QUERY
    SELECT uqp.id, uqp.user_id, uqp.period_started_at, uqp.period_ends_at,
           uqp.quota_limit_usd, uqp.usage_usd
    FROM public.user_quota_periods uqp
    WHERE uqp.user_id = p_user_id
      AND uqp.period_started_at <= CURRENT_TIMESTAMP
      AND uqp.period_ends_at > CURRENT_TIMESTAMP
    ORDER BY uqp.period_started_at DESC
    LIMIT 1;
END;
$$ LANGUAGE plpgsql;

-- Function to create or get quota period for a user
CREATE OR REPLACE FUNCTION ensure_quota_period(p_user_id text, p_quota_usd numeric)
RETURNS TABLE (
    id text,
    quota_limit_usd numeric,
    usage_usd numeric
) AS $$
DECLARE
    v_period_id text;
    v_period_start timestamp with time zone;
    v_period_end timestamp with time zone;
BEGIN
    -- Calculate period boundaries (monthly, aligned to 1st of month)
    v_period_start := date_trunc('month', CURRENT_TIMESTAMP);
    v_period_end := v_period_start + interval '1 month';
    
    -- Try to get existing period
    SELECT id INTO v_period_id
    FROM public.user_quota_periods
    WHERE user_id = p_user_id
      AND period_started_at = v_period_start;
    
    -- Create if doesn't exist
    IF v_period_id IS NULL THEN
        INSERT INTO public.user_quota_periods (
            id, user_id, period_started_at, period_ends_at, quota_limit_usd
        ) VALUES (
            gen_random_uuid()::text,
            p_user_id,
            v_period_start,
            v_period_end,
            p_quota_usd
        ) RETURNING user_quota_periods.id INTO v_period_id;
    ELSE
        -- Update quota if changed (e.g., plan upgrade)
        UPDATE public.user_quota_periods
        SET quota_limit_usd = p_quota_usd,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = v_period_id;
    END IF;
    
    RETURN QUERY
    SELECT uqp.id, uqp.quota_limit_usd, uqp.usage_usd
    FROM public.user_quota_periods uqp
    WHERE uqp.id = v_period_id;
END;
$$ LANGUAGE plpgsql;

-- Trigger to sync subscription_tier from billing_subscriptions to users
CREATE OR REPLACE FUNCTION sync_user_subscription_tier()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.users (id, subscription_tier, created_at, updated_at)
    VALUES (
        NEW.user_id,
        NEW.plan_tier,
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP
    )
    ON CONFLICT (id) DO UPDATE
    SET subscription_tier = EXCLUDED.subscription_tier,
        updated_at = CURRENT_TIMESTAMP;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop trigger if exists (for idempotency)
DROP TRIGGER IF EXISTS sync_subscription_tier_trigger ON public.billing_subscriptions;

CREATE TRIGGER sync_subscription_tier_trigger
AFTER INSERT OR UPDATE ON public.billing_subscriptions
FOR EACH ROW
WHEN (NEW.status IN ('active', 'trialing'))
EXECUTE FUNCTION sync_user_subscription_tier();

-- Comment explaining the quota model
COMMENT ON TABLE public.user_quota_periods IS 'Monthly quota tracking per user. Created on first API key creation, reset monthly. Quota limit updates on plan changes.';
COMMENT ON COLUMN public.api_keys.subscription_tier IS 'Subscription tier at key creation time: free, pro, team';
COMMENT ON COLUMN public.api_keys.monthly_quota_usd IS 'Monthly quota in USD for this key. NULL = unlimited (legacy keys).';
COMMENT ON COLUMN public.api_keys.usage_this_period_usd IS 'Usage in USD for current billing period. Reset monthly.';
