-- ============================================================================
-- Performance Indexes for Common Query Patterns
-- ============================================================================

-- Events table: composite index for event streaming (run_id + created_at)
-- Used by: SSE streaming endpoint for efficient cursor-based queries
CREATE INDEX IF NOT EXISTS idx_events_run_created ON events(run_id, created_at);

-- Events table: composite index for event type filtering within a run
-- Used by: Event replay with type filters
CREATE INDEX IF NOT EXISTS idx_events_run_type ON events(run_id, event_type);

-- Jobs table: composite index for finding jobs by run and status
-- Used by: Job queue processing, status monitoring
CREATE INDEX IF NOT EXISTS idx_jobs_run_status ON jobs(run_id, status);

-- Jobs table: index for scheduled jobs query
-- Used by: Scheduler to find jobs ready to run
CREATE INDEX IF NOT EXISTS idx_jobs_scheduled ON jobs(scheduled_at) 
    WHERE scheduled_at IS NOT NULL AND status = 'pending';

-- Checkpoints table: index for listing checkpoints in order
-- Used by: Checkpoint listing API
CREATE INDEX IF NOT EXISTS idx_checkpoints_created ON checkpoints(run_id, created_at DESC);

-- Runs table: composite index for tenant-scoped queries
-- Used by: Multi-tenant run listings
CREATE INDEX IF NOT EXISTS idx_runs_tenant_status ON runs(tenant_id, status, created_at DESC);

-- Attachments table: index for finding active attachments
-- Used by: Session manager cleanup, heartbeat queries
CREATE INDEX IF NOT EXISTS idx_attachments_active ON attachments(run_id, detached_at) 
    WHERE detached_at IS NULL;

-- Approval requests: index for pending approvals by run
-- Used by: Approval polling, run status checks
CREATE INDEX IF NOT EXISTS idx_approvals_run_pending ON approval_requests(run_id, created_at DESC) 
    WHERE status = 'pending';

-- API Tokens: index for valid token lookup (used by auth middleware)
-- Used by: Every authenticated request
CREATE INDEX IF NOT EXISTS idx_api_tokens_valid ON api_tokens(token_hash, is_revoked, expires_at) 
    WHERE is_revoked = FALSE;

-- Audit log: composite index for user activity queries
-- Used by: User activity dashboards, compliance reports
CREATE INDEX IF NOT EXISTS idx_audit_user_time ON audit_log(user_id, timestamp DESC);

-- Analyze tables to update query planner statistics
ANALYZE runs;
ANALYZE jobs;
ANALYZE events;
ANALYZE attachments;
ANALYZE checkpoints;
ANALYZE approval_requests;
