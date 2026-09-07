-- 014_provisioned_fleet.sql
--
-- P2 per-subscription provisioning lane (docs/architecture/2026-09-03-
-- control-plane-data-plane-decision.md items 7-10, decisions A3/D2/D3):
-- one unprivileged Incus container per paid subscription, created by the
-- provisioning service (services/provisioning.rs) on fleet hosts.
--
-- provisioned_hosts   : the fleet. One row per Incus host; capacity and
--                       current allocation are maintained by the scheduler
--                       (best-free bin-pack, services::provisioning::select_host).
-- provisioned_instances : the per-sub container. `device_id` links the
--                       runtime_devices row (kind='provisioned') minted when
--                       the instance phones home via the one-time pairing
--                       code (`pairing_code_hash`), exactly like the hosted
--                       lane's bootstrap token (runtime_pairing.rs).
-- provisioned_instance_usage_sessions : open/closed run intervals; total
--                       running seconds per period derives from these rows
--                       (provisioning::usage_summary). Deliberately no Stripe
--                       columns — billing integration is out of scope (P2
--                       item 9 only makes the metering data available).
--
-- Everything is IF NOT EXISTS / additive, per the migrations_pg convention.

-- Fleet hosts. `incus_endpoint` is the same client-cert-authenticated Incus
-- HTTPS endpoint the Desktop Cloud lane uses (INCUS_CLIENT_CERT/INCUS_CLIENT_KEY
-- in api.env.template); the per-sub lane drives the same backend, one row per
-- host instead of one global INCUS_URL.
CREATE TABLE IF NOT EXISTS public.provisioned_hosts (
    id                 TEXT PRIMARY KEY,
    name               TEXT NOT NULL,
    incus_endpoint     TEXT NOT NULL,
    region             TEXT,
    cpu_cores_total    INTEGER NOT NULL DEFAULT 0,
    memory_mb_total    BIGINT  NOT NULL DEFAULT 0,
    disk_gb_total      BIGINT  NOT NULL DEFAULT 0,
    cpu_cores_allocated INTEGER NOT NULL DEFAULT 0,
    memory_mb_allocated BIGINT  NOT NULL DEFAULT 0,
    disk_gb_allocated   BIGINT  NOT NULL DEFAULT 0,
    enabled            BOOLEAN NOT NULL DEFAULT TRUE,
    last_seen_at       TIMESTAMPTZ,
    created_at         TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at         TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Per-subscription instances. Statuses follow the state machine in
-- services::provisioning (provisioning -> running <-> stopped, error,
-- deleted); the CHECK pins the vocabulary the state-machine tests assert.
CREATE TABLE IF NOT EXISTS public.provisioned_instances (
    id            TEXT PRIMARY KEY,
    user_id       TEXT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    subscription_id TEXT REFERENCES public.billing_subscriptions(stripe_subscription_id),
    host_id       TEXT REFERENCES public.provisioned_hosts(id),
    incus_name    TEXT NOT NULL,
    status        TEXT NOT NULL DEFAULT 'provisioning'
        CHECK (status IN ('provisioning', 'running', 'stopped', 'error', 'deleted')),
    -- One-time pairing code: raw value ships to the instance via cloud-init
    -- user-data (options-as-env, DevPod contract); only the sha256 lives here.
    -- Consumed (set NULL) when the device row is bound at pairing exchange.
    pairing_code_hash  TEXT,
    pairing_expires_at TIMESTAMPTZ,
    -- runtime_devices.id of the registered node (kind='provisioned').
    device_id     TEXT,
    cpu_cores     INTEGER NOT NULL DEFAULT 2,
    memory_mb     BIGINT  NOT NULL DEFAULT 2048,
    disk_gb       BIGINT  NOT NULL DEFAULT 20,
    error_message TEXT,
    -- Metering timestamps (per-minute billing derives from the sessions
    -- table; these columns are the row-level view of the last transition).
    last_started_at TIMESTAMPTZ,
    last_stopped_at TIMESTAMPTZ,
    deleted_at      TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (host_id, incus_name)
);

CREATE INDEX IF NOT EXISTS idx_provisioned_instances_user
    ON public.provisioned_instances(user_id);
CREATE INDEX IF NOT EXISTS idx_provisioned_instances_status
    ON public.provisioned_instances(status);

-- Open/closed run intervals, mirroring hosted_runtime_usage_sessions minus
-- the cost columns (no Stripe in this lane). At most one open session per
-- instance, enforced the same way (partial unique index).
CREATE TABLE IF NOT EXISTS public.provisioned_instance_usage_sessions (
    id          TEXT PRIMARY KEY,
    instance_id TEXT NOT NULL REFERENCES public.provisioned_instances(id) ON DELETE CASCADE,
    user_id     TEXT NOT NULL,
    started_at  TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    ended_at    TIMESTAMPTZ,
    duration_seconds BIGINT,
    stop_reason TEXT
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_provisioned_usage_one_open_session
    ON public.provisioned_instance_usage_sessions(instance_id)
    WHERE ended_at IS NULL;

-- The provisioned lane pre-approves its pairings with a one-time bootstrap
-- code validated against provisioned_instances.pairing_code_hash, exactly
-- like hosted runtimes carry hosted_instance_id. The pairing row records the
-- target instance so the exchange can bind the minted runtime_devices row.
ALTER TABLE public.runtime_pairings
    ADD COLUMN IF NOT EXISTS provisioned_instance_id TEXT;
