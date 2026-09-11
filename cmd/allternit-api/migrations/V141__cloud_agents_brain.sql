-- Cloud Agents Phase 3: first-class brain bind on the session row.
-- vault_ids stay in session metadata JSON; public JSON also emits them
-- as a top-level array. Unknown brain/vault ids are rejected at create.
ALTER TABLE beta_sessions ADD COLUMN brain_id TEXT;
