-- Inference usage accounting (Phase B metering).
--
-- One row per settled chat completion (streaming or not) — written ALWAYS,
-- even when no credit deduction happens (plan-cap users without a user_credits
-- row are recorded only; enforcement comes via plan caps). This is the audit
-- trail behind the 'inference' credit_transactions ledger entries.
--
-- estimated marks rows whose token counts were approximated (chars/4) because
-- the upstream reported no usage object; wholesale_cost_usd is our upstream
-- cost when live pricing was available, NULL when the static catalog priced
-- the request.

CREATE TABLE IF NOT EXISTS inference_usage (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    model TEXT NOT NULL,
    prompt_tokens BIGINT NOT NULL,
    completion_tokens BIGINT NOT NULL,
    cost_usd REAL NOT NULL,
    wholesale_cost_usd REAL,
    estimated INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_inference_usage_user
    ON inference_usage(user_id, created_at);
