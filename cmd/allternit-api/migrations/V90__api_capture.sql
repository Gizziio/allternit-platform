-- HAR-derived API capture persistence.
-- Stores capture sessions, derived contracts, and templated endpoints.
CREATE TABLE IF NOT EXISTS har_capture_sessions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    domain TEXT,
    source TEXT,
    status TEXT NOT NULL DEFAULT 'active',
    started_at TEXT NOT NULL,
    ended_at TEXT,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS har_api_contracts (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    domain TEXT NOT NULL,
    source TEXT,
    derived_at TEXT NOT NULL,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS har_api_endpoints (
    id TEXT PRIMARY KEY,
    contract_id TEXT NOT NULL,
    method TEXT NOT NULL,
    url TEXT NOT NULL,
    host TEXT,
    path TEXT,
    path_template TEXT,
    summary TEXT,
    query_params TEXT,
    path_params TEXT,
    headers TEXT,
    body_template TEXT,
    body_mime_type TEXT,
    body_params TEXT,
    status_code INTEGER,
    response_sample TEXT,
    hit_count INTEGER NOT NULL DEFAULT 1,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (contract_id) REFERENCES har_api_contracts(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_har_capture_sessions_user_id
    ON har_capture_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_har_api_contracts_user_id
    ON har_api_contracts(user_id);
CREATE INDEX IF NOT EXISTS idx_har_api_endpoints_contract_id
    ON har_api_endpoints(contract_id);
