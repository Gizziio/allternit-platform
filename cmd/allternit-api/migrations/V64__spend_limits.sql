-- Organization-level spend limits and increase-request workflow.
-- monthly_usd_cap is stored in USD cents. current_month_spend is stored in
-- microdollars to line up with llm_usage_events cost columns.

CREATE TABLE IF NOT EXISTS spend_limits (
    org_id                      TEXT PRIMARY KEY REFERENCES organizations(id) ON DELETE CASCADE,
    monthly_usd_cap             INTEGER NOT NULL DEFAULT 0, -- cents
    current_month_spend         INTEGER NOT NULL DEFAULT 0, -- microdollars
    increase_request_status     TEXT, -- 'pending' | 'approved' | 'rejected'
    increase_request_amount     INTEGER, -- cents
    increase_request_reason     TEXT,
    increase_request_created_at DATETIME,
    increase_request_updated_at DATETIME,
    created_at                  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at                  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_spend_limits_org ON spend_limits(org_id);
