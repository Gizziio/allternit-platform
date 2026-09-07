-- Enable upsert semantics for memory embeddings per (user, target_type, target_id).
CREATE UNIQUE INDEX IF NOT EXISTS idx_memory_embeddings_user_target
    ON memory_embeddings(user_id, target_type, target_id);
