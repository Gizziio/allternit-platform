-- Cache-hit accounting + caching analytics (task G11).
--
-- 1. llm_context_caches.hits / last_used_at: incremented (fire-and-forget) by
--    the gateway each time a chat-completion request resolves the cache via
--    `context_cache_id`. Lifetime counters, not period-scoped.
-- 2. prompt_cache.hits / last_used_at: same shape for the cousin prompt cache
--    (/v1/cache/prompts). NOTE: the prompt cache currently has NO in-proxy
--    read path (cache.rs `resolve_cache_entry` has no production callers), so
--    nothing increments these yet — the columns exist so a future read path
--    (or the storage API itself) can record hits without another migration.
--    prompt_cache is created lazily by cache.rs `ensure_tables`, so this
--    migration materializes it first (no-op where it already exists) before
--    the ALTERs — that keeps the ALTER valid on both fresh and existing DBs.
--    prompt_cache timestamps are INTEGER unix seconds, hence the INTEGER
--    last_used_at here (llm_context_caches uses DATETIME strings).
-- 3. llm_usage_events.context_cache_id: set on every usage row whose request
--    referenced a context cache, making cache-attributed spend visible in
--    /gateway/logs and aggregable in /gateway/caching.

ALTER TABLE llm_context_caches ADD COLUMN hits INTEGER NOT NULL DEFAULT 0;
ALTER TABLE llm_context_caches ADD COLUMN last_used_at DATETIME;

CREATE TABLE IF NOT EXISTS prompt_cache (
    id TEXT PRIMARY KEY,
    content_hash TEXT NOT NULL,
    content TEXT NOT NULL,
    name TEXT,
    tokens INTEGER NOT NULL,
    created_at INTEGER NOT NULL,
    expires_at INTEGER NOT NULL,
    metadata_json TEXT,
    tenant_id TEXT
);
ALTER TABLE prompt_cache ADD COLUMN hits INTEGER NOT NULL DEFAULT 0;
ALTER TABLE prompt_cache ADD COLUMN last_used_at INTEGER;

ALTER TABLE llm_usage_events ADD COLUMN context_cache_id TEXT;
CREATE INDEX IF NOT EXISTS idx_llm_usage_events_context_cache
    ON llm_usage_events(context_cache_id);
