-- Adds a caller-supplied stable key to agent_canvases so a publisher
-- (e.g. gizzi-code's HTML artifact publisher) can redeploy the same
-- artifact by (session_id, artifact_key) instead of minting a new row
-- every time, plus a version counter that increments on each such update.

ALTER TABLE agent_canvases ADD COLUMN artifact_key TEXT NULL;
ALTER TABLE agent_canvases ADD COLUMN version INTEGER NOT NULL DEFAULT 1;

CREATE UNIQUE INDEX IF NOT EXISTS idx_agent_canvases_session_artifact_key
    ON agent_canvases(session_id, artifact_key)
    WHERE artifact_key IS NOT NULL;
