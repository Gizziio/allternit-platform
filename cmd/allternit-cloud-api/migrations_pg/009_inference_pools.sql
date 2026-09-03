-- 009_inference_pools.sql
--
-- Inference provider pools (PG mirror of migrations/030_inference_pools.sql):
-- per-pool monthly budget ceilings (the circuit breaker for upstream spend),
-- per-pool usage attribution, and the config surface for the free-tier pool
-- policy.
--
-- One row per configured upstream provider (seeded at startup by
-- services::inference_pool from the same env vars main.rs uses; operator-edited
-- budgets are never overwritten on re-seed). inference_usage.pool_id links
-- every settled completion to its pool; NULL pool_id rows predate pools or
-- come from an unseeded provider.
--
-- kind 'byok' and rate_limit_rpm are reserved for later phases; v1 only reads
-- enabled, monthly_budget_usd, and priority.

CREATE TABLE IF NOT EXISTS public.inference_pools (
    id text NOT NULL PRIMARY KEY,
    provider_id text NOT NULL UNIQUE,
    kind text NOT NULL DEFAULT 'pay_per_token',
    monthly_budget_usd double precision,
    rate_limit_rpm integer,
    priority integer NOT NULL DEFAULT 100,
    enabled boolean NOT NULL DEFAULT TRUE,
    created_at timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE public.inference_pools OWNER TO postgres;

ALTER TABLE public.inference_usage
    ADD COLUMN IF NOT EXISTS pool_id text REFERENCES public.inference_pools(id);

CREATE INDEX IF NOT EXISTS idx_inference_usage_pool_month
    ON public.inference_usage(pool_id, created_at);
