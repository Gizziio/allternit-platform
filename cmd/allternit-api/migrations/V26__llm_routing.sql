-- Routing-policy scoring transparency (B5) and DLP rules (B6). All four
-- tables land together so later parts only add code, never migrations.

-- One row per routing decision: the candidates considered, the scores
-- assigned, the winner, and the policy rules that fired.
CREATE TABLE IF NOT EXISTS llm_routing_decisions (
    id             TEXT PRIMARY KEY,
    usage_event_id TEXT REFERENCES llm_usage_events(id) ON DELETE SET NULL,
    policy         TEXT,
    candidates     TEXT, -- JSON array of "provider/model"
    scores         TEXT, -- JSON object: candidate -> score breakdown
    winner         TEXT,
    rules_fired    TEXT, -- JSON array of rule names
    created_at     DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_llm_routing_decisions_event ON llm_routing_decisions(usage_event_id);

-- Published benchmark scores per model (seeded by B5, editable via admin API).
CREATE TABLE IF NOT EXISTS llm_benchmark_scores (
    model_id  TEXT NOT NULL,
    benchmark TEXT NOT NULL,
    score     REAL,
    source    TEXT,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (model_id, benchmark)
);

-- Tenant-defined routing policies: name -> benchmark weight map (JSON).
CREATE TABLE IF NOT EXISTS llm_routing_policies (
    id         TEXT PRIMARY KEY,
    tenant_id  TEXT,
    name       TEXT,
    weights    TEXT, -- JSON object: benchmark -> weight
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- DLP pattern rules (B6). action: 'block' | 'redact' | 'warn'.
CREATE TABLE IF NOT EXISTS llm_dlp_rules (
    id         TEXT PRIMARY KEY,
    tenant_id  TEXT,
    name       TEXT,
    pattern    TEXT,
    action     TEXT NOT NULL DEFAULT 'block',
    enabled    INTEGER NOT NULL DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
