-- Enrich agents table with canonical agent schema fields:
-- trust tier, harness config, enabled mode surfaces, character layer,
-- allowed skills/tools, and domain capabilities.

ALTER TABLE agents ADD COLUMN trust_tier TEXT NOT NULL DEFAULT 'standard';
ALTER TABLE agents ADD COLUMN harness_config TEXT;
ALTER TABLE agents ADD COLUMN enabled_modes TEXT NOT NULL DEFAULT '["chat"]';
ALTER TABLE agents ADD COLUMN character_json TEXT;
ALTER TABLE agents ADD COLUMN allowed_skills TEXT;
ALTER TABLE agents ADD COLUMN allowed_tools TEXT;
ALTER TABLE agents ADD COLUMN category TEXT;
ALTER TABLE agents ADD COLUMN tags TEXT;
ALTER TABLE agents ADD COLUMN data_classification TEXT;
ALTER TABLE agents ADD COLUMN write_scope TEXT;

CREATE INDEX IF NOT EXISTS idx_agents_type ON agents(type);
CREATE INDEX IF NOT EXISTS idx_agents_trust_tier ON agents(trust_tier);
CREATE INDEX IF NOT EXISTS idx_agents_parent_agent_id ON agents(parent_agent_id);
CREATE INDEX IF NOT EXISTS idx_agents_workspace_id ON agents(workspace_id);
