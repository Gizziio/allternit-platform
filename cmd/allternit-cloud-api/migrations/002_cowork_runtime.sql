-- Cowork Runtime tables for A2R Control Plane
-- Provides run orchestration, job queue, scheduling, events, and checkpoints

-- Runs table: Core run lifecycle management
CREATE TABLE IF NOT EXISTS runs (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    
    -- Run mode: local (VM), remote (VPS), cloud (managed)
    mode TEXT NOT NULL CHECK (mode IN ('local', 'remote', 'cloud')),
    
    -- Current status in lifecycle
    status TEXT NOT NULL CHECK (status IN (
        'pending',      -- Created but not started
        'planning',     -- Planning execution steps
        'queued',       -- Waiting for execution slot
        'running',      -- Actively executing
        'paused',       -- Paused (approval needed or manual)
        'completed',    -- Successfully finished
        'failed',       -- Failed with error
        'cancelled'     -- Cancelled by user
    )),
    
    -- Current step position for resumability
    step_cursor TEXT,
    
    -- Total steps for progress tracking
    total_steps INTEGER,
    completed_steps INTEGER DEFAULT 0,
    
    -- Configuration (JSON)
    config JSON NOT NULL,
    
    -- Owner/tenant
    owner_id TEXT,
    tenant_id TEXT,
    
    -- Runtime association
    runtime_id TEXT,           -- local-vm-id, node-id, or cluster-id
    runtime_type TEXT CHECK (runtime_type IN ('local', 'remote', 'cloud')),
    
    -- Schedule association (if triggered by schedule)
    schedule_id TEXT,
    
    -- Timestamps
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    started_at TIMESTAMP,
    completed_at TIMESTAMP,
    
    -- Failure information
    error_message TEXT,
    error_details JSON
);

-- Jobs table: Individual jobs within a run
CREATE TABLE IF NOT EXISTS jobs (
    id TEXT PRIMARY KEY,
    run_id TEXT NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
    
    -- Job identification
    name TEXT NOT NULL,
    description TEXT,
    
    -- Job status
    status TEXT NOT NULL CHECK (status IN (
        'pending',
        'queued',
        'running',
        'completed',
        'failed',
        'cancelled',
        'retrying'
    )),
    
    -- Priority (higher = more urgent)
    priority INTEGER NOT NULL DEFAULT 0,
    
    -- Queue position when in queued state
    queue_position INTEGER,
    
    -- Configuration (command, args, env, etc.)
    config JSON NOT NULL,
    
    -- Scheduling
    scheduled_at TIMESTAMP,
    started_at TIMESTAMP,
    completed_at TIMESTAMP,
    
    -- Result
    exit_code INTEGER,
    result JSON,
    error_message TEXT,
    
    -- Retry tracking
    retry_count INTEGER DEFAULT 0,
    max_retries INTEGER DEFAULT 0,
    
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Schedules table: Cron/periodic job scheduling
CREATE TABLE IF NOT EXISTS schedules (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    
    -- Cron expression (e.g., "0 9 * * *")
    cron_expr TEXT NOT NULL,
    
    -- Natural language representation (e.g., "every day at 9am")
    natural_lang TEXT,
    
    -- Timezone for execution
    timezone TEXT DEFAULT 'UTC',
    
    -- Job template (JSON) - used to create jobs
    job_template JSON NOT NULL,
    
    -- Schedule status
    enabled BOOLEAN NOT NULL DEFAULT TRUE,
    
    -- Misfire policy: ignore, fire_once, fire_all
    misfire_policy TEXT DEFAULT 'fire_once' CHECK (misfire_policy IN ('ignore', 'fire_once', 'fire_all')),
    
    -- Tracking
    last_run_at TIMESTAMP,
    next_run_at TIMESTAMP,
    run_count INTEGER DEFAULT 0,
    misfire_count INTEGER DEFAULT 0,
    
    -- Owner/tenant
    owner_id TEXT,
    tenant_id TEXT,
    
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Events table: Append-only event ledger for runs
CREATE TABLE IF NOT EXISTS events (
    id TEXT PRIMARY KEY,
    run_id TEXT NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
    
    -- Sequence number for ordering (per-run)
    sequence INTEGER NOT NULL,
    
    -- Event type
    event_type TEXT NOT NULL CHECK (event_type IN (
        -- Lifecycle events
        'run_created',
        'run_started',
        'run_completed',
        'run_failed',
        'run_cancelled',
        'run_paused',
        'run_resumed',
        
        -- Step events
        'step_started',
        'step_completed',
        'step_failed',
        'step_skipped',
        
        -- Output events
        'stdout',
        'stderr',
        'output',
        
        -- Tool events
        'tool_call',
        'tool_result',
        
        -- Approval events
        'approval_needed',
        'approval_given',
        'approval_denied',
        'approval_timeout',
        
        -- Checkpoint events
        'checkpoint_created',
        'checkpoint_restored',
        
        -- Job events
        'job_queued',
        'job_started',
        'job_completed',
        'job_failed',
        'job_cancelled',
        
        -- System events
        'heartbeat',
        'warning',
        'error'
    )),
    
    -- Event payload (JSON)
    payload JSON NOT NULL,
    
    -- Client that produced this event (if any)
    source_client_id TEXT,
    source_client_type TEXT,
    
    -- Timestamp
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Attachments table: Multi-client attachment tracking
CREATE TABLE IF NOT EXISTS attachments (
    id TEXT PRIMARY KEY,
    run_id TEXT NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
    
    -- Client information
    client_id TEXT NOT NULL,
    client_type TEXT NOT NULL CHECK (client_type IN ('terminal', 'web', 'desktop', 'mobile', 'api')),
    
    -- User information
    user_id TEXT,
    
    -- Cursor position (last event seen by this client)
    cursor_sequence INTEGER DEFAULT 0,
    
    -- Timestamps
    attached_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    last_seen_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    detached_at TIMESTAMP,
    
    -- Unique constraint: one attachment per client per run
    UNIQUE(run_id, client_id)
);

-- Checkpoints table: Execution snapshots for recovery
CREATE TABLE IF NOT EXISTS checkpoints (
    id TEXT PRIMARY KEY,
    run_id TEXT NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
    
    -- Checkpoint metadata
    name TEXT,
    description TEXT,
    
    -- Execution position
    step_cursor TEXT NOT NULL,
    
    -- Workspace state (files, variables, etc.)
    workspace_state JSON,
    
    -- Approval state (pending approvals)
    approval_state JSON,
    
    -- Context at checkpoint time
    context JSON,
    
    -- Whether this checkpoint can be resumed from
    resumable BOOLEAN DEFAULT TRUE,
    
    -- Timestamps
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    restored_at TIMESTAMP
);

-- Indexes for common queries

-- Run queries
CREATE INDEX IF NOT EXISTS idx_runs_status ON runs(status);
CREATE INDEX IF NOT EXISTS idx_runs_mode ON runs(mode);
CREATE INDEX IF NOT EXISTS idx_runs_owner ON runs(owner_id);
CREATE INDEX IF NOT EXISTS idx_runs_schedule ON runs(schedule_id);
CREATE INDEX IF NOT EXISTS idx_runs_created_at ON runs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_runs_status_updated ON runs(status, updated_at);

-- Job queries
CREATE INDEX IF NOT EXISTS idx_jobs_run_id ON jobs(run_id);
CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs(status);
CREATE INDEX IF NOT EXISTS idx_jobs_priority ON jobs(priority DESC, created_at);
CREATE INDEX IF NOT EXISTS idx_jobs_queue ON jobs(status, priority DESC, created_at);

-- Schedule queries
CREATE INDEX IF NOT EXISTS idx_schedules_enabled ON schedules(enabled);
CREATE INDEX IF NOT EXISTS idx_schedules_next_run ON schedules(next_run_at) WHERE enabled = TRUE;

-- Event queries (critical for streaming performance)
CREATE INDEX IF NOT EXISTS idx_events_run_id ON events(run_id);
CREATE INDEX IF NOT EXISTS idx_events_run_sequence ON events(run_id, sequence);
CREATE INDEX IF NOT EXISTS idx_events_created_at ON events(created_at);
CREATE INDEX IF NOT EXISTS idx_events_type ON events(event_type);

-- Attachment queries
CREATE INDEX IF NOT EXISTS idx_attachments_run ON attachments(run_id);
CREATE INDEX IF NOT EXISTS idx_attachments_client ON attachments(client_id);
CREATE INDEX IF NOT EXISTS idx_attachments_last_seen ON attachments(last_seen_at);

-- Checkpoint queries
CREATE INDEX IF NOT EXISTS idx_checkpoints_run ON checkpoints(run_id);
CREATE INDEX IF NOT EXISTS idx_checkpoints_cursor ON checkpoints(run_id, step_cursor);

-- Trigger for updating updated_at timestamp on runs
CREATE TRIGGER IF NOT EXISTS update_runs_timestamp 
AFTER UPDATE ON runs
BEGIN
    UPDATE runs SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

-- Trigger for updating updated_at timestamp on jobs
CREATE TRIGGER IF NOT EXISTS update_jobs_timestamp 
AFTER UPDATE ON jobs
BEGIN
    UPDATE jobs SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

-- Trigger for updating updated_at timestamp on schedules
CREATE TRIGGER IF NOT EXISTS update_schedules_timestamp 
AFTER UPDATE ON schedules
BEGIN
    UPDATE schedules SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

-- ============================================================================
-- Approval System
-- ============================================================================

-- Approval requests table: Human-in-the-loop checkpoints
CREATE TABLE IF NOT EXISTS approval_requests (
    id TEXT PRIMARY KEY,
    run_id TEXT NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
    
    -- Execution position
    step_cursor TEXT,
    
    -- Status and priority
    status TEXT NOT NULL DEFAULT 'pending' 
        CHECK (status IN ('pending', 'approved', 'denied', 'timed_out', 'cancelled')),
    priority TEXT NOT NULL DEFAULT 'normal'
        CHECK (priority IN ('low', 'normal', 'high', 'critical')),
    
    -- Request details
    title TEXT NOT NULL,
    description TEXT,
    
    -- Action being requested
    action_type TEXT,
    action_params JSON,
    
    -- Reasoning from the agent
    reasoning TEXT,
    
    -- Who requested (if manual) and who responded
    requested_by TEXT,
    responded_by TEXT,
    
    -- Response details
    response_message TEXT,
    
    -- Timeout in seconds (NULL = no timeout)
    timeout_seconds INTEGER,
    
    -- Timestamps
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    responded_at TIMESTAMP
);

-- Approval request indexes
CREATE INDEX IF NOT EXISTS idx_approvals_run ON approval_requests(run_id);
CREATE INDEX IF NOT EXISTS idx_approvals_status ON approval_requests(status);
CREATE INDEX IF NOT EXISTS idx_approvals_created ON approval_requests(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_approvals_pending ON approval_requests(run_id, status) WHERE status = 'pending';
