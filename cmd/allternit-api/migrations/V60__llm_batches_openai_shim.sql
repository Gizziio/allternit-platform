-- Phase 6 (Swarm D): OpenAI-compatible batch shim metadata.
ALTER TABLE llm_batches ADD COLUMN input_file_id TEXT;
ALTER TABLE llm_batches ADD COLUMN endpoint TEXT;
ALTER TABLE llm_batches ADD COLUMN completion_window TEXT;
ALTER TABLE llm_batches ADD COLUMN metadata TEXT;
