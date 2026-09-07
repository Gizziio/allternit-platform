-- 002_widen_int_to_bigint.sql
--
-- Production schema drift fix (2026-09-02): databases created before
-- 001_initial.sql was finalized kept SQLite-era INTEGER columns where the
-- Rust code decodes i64 (INT8). Every mismatch is integer -> bigint, a safe
-- widening. Applied manually to production on mail; recorded here so fresh
-- installs and rebuilds converge on the same schema.
--
-- Each ALTER runs in a DO block that swallows insufficient_privilege /
-- undefined_table / undefined_column: production applied this drift fix
-- manually (objects there are owned by the admin role, not the application
-- user), and re-running a type widening is a no-op anyway. Never edit applied
-- statements here; add a new NNN migration instead.

DO $$
BEGIN
    ALTER TABLE public.jobs
        ALTER COLUMN priority TYPE bigint,
        ALTER COLUMN queue_position TYPE bigint,
        ALTER COLUMN exit_code TYPE bigint,
        ALTER COLUMN retry_count TYPE bigint,
        ALTER COLUMN max_retries TYPE bigint;
EXCEPTION WHEN insufficient_privilege OR undefined_table OR undefined_column THEN NULL;
END
$$;

DO $$
BEGIN
    ALTER TABLE public.plan_tiers
        ALTER COLUMN max_active_devices TYPE bigint,
        ALTER COLUMN max_pairings_per_day TYPE bigint,
        ALTER COLUMN max_relay_sockets TYPE bigint,
        ALTER COLUMN max_relay_mb_per_day TYPE bigint,
        ALTER COLUMN max_hosted_runtime_hours_monthly TYPE bigint,
        ALTER COLUMN max_hosted_runtimes TYPE bigint,
        ALTER COLUMN max_hosted_runtime_memory_mb TYPE bigint;
EXCEPTION WHEN insufficient_privilege OR undefined_table OR undefined_column THEN NULL;
END
$$;

DO $$
BEGIN
    ALTER TABLE public.runs
        ALTER COLUMN total_steps TYPE bigint,
        ALTER COLUMN completed_steps TYPE bigint;
EXCEPTION WHEN insufficient_privilege OR undefined_table OR undefined_column THEN NULL;
END
$$;

DO $$
BEGIN
    ALTER TABLE public.schedules
        ALTER COLUMN run_count TYPE bigint,
        ALTER COLUMN misfire_count TYPE bigint;
EXCEPTION WHEN insufficient_privilege OR undefined_table OR undefined_column THEN NULL;
END
$$;

DO $$
BEGIN
    ALTER TABLE public.task_queue
        ALTER COLUMN retry_count TYPE bigint,
        ALTER COLUMN max_retries TYPE bigint;
EXCEPTION WHEN insufficient_privilege OR undefined_table OR undefined_column THEN NULL;
END
$$;

DO $$
BEGIN
    ALTER TABLE public.tasks
        ALTER COLUMN priority TYPE bigint;
EXCEPTION WHEN insufficient_privilege OR undefined_table OR undefined_column THEN NULL;
END
$$;

DO $$
BEGIN
    ALTER TABLE public.user_runtime_quotas
        ALTER COLUMN max_active_devices TYPE bigint,
        ALTER COLUMN max_pairings_per_day TYPE bigint,
        ALTER COLUMN max_relay_sockets TYPE bigint,
        ALTER COLUMN max_relay_mb_per_day TYPE bigint,
        ALTER COLUMN max_hosted_runtime_hours_monthly TYPE bigint,
        ALTER COLUMN max_hosted_runtimes TYPE bigint,
        ALTER COLUMN max_hosted_runtime_memory_mb TYPE bigint;
EXCEPTION WHEN insufficient_privilege OR undefined_table OR undefined_column THEN NULL;
END
$$;

-- Same drift class, FLOAT4 -> FLOAT8: 001_initial.sql (and production)
-- declared money/rate columns as `real` while the Rust code decodes f64
-- (FLOAT8). Test schemas always used DOUBLE PRECISION, which is why the
-- suite never caught it. Widen every user-table real column.

DO $$
BEGIN
    ALTER TABLE public.cost_alerts
        ALTER COLUMN budget_amount TYPE double precision,
        ALTER COLUMN current_cost TYPE double precision,
        ALTER COLUMN threshold_percent TYPE double precision;
EXCEPTION WHEN insufficient_privilege OR undefined_table OR undefined_column THEN NULL;
END
$$;

DO $$
BEGIN
    ALTER TABLE public.cost_rates
        ALTER COLUMN cost_per_hour TYPE double precision,
        ALTER COLUMN storage_cost_per_gb_month TYPE double precision,
        ALTER COLUMN transfer_cost_per_gb TYPE double precision;
EXCEPTION WHEN insufficient_privilege OR undefined_table OR undefined_column THEN NULL;
END
$$;

DO $$
BEGIN
    ALTER TABLE public.credit_transactions
        ALTER COLUMN amount_usd TYPE double precision;
EXCEPTION WHEN insufficient_privilege OR undefined_table OR undefined_column THEN NULL;
END
$$;

DO $$
BEGIN
    ALTER TABLE public.hosted_runtime_instances
        ALTER COLUMN monthly_cost_cap TYPE double precision;
EXCEPTION WHEN insufficient_privilege OR undefined_table OR undefined_column THEN NULL;
END
$$;

DO $$
BEGIN
    ALTER TABLE public.hosted_runtime_usage_sessions
        ALTER COLUMN cost_per_hour TYPE double precision,
        ALTER COLUMN estimated_cost_usd TYPE double precision;
EXCEPTION WHEN insufficient_privilege OR undefined_table OR undefined_column THEN NULL;
END
$$;

DO $$
BEGIN
    ALTER TABLE public.plan_tiers
        ALTER COLUMN hard_spend_cap_usd TYPE double precision;
EXCEPTION WHEN insufficient_privilege OR undefined_table OR undefined_column THEN NULL;
END
$$;

DO $$
BEGIN
    ALTER TABLE public.regions
        ALTER COLUMN cost_factor TYPE double precision,
        ALTER COLUMN location_lat TYPE double precision,
        ALTER COLUMN location_lon TYPE double precision;
EXCEPTION WHEN insufficient_privilege OR undefined_table OR undefined_column THEN NULL;
END
$$;

DO $$
BEGIN
    ALTER TABLE public.run_costs
        ALTER COLUMN instance_cost TYPE double precision,
        ALTER COLUMN storage_cost TYPE double precision,
        ALTER COLUMN storage_gb TYPE double precision,
        ALTER COLUMN total_cost TYPE double precision,
        ALTER COLUMN transfer_cost TYPE double precision,
        ALTER COLUMN transfer_gb TYPE double precision;
EXCEPTION WHEN insufficient_privilege OR undefined_table OR undefined_column THEN NULL;
END
$$;

DO $$
BEGIN
    ALTER TABLE public.user_cost_budgets
        ALTER COLUMN alert_threshold TYPE double precision,
        ALTER COLUMN current_month_cost TYPE double precision,
        ALTER COLUMN monthly_budget TYPE double precision;
EXCEPTION WHEN insufficient_privilege OR undefined_table OR undefined_column THEN NULL;
END
$$;

DO $$
BEGIN
    ALTER TABLE public.user_credits
        ALTER COLUMN balance_usd TYPE double precision;
EXCEPTION WHEN insufficient_privilege OR undefined_table OR undefined_column THEN NULL;
END
$$;

DO $$
BEGIN
    ALTER TABLE public.user_runtime_quotas
        ALTER COLUMN hard_spend_cap_usd TYPE double precision;
EXCEPTION WHEN insufficient_privilege OR undefined_table OR undefined_column THEN NULL;
END
$$;
