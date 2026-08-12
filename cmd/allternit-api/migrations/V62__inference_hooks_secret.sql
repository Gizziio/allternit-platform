-- Per-organization inference hook signing secret.
ALTER TABLE llm_inference_hooks ADD COLUMN hook_secret TEXT;
