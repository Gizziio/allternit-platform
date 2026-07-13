-- V18: persisted state for the Agent Operations settings surface.
CREATE TABLE IF NOT EXISTS agent_evaluations (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    name TEXT NOT NULL,
    target TEXT NOT NULL,
    dataset TEXT,
    status TEXT NOT NULL DEFAULT 'pending',
    score INTEGER NOT NULL DEFAULT 0,
    last_run TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_agent_evaluations_user ON agent_evaluations(user_id, created_at);

CREATE TABLE IF NOT EXISTS agent_evaluation_runs (
    id TEXT PRIMARY KEY,
    evaluation_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    status TEXT NOT NULL,
    score INTEGER NOT NULL,
    total INTEGER NOT NULL,
    passed INTEGER NOT NULL,
    failed INTEGER NOT NULL,
    skipped INTEGER NOT NULL,
    duration_ms INTEGER NOT NULL,
    details TEXT NOT NULL,
    created_at TEXT NOT NULL,
    FOREIGN KEY(evaluation_id) REFERENCES agent_evaluations(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_agent_evaluation_runs_eval ON agent_evaluation_runs(evaluation_id, created_at);

CREATE TABLE IF NOT EXISTS factory_tasks (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    spec_ref TEXT NOT NULL,
    requirements TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending_approval',
    progress INTEGER NOT NULL DEFAULT 95,
    created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_factory_tasks_user ON factory_tasks(user_id, created_at);

CREATE TABLE IF NOT EXISTS factory_changes (
    id TEXT NOT NULL,
    task_id TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    created_at TEXT NOT NULL,
    decided_at TEXT,
    PRIMARY KEY(task_id, id),
    FOREIGN KEY(task_id) REFERENCES factory_tasks(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS gc_policies (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    enabled INTEGER NOT NULL DEFAULT 1,
    threshold REAL NOT NULL,
    description TEXT
);

INSERT OR IGNORE INTO gc_policies (id, name, enabled, threshold, description) VALUES
('duplicate_detector', 'Duplicate Detector', 1, 0.80, 'Finds duplicate code using AST analysis'),
('boundary_type_checker', 'Boundary Type Checker', 1, 0.75, 'Checks for untyped boundaries (unwrap, expect)'),
('dependency_validator', 'Dependency Validator', 1, 0.85, 'Validates layer dependency directions'),
('observability_checker', 'Observability Checker', 1, 0.70, 'Finds missing tracing and logging'),
('documentation_sync', 'Documentation Sync', 1, 0.65, 'Detects spec vs implementation drift'),
('test_coverage_checker', 'Test Coverage Checker', 1, 0.80, 'Identifies test coverage gaps');

CREATE TABLE IF NOT EXISTS gc_runs (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    agent_name TEXT,
    agents_run INTEGER NOT NULL,
    issues_found INTEGER NOT NULL,
    issues_fixed INTEGER NOT NULL,
    entropy_reduction REAL NOT NULL,
    issues TEXT NOT NULL,
    executed_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_gc_runs_user ON gc_runs(user_id, executed_at);
