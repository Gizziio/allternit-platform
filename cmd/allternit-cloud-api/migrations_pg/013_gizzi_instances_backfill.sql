-- 013_gizzi_instances_backfill.sql
--
-- Tranche-2 backfill of the tranche-1 deferral in 012_data_plane_nodes.sql
-- (docs/architecture/2026-09-04-p1-route-inventory.md §4 "Backfill + retire"):
-- every gizzi_instances row becomes a runtime_devices row with
-- kind = 'local', so a user's self-registered node (`gizzi serve --tunnel`)
-- is a first-class registry entry that node resolution
-- (services/node_resolution.rs) considers like any paired/provisioned row.
--
-- The derived id 'gi_' || gizzi_instances.id is stable, so this INSERT is
-- idempotent (ON CONFLICT (id) DO NOTHING): re-applying the migration never
-- duplicates rows and never clobbers state a row accumulated since the
-- first backfill (heartbeats, relay attaches, capacity reports).
--
-- Deliberate deviations from the §4 sketch:
-- - credential_hash stays NULL: these nodes carry no device credential.
-- - credential_expires_at is far-future instead of CURRENT_TIMESTAMP so the
--   resolver's expiry health check passes (credential-less presence rows
--   never expire the way a paired device credential does).
-- - Rows with a NULL/empty url or NULL user_id are skipped: a registry row
--   with no endpoint and no owner is not addressable.

INSERT INTO public.runtime_devices (
    id, user_id, name, runtime_type, kind, endpoint_url,
    status, last_seen_at, capabilities,
    credential_hash, credential_expires_at,
    created_at, updated_at
)
SELECT
    'gi_' || gi.id,
    gi.user_id,
    COALESCE(NULLIF(gi.name, ''), 'gizzi instance'),
    'desktop',
    'local',
    gi.url,
    'online',
    gi.updated_at,
    '[]',
    NULL,
    CURRENT_TIMESTAMP + interval '100 years',
    gi.created_at,
    gi.updated_at
FROM public.gizzi_instances AS gi
WHERE gi.user_id IS NOT NULL
  AND gi.url IS NOT NULL
  AND btrim(gi.url) <> ''
ON CONFLICT (id) DO NOTHING;
