-- Phase 5 (Swarm E): batch execution and polling state.
ALTER TABLE llm_batches ADD COLUMN provider_batch_id TEXT;
ALTER TABLE llm_batches ADD COLUMN retry_count INTEGER NOT NULL DEFAULT 0;
