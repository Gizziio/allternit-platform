-- A:// Artifacts API — org relay tier (docs/design/artifacts-api.md §6 relay
-- tier, IMPLEMENTED 2026-09-12, session relay-0912). Artifacts travel between
-- gateways as portable relay bundles; the receiving gateway mints a NEW LOCAL
-- id and records the origin id + relay path in provenance (decision 5).
-- Received artifacts render under the standard sandbox policy (decision 6).

-- Send/receive receipts. One row per unique bundle (bundle_hash PK), giving:
--   * receive idempotency — a replayed bundle returns the already-minted local
--     artifact instead of duplicating it;
--   * send dedupe — re-POSTing the same artifact+version+target returns the
--     original receipt instead of re-sending;
--   * an audit trail of every relay hop this gateway participated in.
CREATE TABLE IF NOT EXISTS content_artifact_relay_receipts (
    bundle_hash        TEXT PRIMARY KEY,
    direction          TEXT NOT NULL,            -- 'sent' | 'received'
    peer_gateway       TEXT NOT NULL,            -- counterparty gateway name
    origin_gateway     TEXT NOT NULL,
    origin_artifact_id TEXT NOT NULL,
    origin_version     INTEGER NOT NULL,
    local_artifact_id  TEXT,                     -- minted id (receive) / source id (send)
    relay_chain        TEXT NOT NULL DEFAULT '[]',
    created_at         DATETIME NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_artifact_relay_receipts_peer
    ON content_artifact_relay_receipts(peer_gateway, created_at);
CREATE INDEX IF NOT EXISTS idx_artifact_relay_receipts_local
    ON content_artifact_relay_receipts(local_artifact_id);

-- Relay provenance for received artifacts: origin identity and the full relay
-- chain, keyed by the LOCAL artifact id. Surfaced on reads as
-- provenance.relay; rendered by the gallery detail surface.
CREATE TABLE IF NOT EXISTS content_artifact_relay_provenance (
    artifact_id           TEXT PRIMARY KEY,      -- local minted id
    origin_gateway        TEXT NOT NULL,
    origin_artifact_id    TEXT NOT NULL,
    origin_version        INTEGER NOT NULL,
    origin_sandbox_policy TEXT NOT NULL DEFAULT 'standard',
    relay_chain           TEXT NOT NULL DEFAULT '[]',
    bundle_hash           TEXT NOT NULL,
    received_at           DATETIME NOT NULL
);
