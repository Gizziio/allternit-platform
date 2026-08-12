-- Outcome rubrics: reusable evaluation criteria for scoring agent runs.
CREATE TABLE IF NOT EXISTS outcome_rubrics (
    id              TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL,
    name            TEXT NOT NULL,
    description     TEXT,
    criteria        TEXT NOT NULL, -- JSON array of criterion objects
    created_by      TEXT NOT NULL,
    created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_outcome_rubrics_org
    ON outcome_rubrics(organization_id);

-- Rubric scores: evaluation results for a specific run/session against a rubric.
CREATE TABLE IF NOT EXISTS outcome_rubric_scores (
    id              TEXT PRIMARY KEY,
    rubric_id       TEXT NOT NULL,
    run_id          TEXT,
    session_id      TEXT,
    scores          TEXT NOT NULL, -- JSON array of {criterion_id, value, comment}
    total_score     REAL,
    created_by      TEXT NOT NULL,
    created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (rubric_id) REFERENCES outcome_rubrics(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_outcome_rubric_scores_rubric
    ON outcome_rubric_scores(rubric_id);
CREATE INDEX IF NOT EXISTS idx_outcome_rubric_scores_run
    ON outcome_rubric_scores(run_id);
CREATE INDEX IF NOT EXISTS idx_outcome_rubric_scores_session
    ON outcome_rubric_scores(session_id);
