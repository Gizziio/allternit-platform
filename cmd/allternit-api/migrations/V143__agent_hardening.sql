-- Agent definition hardening (console backend Phase 2, G4).
--
-- agents.is_bot: first-class bot flag. Was previously only merged into the
--   config JSON blob (camelCase `isBot`, see merge_autonomous_primitives_into
--   _config); the column is now authoritative and the blob is kept in sync
--   (write-through) so older consumers do not regress.
-- agents.tool_permissions: per-tool permission map (JSON object,
--   tool name -> always_allow | always_ask | auto). JSON column on agents
--   rather than a normalized table: the map is small, per-agent, read whole
--   on every toolset GET, and never queried by key.
-- agents.mcp_connector_ids: JSON array of mcp_connectors ids bound to the
--   agent's toolset (PUT /agents/:id/toolset).
-- agent_versions: full-agent-JSON snapshot written by every successful
--   agent mutation (PATCH/PUT/toolset) at the bumped version.
ALTER TABLE agents ADD COLUMN is_bot INTEGER NOT NULL DEFAULT 0;
ALTER TABLE agents ADD COLUMN tool_permissions TEXT;
ALTER TABLE agents ADD COLUMN mcp_connector_ids TEXT;

CREATE TABLE IF NOT EXISTS agent_versions (
    id         TEXT PRIMARY KEY,
    agent_id   TEXT NOT NULL,
    version    INTEGER NOT NULL,
    snapshot   TEXT NOT NULL,
    created_by TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_agent_versions_agent ON agent_versions(agent_id);

-- Backfill the column from the legacy config blob. Accept both camelCase
-- (merge_autonomous_primitives_into_config) and snake_case spellings.
UPDATE agents
   SET is_bot = 1
 WHERE COALESCE(json_extract(config, '$.isBot'), 0) = 1
    OR COALESCE(json_extract(config, '$.is_bot'), 0) = 1;
