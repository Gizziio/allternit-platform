-- Groundedness checks for hallucination reduction.
--
-- Scores how well a model response is grounded in a set of retrieved passages.
-- Supports token-overlap heuristics today and can be extended with embedding
-- cosine similarity or LLM-as-judge scores.

CREATE TABLE IF NOT EXISTS groundedness_checks (
    id              TEXT PRIMARY KEY,
    org_id          TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    response_text   TEXT NOT NULL,
    passages        TEXT NOT NULL, -- JSON array of {id, title, content, url}
    method          TEXT NOT NULL DEFAULT 'token_overlap',
    score           REAL,          -- 0.0 to 1.0
    status          TEXT NOT NULL DEFAULT 'pending',
    details         TEXT,          -- JSON with per-passage breakdown
    created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_groundedness_checks_org
    ON groundedness_checks(org_id, created_at);
