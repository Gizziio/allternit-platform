-- References to per-app content included in a compliance request.

CREATE TABLE IF NOT EXISTS compliance_content_references (
    id           TEXT PRIMARY KEY,
    request_id   TEXT NOT NULL REFERENCES compliance_requests(id) ON DELETE CASCADE,
    app          TEXT NOT NULL CHECK (app IN ('chats', 'projects', 'artifacts')),
    record_id    TEXT NOT NULL,
    status       TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processed', 'failed')),
    processed_at DATETIME,
    created_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(request_id, app, record_id)
);
CREATE INDEX IF NOT EXISTS idx_compliance_refs_request ON compliance_content_references(request_id);
CREATE INDEX IF NOT EXISTS idx_compliance_refs_record ON compliance_content_references(app, record_id);
