-- 011_data_plane_nodes.sql
--
-- Data-plane node registry — PG-native extension of runtime_devices per the
-- P1 route inventory (docs/architecture/2026-09-04-p1-route-inventory.md §4).
-- A runtime_devices row IS a data-plane node; `kind` records how it is
-- reached, capacity/status metadata lets the control plane pick a healthy
-- default node and route agent-sessions (and later namespaces) to it.
--
-- This is the PG mirror next to the SQLite lineage in migrations/; local
-- pgloader-derived deployments already have runtime_devices, so every
-- change here is additive with a default (existing rows read as kind
-- 'paired', preserving today's behavior).

-- 'local'       : user's own machine (desktop app / gizzi serve --tunnel)
-- 'paired'      : BYO VPS or long-lived box paired via device code
-- 'provisioned' : cloud-api-hosted runtime container (hosted_runtime_instances)
ALTER TABLE public.runtime_devices
    ADD COLUMN IF NOT EXISTS kind TEXT NOT NULL DEFAULT 'paired'
        CHECK (kind IN ('local', 'paired', 'provisioned')),
    ADD COLUMN IF NOT EXISTS endpoint_url TEXT,                -- absorbs gizzi_instances.url (https/tunnel fallback)
    ADD COLUMN IF NOT EXISTS tailnet_ip TEXT,                  -- from mesh enrollment (Headscale)
    ADD COLUMN IF NOT EXISTS relay_connected_at TIMESTAMPTZ,   -- last outbound WS relay attach (runtime_relay)
    ADD COLUMN IF NOT EXISTS capacity JSONB NOT NULL DEFAULT '{}'::jsonb;  -- {cores, memory_mb, gpu, disk_gb}

-- Hot path of control-plane node resolution: the user's online nodes.
CREATE INDEX IF NOT EXISTS idx_runtime_devices_user_online
    ON public.runtime_devices(user_id) WHERE status = 'online';

-- User's preferred node for control-plane routing (per surface optional;
-- surface '*' is the default used when no surface-specific row exists).
CREATE TABLE IF NOT EXISTS public.user_node_preferences (
    user_id    TEXT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    surface    TEXT NOT NULL DEFAULT '*',      -- '*' = default; 'office', 'runner', ...
    node_id    TEXT NOT NULL REFERENCES public.runtime_devices(id) ON DELETE CASCADE,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, surface)
);

ALTER TABLE public.user_node_preferences OWNER TO postgres;
