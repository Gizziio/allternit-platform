-- Cloud Agents Phase 1: public /api/v1/sessions facade over the durable
-- beta session layer.
--
-- agents.version: integer config version, incremented by the agent update
-- route whenever config-changing fields are written. Returned on agent JSON.
-- agents.archived_at: set by POST /api/v1/agents/:id/archive (archive is
-- one-way; there is no unarchive).
-- beta_sessions.computer_kind / computer_id: the Cloud Agent computer
-- binding (none | sandbox | local) lives on the session row; no new public
-- computers resource is introduced.
ALTER TABLE agents ADD COLUMN version INTEGER NOT NULL DEFAULT 1;
ALTER TABLE agents ADD COLUMN archived_at DATETIME;

ALTER TABLE beta_sessions ADD COLUMN computer_kind TEXT;
ALTER TABLE beta_sessions ADD COLUMN computer_id TEXT;
