-- V14: industry-standard agent mode + designated primary (companion) + delegates.
-- mode mirrors the Claude Code agent frontmatter `mode`:
--   primary | subagent | orchestrator | council
-- is_primary marks the per-user always-on "Allternit Companion" agent.
-- delegates is a JSON array of child agent ids an orchestrator routes to.
ALTER TABLE agents ADD COLUMN mode TEXT NOT NULL DEFAULT 'primary';
ALTER TABLE agents ADD COLUMN is_primary INTEGER NOT NULL DEFAULT 0;
ALTER TABLE agents ADD COLUMN delegates TEXT;
CREATE INDEX IF NOT EXISTS idx_agents_user_primary ON agents(user_id, is_primary);
