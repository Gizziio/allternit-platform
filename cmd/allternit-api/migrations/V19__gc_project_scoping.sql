-- V19: scope GC configuration and history to a user's Cowork project.
ALTER TABLE cowork_projects ADD COLUMN git_remote TEXT;
ALTER TABLE cowork_projects ADD COLUMN default_branch TEXT;

ALTER TABLE gc_policies RENAME TO gc_policies_global;

CREATE TABLE gc_policies (
    project_id TEXT NOT NULL,
    id TEXT NOT NULL,
    name TEXT NOT NULL,
    enabled INTEGER NOT NULL DEFAULT 1,
    threshold REAL NOT NULL,
    description TEXT,
    PRIMARY KEY (project_id, id),
    FOREIGN KEY (project_id) REFERENCES cowork_projects(id) ON DELETE CASCADE
);
CREATE INDEX idx_gc_policies_project ON gc_policies(project_id);

-- Old global policies cannot be assigned safely to any tenant. Each project receives
-- the same defaults lazily through the authenticated route handlers.
DROP TABLE gc_policies_global;

ALTER TABLE gc_runs ADD COLUMN project_id TEXT;
CREATE INDEX idx_gc_runs_project ON gc_runs(project_id, executed_at);
