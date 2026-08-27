-- bb core entities migration
-- Adds project/thread/environment/host/event tables for bb-compatible agent IDE surface.

CREATE TABLE IF NOT EXISTS bb_hosts (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    host_type TEXT NOT NULL DEFAULT 'persistent',
    connect_machine_id TEXT,
    max_permission_mode TEXT NOT NULL DEFAULT 'full',
    destroyed_at INTEGER,
    last_seen_at INTEGER,
    last_rejected_protocol_version INTEGER,
    created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
    updated_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
);

CREATE INDEX IF NOT EXISTS bb_hosts_user_last_seen_idx ON bb_hosts(user_id, last_seen_at);

CREATE TABLE IF NOT EXISTS bb_projects (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    kind TEXT NOT NULL DEFAULT 'standard',
    name TEXT NOT NULL,
    git_remote_url TEXT,
    sort_key TEXT NOT NULL DEFAULT 'V',
    deleted_at INTEGER,
    created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
    updated_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
);

CREATE INDEX IF NOT EXISTS bb_projects_user_updated_idx ON bb_projects(user_id, updated_at);
CREATE INDEX IF NOT EXISTS bb_projects_user_deleted_idx ON bb_projects(user_id, deleted_at);
CREATE INDEX IF NOT EXISTS bb_projects_user_sort_idx ON bb_projects(user_id, sort_key, id);
CREATE UNIQUE INDEX IF NOT EXISTS bb_projects_personal_singleton_idx ON bb_projects(user_id, kind) WHERE kind = 'personal';

CREATE TABLE IF NOT EXISTS bb_project_execution_defaults (
    project_id TEXT PRIMARY KEY REFERENCES bb_projects(id) ON DELETE CASCADE,
    provider_id TEXT NOT NULL,
    model TEXT NOT NULL,
    service_tier TEXT NOT NULL DEFAULT 'default',
    reasoning_level TEXT,
    permission_mode TEXT NOT NULL DEFAULT 'full',
    updated_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
);

CREATE TABLE IF NOT EXISTS bb_project_sources (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL REFERENCES bb_projects(id) ON DELETE CASCADE,
    source_type TEXT NOT NULL DEFAULT 'local_path',
    host_id TEXT NOT NULL REFERENCES bb_hosts(id) ON DELETE CASCADE,
    path TEXT,
    is_default INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
    updated_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
    UNIQUE(project_id, host_id),
    UNIQUE(project_id, is_default) WHERE is_default = 1,
    CHECK(source_type = 'local_path' AND host_id IS NOT NULL AND path IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS bb_project_sources_project_idx ON bb_project_sources(project_id);
CREATE INDEX IF NOT EXISTS bb_project_sources_host_idx ON bb_project_sources(host_id);

CREATE TABLE IF NOT EXISTS bb_environments (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL REFERENCES bb_projects(id) ON DELETE CASCADE,
    host_id TEXT NOT NULL REFERENCES bb_hosts(id) ON DELETE CASCADE,
    name TEXT,
    path TEXT,
    managed INTEGER NOT NULL DEFAULT 0,
    is_git_repo INTEGER NOT NULL DEFAULT 0,
    is_worktree INTEGER NOT NULL DEFAULT 0,
    branch_name TEXT,
    base_branch TEXT,
    default_branch TEXT,
    merge_base_branch TEXT,
    destroy_attempt_id TEXT,
    retire_requested_at INTEGER,
    workspace_provision_type TEXT NOT NULL DEFAULT 'unmanaged',
    status TEXT NOT NULL DEFAULT 'provisioning',
    created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
    updated_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
    UNIQUE(project_id, host_id, path)
);

CREATE INDEX IF NOT EXISTS bb_environments_project_idx ON bb_environments(project_id);
CREATE INDEX IF NOT EXISTS bb_environments_host_path_lookup_idx ON bb_environments(host_id, path);
CREATE INDEX IF NOT EXISTS bb_environments_status_idx ON bb_environments(status);

CREATE TABLE IF NOT EXISTS bb_thread_sections (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
    updated_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
    UNIQUE(user_id, name)
);

CREATE TABLE IF NOT EXISTS bb_threads (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL REFERENCES bb_projects(id) ON DELETE CASCADE,
    environment_id TEXT REFERENCES bb_environments(id) ON DELETE SET NULL,
    provider_id TEXT NOT NULL,
    model_override TEXT,
    reasoning_level_override TEXT,
    title TEXT,
    title_fallback TEXT,
    section_id TEXT REFERENCES bb_thread_sections(id) ON DELETE SET NULL,
    status TEXT NOT NULL DEFAULT 'starting',
    parent_thread_id TEXT REFERENCES bb_threads(id) ON DELETE SET NULL,
    source_thread_id TEXT REFERENCES bb_threads(id) ON DELETE SET NULL,
    origin_kind TEXT,
    origin_plugin_id TEXT,
    visibility TEXT NOT NULL DEFAULT 'visible',
    archived_at INTEGER,
    pinned_at INTEGER,
    pin_sort_key TEXT,
    deleted_at INTEGER,
    last_read_at INTEGER,
    latest_attention_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
    created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
    updated_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
);

CREATE INDEX IF NOT EXISTS bb_threads_project_updated_idx ON bb_threads(project_id, updated_at);
CREATE INDEX IF NOT EXISTS bb_threads_project_archived_deleted_idx ON bb_threads(project_id, archived_at, deleted_at);
CREATE INDEX IF NOT EXISTS bb_threads_environment_idx ON bb_threads(environment_id);
CREATE INDEX IF NOT EXISTS bb_threads_parent_idx ON bb_threads(parent_thread_id);
CREATE INDEX IF NOT EXISTS bb_threads_section_archived_deleted_idx ON bb_threads(section_id, archived_at, deleted_at);
CREATE INDEX IF NOT EXISTS bb_threads_environment_archived_deleted_idx ON bb_threads(environment_id, archived_at, deleted_at);
CREATE INDEX IF NOT EXISTS bb_threads_active_maintenance_idx ON bb_threads(deleted_at) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS bb_threads_pin_sort_idx ON bb_threads(pin_sort_key) WHERE pinned_at IS NOT NULL;

CREATE TABLE IF NOT EXISTS bb_events (
    id TEXT PRIMARY KEY,
    thread_id TEXT NOT NULL REFERENCES bb_threads(id) ON DELETE CASCADE,
    environment_id TEXT REFERENCES bb_environments(id) ON DELETE SET NULL,
    scope_kind TEXT NOT NULL,
    turn_id TEXT,
    provider_thread_id TEXT,
    sequence INTEGER NOT NULL,
    event_type TEXT NOT NULL,
    item_id TEXT,
    item_kind TEXT,
    parent_tool_call_id TEXT,
    data TEXT NOT NULL DEFAULT '{}',
    created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
);

CREATE UNIQUE INDEX IF NOT EXISTS bb_events_thread_sequence_idx ON bb_events(thread_id, sequence);
CREATE INDEX IF NOT EXISTS bb_events_environment_idx ON bb_events(environment_id);
CREATE INDEX IF NOT EXISTS bb_events_thread_type_sequence_idx ON bb_events(thread_id, event_type, sequence);
CREATE INDEX IF NOT EXISTS bb_events_thread_turn_type_item_sequence_idx ON bb_events(thread_id, turn_id, event_type, item_kind, sequence);
CREATE INDEX IF NOT EXISTS bb_events_parent_tool_call_thread_parent_sequence_idx ON bb_events(thread_id, parent_tool_call_id, sequence) WHERE parent_tool_call_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS bb_events_item_lifecycle_thread_item_sequence_idx ON bb_events(thread_id, item_id, sequence) WHERE item_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS bb_prompt_history_entries (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL REFERENCES bb_projects(id) ON DELETE CASCADE,
    thread_id TEXT NOT NULL REFERENCES bb_threads(id) ON DELETE CASCADE,
    scope TEXT NOT NULL,
    request_sequence INTEGER NOT NULL,
    input TEXT NOT NULL,
    created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
    UNIQUE(thread_id, request_sequence)
);

CREATE INDEX IF NOT EXISTS bb_prompt_history_project_scope_idx ON bb_prompt_history_entries(project_id, scope, created_at, request_sequence, id);

CREATE TABLE IF NOT EXISTS bb_queued_thread_messages (
    id TEXT PRIMARY KEY,
    thread_id TEXT NOT NULL REFERENCES bb_threads(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    sender_thread_id TEXT REFERENCES bb_threads(id) ON DELETE SET NULL,
    model TEXT NOT NULL,
    reasoning_level TEXT NOT NULL,
    permission_mode TEXT NOT NULL,
    service_tier TEXT NOT NULL,
    group_with_next INTEGER NOT NULL DEFAULT 0,
    claimed_at INTEGER,
    claim_token TEXT,
    sort_key TEXT NOT NULL,
    created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
    updated_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
);

CREATE INDEX IF NOT EXISTS bb_queued_thread_messages_thread_created_idx ON bb_queued_thread_messages(thread_id, created_at, id);
CREATE INDEX IF NOT EXISTS bb_queued_thread_messages_thread_sort_idx ON bb_queued_thread_messages(thread_id, sort_key, id);

CREATE TABLE IF NOT EXISTS bb_host_daemon_sessions (
    id TEXT PRIMARY KEY,
    host_id TEXT NOT NULL REFERENCES bb_hosts(id) ON DELETE CASCADE,
    instance_id TEXT NOT NULL,
    host_name TEXT NOT NULL,
    host_type TEXT NOT NULL,
    data_dir TEXT NOT NULL,
    protocol_version INTEGER NOT NULL,
    heartbeat_interval_ms INTEGER NOT NULL,
    lease_timeout_ms INTEGER NOT NULL,
    status TEXT NOT NULL,
    lease_expires_at INTEGER NOT NULL,
    closed_at INTEGER,
    close_reason TEXT,
    created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
    updated_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
);

CREATE INDEX IF NOT EXISTS bb_host_daemon_sessions_host_status_idx ON bb_host_daemon_sessions(host_id, status);
CREATE INDEX IF NOT EXISTS bb_host_daemon_sessions_status_closed_idx ON bb_host_daemon_sessions(status, closed_at, id);
