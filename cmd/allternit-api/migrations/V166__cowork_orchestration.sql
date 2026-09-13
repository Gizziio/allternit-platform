-- ── Al orchestration loop v0.1 (task A-T3; AL_IMPLEMENTATION_SPEC §7) ────────
-- Deterministic delegation policy: first matching rule (by priority) on the
-- action-type prefix picks the target principal for intents aimed at Al.
CREATE TABLE IF NOT EXISTS cowork_delegation_rules (
    workspace       TEXT NOT NULL,
    action_type     TEXT NOT NULL,
    target_principal TEXT NOT NULL,
    priority        INTEGER NOT NULL DEFAULT 100,
    created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (workspace, action_type)
);

-- Orchestration state on intents: the orchestrator records the child run it
-- delegated to and its own progress (pending → delegated → completed/failed/rejected).
ALTER TABLE cowork_intents ADD COLUMN child_run_id TEXT;
ALTER TABLE cowork_intents ADD COLUMN orchestration_status TEXT NOT NULL DEFAULT 'pending';

-- Default v0.1 policy: technical work goes to Gizzi.
INSERT OR IGNORE INTO cowork_delegation_rules (workspace, action_type, target_principal, priority)
SELECT DISTINCT workspace_id, 'shell', 'gizzi', 100 FROM cowork_runs;
INSERT OR IGNORE INTO cowork_delegation_rules (workspace, action_type, target_principal, priority)
SELECT DISTINCT workspace_id, 'agent_run', 'gizzi', 100 FROM cowork_runs;
INSERT OR IGNORE INTO cowork_delegation_rules (workspace, action_type, target_principal, priority)
SELECT DISTINCT workspace_id, 'team_execute', 'gizzi', 100 FROM cowork_runs;
