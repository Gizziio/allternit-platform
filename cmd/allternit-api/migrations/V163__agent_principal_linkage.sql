-- ── Bot dual-record linkage (BOT_AUTHORING_SPEC §0) ──────────────────────────
-- Every bot spans a product record (agents) and an execution principal
-- (cowork_principals). This column is the enforced invariant: creating or
-- updating an agent writes the canonical principal id, and agent creation
-- provisions the execution credential exactly once.
ALTER TABLE agents ADD COLUMN principal_id TEXT;

CREATE INDEX IF NOT EXISTS idx_agents_principal ON agents(principal_id);
