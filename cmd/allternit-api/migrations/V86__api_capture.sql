-- HAR-derived API capture persistence.
CREATE TABLE IF NOT EXISTS api_capture_sessions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    domain TEXT NOT NULL,
    source TEXT NOT NULL,
    status TEXT NOT NULL,
    started_at TEXT NOT NULL,
    ended_at TEXT,
    har_json TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_api_capture_sessions_user_id ON api_capture_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_api_capture_sessions_domain ON api_capture_sessions(domain);

CREATE TABLE IF NOT EXISTS api_capture_contracts (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    domain TEXT NOT NULL,
    source TEXT NOT NULL,
    derived_at TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_api_capture_contracts_user_id ON api_capture_contracts(user_id);
CREATE INDEX IF NOT EXISTS idx_api_capture_contracts_domain ON api_capture_contracts(domain);

CREATE TABLE IF NOT EXISTS api_capture_endpoints (
    id TEXT PRIMARY KEY,
    contract_id TEXT NOT NULL,
    method TEXT NOT NULL,
    url TEXT NOT NULL,
    host TEXT NOT NULL,
    path TEXT NOT NULL,
    path_template TEXT NOT NULL,
    summary TEXT,
    query_params_json TEXT NOT NULL,
    path_params_json TEXT NOT NULL,
    headers_json TEXT NOT NULL,
    body_template TEXT,
    body_mime_type TEXT,
    body_params_json TEXT NOT NULL,
    status_code INTEGER NOT NULL,
    response_sample TEXT,
    hit_count INTEGER NOT NULL DEFAULT 1,
    FOREIGN KEY (contract_id) REFERENCES api_capture_contracts(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_api_capture_endpoints_contract_id ON api_capture_endpoints(contract_id);
