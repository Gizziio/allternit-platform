-- 007_inference_usage.sql
--
-- Inference usage accounting (Phase B metering) — PG mirror of
-- migrations/028_inference_usage.sql.
--
-- One row per settled chat completion (streaming or not) — written ALWAYS,
-- even when no credit deduction happens (plan-cap users without a user_credits
-- row are recorded only; enforcement comes via plan caps). This is the audit
-- trail behind the 'inference' credit_transactions ledger entries.
--
-- estimated marks rows whose token counts were approximated (chars/4) because
-- the upstream reported no usage object; wholesale_cost_usd is our upstream
-- cost when live pricing was available, NULL when the static catalog priced
-- the request.

CREATE TABLE IF NOT EXISTS public.inference_usage (
    id text NOT NULL PRIMARY KEY,
    user_id text NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    model text NOT NULL,
    prompt_tokens bigint NOT NULL,
    completion_tokens bigint NOT NULL,
    cost_usd double precision NOT NULL,
    wholesale_cost_usd double precision,
    estimated boolean NOT NULL DEFAULT false,
    created_at timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_inference_usage_user
    ON public.inference_usage(user_id, created_at);
