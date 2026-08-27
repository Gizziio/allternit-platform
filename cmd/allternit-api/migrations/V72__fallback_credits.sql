-- Fallback credit policy and ledger.
--
-- The gateway already sends a cross-provider fallback chain to Gizzi and records
-- `fallback_from` on usage events. This migration adds the policy controls and
-- the credit ledger used to credit customers when the primary model fails or
-- refuses and a fallback model succeeds.

CREATE TABLE IF NOT EXISTS fallback_credit_policies (
    org_id                TEXT PRIMARY KEY REFERENCES organizations(id) ON DELETE CASCADE,
    enabled               INTEGER NOT NULL DEFAULT 1,
    -- JSON array of llm_usage_events.status values that qualify for credit.
    eligible_statuses     TEXT NOT NULL DEFAULT '["refusal","error"]',
    -- Maximum percent of the original event cost that can be credited (0-100).
    max_credit_percent    INTEGER NOT NULL DEFAULT 100,
    -- Look-back/look-ahead window for matching a fallback event, in hours.
    credit_window_hours   INTEGER NOT NULL DEFAULT 24,
    -- When true, credits are applied to current_month_spend automatically.
    auto_apply            INTEGER NOT NULL DEFAULT 0,
    created_at            DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at            DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS fallback_credit_ledger (
    id                    TEXT PRIMARY KEY,
    org_id                TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    original_event_id     TEXT NOT NULL REFERENCES llm_usage_events(id) ON DELETE CASCADE,
    fallback_event_id     TEXT REFERENCES llm_usage_events(id) ON DELETE SET NULL,
    amount_microdollars   INTEGER NOT NULL,
    reason                TEXT NOT NULL,
    status                TEXT NOT NULL DEFAULT 'pending',
    created_at            DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    applied_at            DATETIME
);

CREATE INDEX IF NOT EXISTS idx_fallback_credit_ledger_org
    ON fallback_credit_ledger(org_id, created_at);
CREATE INDEX IF NOT EXISTS idx_fallback_credit_ledger_original
    ON fallback_credit_ledger(original_event_id);

-- Optional exact event-level link from a fallback usage event back to the
-- original failed event. The existing `fallback_from` text column is kept for
-- provider/model provenance.
ALTER TABLE llm_usage_events ADD COLUMN fallback_from_event_id TEXT
    REFERENCES llm_usage_events(id) ON DELETE SET NULL;
