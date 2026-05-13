-- Baseline schema migration
-- Consolidates all tables and indexes from the original init_schema()
-- Columns previously added via ALTER TABLE are included directly.

-- ── Users ───────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
    id          TEXT PRIMARY KEY,
    email       TEXT UNIQUE,
    name        TEXT,
    avatar_url  TEXT,
    role        TEXT NOT NULL DEFAULT 'user',
    status      TEXT NOT NULL DEFAULT 'active',
    clerk_id    TEXT,
    created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at  DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- ── Conversations ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS conversations (
    id              TEXT PRIMARY KEY,
    created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
    title           TEXT,
    user_id         TEXT,
    parent_conversation_id TEXT,
    gizzi_session_id TEXT
);
CREATE INDEX IF NOT EXISTS idx_conversations_user ON conversations(user_id);

-- ── Conversation messages ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS conversation_messages (
    id               TEXT PRIMARY KEY,
    created_at       DATETIME DEFAULT CURRENT_TIMESTAMP,
    conversation_id  TEXT NOT NULL,
    role             TEXT NOT NULL,
    content          TEXT NOT NULL,
    parent_message_id TEXT,
    metadata         TEXT
);
CREATE INDEX IF NOT EXISTS idx_messages_conv ON conversation_messages(conversation_id);

-- ── Artifacts ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS artifacts (
    id          TEXT PRIMARY KEY,
    user_id     TEXT NOT NULL,
    workspace_id TEXT NOT NULL,
    title       TEXT NOT NULL,
    type        TEXT NOT NULL,
    status      TEXT NOT NULL DEFAULT 'draft',
    summary     TEXT,
    tags        TEXT,
    created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at  DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_artifacts_workspace ON artifacts(workspace_id);
CREATE INDEX IF NOT EXISTS idx_artifacts_status ON artifacts(status);

-- ── Artifact sections ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS artifact_sections (
    id          TEXT PRIMARY KEY,
    artifact_id TEXT NOT NULL,
    heading     TEXT NOT NULL,
    kind        TEXT NOT NULL,
    body        TEXT NOT NULL,
    position    INTEGER NOT NULL,
    created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at  DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- ── Artifact revisions ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS artifact_revisions (
    id          TEXT PRIMARY KEY,
    artifact_id TEXT NOT NULL,
    reason      TEXT NOT NULL,
    snapshot    TEXT NOT NULL,
    created_at  DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- ── Workspaces ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS workspaces (
    id          TEXT PRIMARY KEY,
    name        TEXT NOT NULL,
    slug        TEXT UNIQUE NOT NULL,
    owner_id    TEXT NOT NULL,
    description TEXT,
    created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at  DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- ── Workspace members ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS workspace_members (
    id          TEXT PRIMARY KEY,
    workspace_id TEXT NOT NULL,
    user_id     TEXT,
    agent_id    TEXT,
    role        TEXT NOT NULL DEFAULT 'member',
    joined_at   DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- ── Replies ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS replies (
    id              TEXT PRIMARY KEY,
    conversation_id TEXT NOT NULL,
    status          TEXT NOT NULL DEFAULT 'streaming',
    content         TEXT,
    created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at      DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_replies_conv ON replies(conversation_id);

-- ── Agent sessions ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS agent_sessions (
    id            TEXT PRIMARY KEY,
    name          TEXT,
    agent_id      TEXT NOT NULL,
    agent_name    TEXT NOT NULL,
    runtime_model TEXT NOT NULL,
    origin_surface TEXT DEFAULT 'remote-agents-api',
    session_mode  TEXT DEFAULT 'chat',
    metadata      TEXT,
    created_at    DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at    DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- ── Inbox ───────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS inbox_items (
    id         TEXT PRIMARY KEY,
    user_id    TEXT NOT NULL,
    agent_id   TEXT,
    type       TEXT NOT NULL,
    title      TEXT NOT NULL,
    body       TEXT,
    severity   TEXT NOT NULL DEFAULT 'info',
    status     TEXT NOT NULL DEFAULT 'unread',
    action_url TEXT,
    metadata   TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_inbox_user ON inbox_items(user_id);
CREATE INDEX IF NOT EXISTS idx_inbox_status ON inbox_items(status);

-- ── Memory documents ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS memory_documents (
    id          TEXT PRIMARY KEY,
    user_id     TEXT NOT NULL,
    agent_id    TEXT,
    title       TEXT NOT NULL,
    content     TEXT,
    source_type TEXT NOT NULL DEFAULT 'upload',
    source_url  TEXT,
    chunk_count INTEGER NOT NULL DEFAULT 0,
    is_indexed  INTEGER NOT NULL DEFAULT 0,
    created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at  DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_memory_docs_user ON memory_documents(user_id);

-- ── Memory events ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS memory_events (
    id         TEXT PRIMARY KEY,
    user_id    TEXT NOT NULL,
    agent_id   TEXT,
    type       TEXT NOT NULL,
    payload    TEXT,
    source     TEXT NOT NULL DEFAULT 'user',
    timestamp  DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_memory_events_user ON memory_events(user_id);

-- ── Workflows ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS workflows (
    id          TEXT PRIMARY KEY,
    user_id     TEXT,
    title       TEXT NOT NULL,
    description TEXT,
    nodes       TEXT,
    edges       TEXT,
    created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at  DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- ── SSH connections ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ssh_connections (
    id                TEXT PRIMARY KEY,
    user_id           TEXT,
    name              TEXT NOT NULL,
    host              TEXT NOT NULL,
    port              INTEGER NOT NULL DEFAULT 22,
    username          TEXT NOT NULL,
    auth_type         TEXT NOT NULL DEFAULT 'password',
    encrypted_private_key TEXT,
    encrypted_password    TEXT,
    status            TEXT NOT NULL DEFAULT 'disconnected',
    os                TEXT,
    architecture      TEXT,
    docker_installed  INTEGER DEFAULT 0,
    allternit_installed INTEGER DEFAULT 0,
    allternit_version TEXT,
    last_connected_at DATETIME,
    created_at        DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at        DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- ── Board items ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS board_items (
    id                TEXT PRIMARY KEY,
    workspace_id      TEXT NOT NULL,
    title             TEXT NOT NULL,
    description       TEXT,
    status            TEXT NOT NULL DEFAULT 'backlog',
    priority          INTEGER DEFAULT 0,
    labels            TEXT,
    estimated_minutes INTEGER,
    deadline          DATETIME,
    dependencies      TEXT,
    reporter_id       TEXT,
    assignee_id       TEXT,
    created_at        DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at        DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_board_items_workspace ON board_items(workspace_id);

-- ── Board comments ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS board_comments (
    id          TEXT PRIMARY KEY,
    item_id     TEXT NOT NULL,
    author_type TEXT NOT NULL,
    author_id   TEXT NOT NULL,
    body        TEXT NOT NULL,
    created_at  DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_board_comments_item ON board_comments(item_id);

-- ── MCP connectors ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS mcp_connectors (
    id               TEXT PRIMARY KEY,
    user_id          TEXT,
    name             TEXT NOT NULL,
    name_id          TEXT NOT NULL,
    url              TEXT NOT NULL,
    type             TEXT NOT NULL DEFAULT 'http',
    oauth_client_id  TEXT,
    oauth_client_secret TEXT,
    enabled          INTEGER NOT NULL DEFAULT 1,
    created_at       DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at       DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_mcp_connectors_user ON mcp_connectors(user_id);

-- ── MCP OAuth sessions ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS mcp_oauth_sessions (
    id                TEXT PRIMARY KEY,
    mcp_connector_id  TEXT NOT NULL,
    state             TEXT NOT NULL UNIQUE,
    code_verifier     TEXT,
    client_info       TEXT,
    tokens            TEXT,
    metadata          TEXT,
    is_authenticated  INTEGER NOT NULL DEFAULT 0,
    created_at        DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at        DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_mcp_oauth_state ON mcp_oauth_sessions(state);

-- ── Tasks ───────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS tasks (
    id          TEXT PRIMARY KEY,
    user_id     TEXT NOT NULL,
    workspace_id TEXT,
    title       TEXT NOT NULL,
    description TEXT,
    status      TEXT NOT NULL DEFAULT 'todo',
    priority    TEXT NOT NULL DEFAULT 'medium',
    assignee_id TEXT,
    due_date    DATETIME,
    tags        TEXT,
    metadata    TEXT,
    created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at  DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_tasks_user ON tasks(user_id);
CREATE INDEX IF NOT EXISTS idx_tasks_workspace ON tasks(workspace_id);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);

-- ── Agents ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS agents (
    id             TEXT PRIMARY KEY,
    user_id        TEXT NOT NULL,
    name           TEXT NOT NULL,
    description    TEXT,
    type           TEXT NOT NULL DEFAULT 'worker',
    parent_agent_id TEXT,
    model          TEXT NOT NULL,
    provider       TEXT NOT NULL,
    capabilities   TEXT,
    system_prompt  TEXT,
    tools          TEXT,
    max_iterations INTEGER NOT NULL DEFAULT 10,
    temperature    REAL NOT NULL DEFAULT 0.7,
    config         TEXT,
    status         TEXT NOT NULL DEFAULT 'idle',
    workspace_id   TEXT,
    avatar         TEXT,
    identity_key   TEXT,
    created_at     DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at     DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_run_at    DATETIME
);
CREATE INDEX IF NOT EXISTS idx_agents_user ON agents(user_id);
CREATE INDEX IF NOT EXISTS idx_agents_status ON agents(status);
CREATE INDEX IF NOT EXISTS idx_agents_workspace ON agents(workspace_id);

-- ── Workflow executions ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS workflow_executions (
    id           TEXT PRIMARY KEY,
    workflow_id  TEXT NOT NULL,
    status       TEXT NOT NULL DEFAULT 'pending',
    started_at   DATETIME,
    completed_at DATETIME,
    result       TEXT,
    error        TEXT,
    created_at   DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at   DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_wf_exec_workflow ON workflow_executions(workflow_id);
CREATE INDEX IF NOT EXISTS idx_wf_exec_status ON workflow_executions(status);

-- ── Agent runtimes ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS agent_runtimes (
    id             TEXT PRIMARY KEY,
    name           TEXT NOT NULL,
    host           TEXT NOT NULL,
    agent_clis     TEXT,
    status         TEXT NOT NULL DEFAULT 'offline',
    last_heartbeat DATETIME,
    workspace_id   TEXT,
    created_at     DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at     DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_runtimes_workspace ON agent_runtimes(workspace_id);
CREATE INDEX IF NOT EXISTS idx_runtimes_status ON agent_runtimes(status);

-- ── Remote backend targets ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS remote_backend_targets (
    id                      TEXT PRIMARY KEY,
    user_id                 TEXT NOT NULL,
    ssh_connection_id       TEXT UNIQUE,
    name                    TEXT NOT NULL,
    status                  TEXT NOT NULL DEFAULT 'disconnected',
    install_state           TEXT NOT NULL DEFAULT 'unknown',
    backend_url             TEXT,
    gateway_url             TEXT,
    gateway_ws_url          TEXT,
    encrypted_gateway_token TEXT,
    installed_version       TEXT,
    supported_client_range  TEXT,
    last_verified_at        DATETIME,
    last_heartbeat_at       DATETIME,
    last_error              TEXT,
    created_at              DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at              DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_rbt_user ON remote_backend_targets(user_id);
CREATE INDEX IF NOT EXISTS idx_rbt_status ON remote_backend_targets(status);

-- ── User backend preferences ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS user_backend_preferences (
    id                           TEXT PRIMARY KEY,
    user_id                      TEXT UNIQUE NOT NULL,
    org_id                       TEXT,
    mode                         TEXT NOT NULL DEFAULT 'local',
    fallback_mode                TEXT NOT NULL DEFAULT 'local',
    execution_mode               TEXT NOT NULL DEFAULT 'auto',
    execution_mode_updated_at    DATETIME DEFAULT CURRENT_TIMESTAMP,
    active_remote_backend_target_id TEXT,
    created_at                   DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at                   DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_ubp_active_target ON user_backend_preferences(active_remote_backend_target_id);

-- ── SSH keys ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ssh_keys (
    id          TEXT PRIMARY KEY,
    user_id     TEXT NOT NULL,
    name        TEXT NOT NULL,
    public_key  TEXT NOT NULL,
    private_key TEXT,
    passphrase  TEXT,
    fingerprint TEXT NOT NULL,
    key_type    TEXT NOT NULL DEFAULT 'ed25519',
    bits        INTEGER NOT NULL DEFAULT 256,
    last_used_at DATETIME,
    created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at  DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_ssh_keys_user ON ssh_keys(user_id);
CREATE INDEX IF NOT EXISTS idx_ssh_keys_fingerprint ON ssh_keys(fingerprint);

-- ── Workspace invitations ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS workspace_invitations (
    id          TEXT PRIMARY KEY,
    workspace_id TEXT NOT NULL,
    email       TEXT NOT NULL,
    role        TEXT NOT NULL,
    token       TEXT UNIQUE NOT NULL,
    expires_at  DATETIME NOT NULL,
    created_at  DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- ── Team skills ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS team_skills (
    id            TEXT PRIMARY KEY,
    workspace_id  TEXT NOT NULL,
    name          TEXT NOT NULL,
    description   TEXT,
    manifest      TEXT,
    source_repo   TEXT,
    version       TEXT NOT NULL,
    installed_by  TEXT NOT NULL,
    installed_at  DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_team_skills_workspace ON team_skills(workspace_id);

-- ── Task audit logs ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS task_audit_logs (
    id          TEXT PRIMARY KEY,
    task_id     TEXT NOT NULL,
    action      TEXT NOT NULL,
    actor_type  TEXT NOT NULL,
    actor_id    TEXT NOT NULL,
    payload     TEXT,
    created_at  DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_task_audit_task ON task_audit_logs(task_id);
CREATE INDEX IF NOT EXISTS idx_task_audit_created ON task_audit_logs(created_at);

-- ── Memory entities ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS memory_entities (
    id             TEXT PRIMARY KEY,
    user_id        TEXT NOT NULL,
    agent_id       TEXT,
    entity_id      TEXT NOT NULL,
    name           TEXT NOT NULL,
    type           TEXT NOT NULL DEFAULT 'General',
    content        TEXT,
    properties     TEXT,
    property_count INTEGER NOT NULL DEFAULT 0,
    vector_id      TEXT,
    last_updated   DATETIME DEFAULT CURRENT_TIMESTAMP,
    created_at     DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_memory_entities_user ON memory_entities(user_id);
CREATE INDEX IF NOT EXISTS idx_memory_entities_agent ON memory_entities(agent_id);
CREATE INDEX IF NOT EXISTS idx_memory_entities_entity ON memory_entities(entity_id);
CREATE INDEX IF NOT EXISTS idx_memory_entities_type ON memory_entities(type);

-- ── Memory edges ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS memory_edges (
    id           TEXT PRIMARY KEY,
    user_id      TEXT NOT NULL,
    source       TEXT NOT NULL,
    relationship TEXT NOT NULL,
    target       TEXT NOT NULL,
    confidence   REAL NOT NULL DEFAULT 1.0,
    metadata     TEXT,
    created_at   DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_memory_edges_user ON memory_edges(user_id);
CREATE INDEX IF NOT EXISTS idx_memory_edges_source ON memory_edges(source);
CREATE INDEX IF NOT EXISTS idx_memory_edges_target ON memory_edges(target);

-- ── Test suites ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS test_suites (
    id          TEXT PRIMARY KEY,
    user_id     TEXT NOT NULL,
    agent_id    TEXT NOT NULL,
    name        TEXT NOT NULL,
    description TEXT,
    cases       TEXT NOT NULL,
    runs        TEXT,
    created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at  DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_test_suites_user ON test_suites(user_id);
CREATE INDEX IF NOT EXISTS idx_test_suites_agent ON test_suites(agent_id);

-- ── Agent metrics ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS agent_metrics (
    id          TEXT PRIMARY KEY,
    user_id     TEXT NOT NULL,
    agent_id    TEXT NOT NULL,
    run_id      TEXT,
    metric_type TEXT NOT NULL,
    value       REAL NOT NULL,
    unit        TEXT NOT NULL,
    metadata    TEXT,
    timestamp   DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_agent_metrics_user ON agent_metrics(user_id);
CREATE INDEX IF NOT EXISTS idx_agent_metrics_agent ON agent_metrics(agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_metrics_type ON agent_metrics(metric_type);
CREATE INDEX IF NOT EXISTS idx_agent_metrics_timestamp ON agent_metrics(timestamp);

-- ── Cowork projects ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS cowork_projects (
    id           TEXT PRIMARY KEY,
    user_id      TEXT NOT NULL,
    title        TEXT NOT NULL,
    description  TEXT,
    instructions TEXT,
    metadata     TEXT,
    created_at   DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at   DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_cowork_projects_user ON cowork_projects(user_id);

-- ── Cowork sessions ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS cowork_sessions (
    id           TEXT PRIMARY KEY,
    user_id      TEXT NOT NULL,
    project_id   TEXT,
    title        TEXT,
    status       TEXT NOT NULL DEFAULT 'idle',
    mode         TEXT NOT NULL DEFAULT 'agent',
    checkpoint   TEXT,
    metadata     TEXT,
    started_at   DATETIME,
    completed_at DATETIME,
    created_at   DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at   DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_cowork_sessions_user ON cowork_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_cowork_sessions_status ON cowork_sessions(status);
CREATE INDEX IF NOT EXISTS idx_cowork_sessions_project ON cowork_sessions(project_id);

-- ── Cowork scheduled tasks ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS cowork_scheduled_tasks (
    id                TEXT PRIMARY KEY,
    user_id           TEXT NOT NULL,
    project_id        TEXT,
    title             TEXT NOT NULL,
    prompt            TEXT NOT NULL,
    run_at            INTEGER NOT NULL,
    next_run_at       INTEGER,
    schedule_config   TEXT,
    repeat_every      INTEGER,
    repeat_unit       TEXT,
    enabled           INTEGER NOT NULL DEFAULT 1,
    last_run_at       INTEGER,
    last_run_session_id TEXT,
    last_error        TEXT,
    created_at        DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at        DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_cowork_sched_tasks_user ON cowork_scheduled_tasks(user_id);
CREATE INDEX IF NOT EXISTS idx_cowork_sched_tasks_enabled ON cowork_scheduled_tasks(enabled, next_run_at);
CREATE INDEX IF NOT EXISTS idx_cowork_sched_tasks_project ON cowork_scheduled_tasks(project_id);

-- ── Cowork memory entries ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS cowork_memory_entries (
    id         TEXT PRIMARY KEY,
    user_id    TEXT NOT NULL,
    project_id TEXT,
    session_id TEXT,
    content    TEXT NOT NULL,
    type       TEXT NOT NULL DEFAULT 'fact',
    tags       TEXT,
    source     TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_cowork_memory_user ON cowork_memory_entries(user_id);
CREATE INDEX IF NOT EXISTS idx_cowork_memory_project ON cowork_memory_entries(project_id);
CREATE INDEX IF NOT EXISTS idx_cowork_memory_type ON cowork_memory_entries(type);

-- ── Cowork personas ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS cowork_personas (
    id            TEXT PRIMARY KEY,
    user_id       TEXT NOT NULL,
    name          TEXT NOT NULL,
    description   TEXT,
    system_prompt TEXT NOT NULL,
    tools         TEXT,
    is_default    INTEGER NOT NULL DEFAULT 0,
    created_at    DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at    DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_cowork_personas_user ON cowork_personas(user_id);

-- ── Cowork connectors ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS cowork_connectors (
    id        TEXT PRIMARY KEY,
    user_id   TEXT NOT NULL,
    name      TEXT NOT NULL,
    enabled   INTEGER NOT NULL DEFAULT 1,
    config    TEXT,
    last_used DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, name)
);
CREATE INDEX IF NOT EXISTS idx_cowork_connectors_user ON cowork_connectors(user_id);

-- ── Cowork suggestions ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS cowork_suggestions (
    id        TEXT PRIMARY KEY,
    user_id   TEXT,
    content   TEXT NOT NULL,
    source    TEXT NOT NULL DEFAULT 'system',
    dismissed INTEGER NOT NULL DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_cowork_suggestions_user ON cowork_suggestions(user_id);
CREATE INDEX IF NOT EXISTS idx_cowork_suggestions_dismissed ON cowork_suggestions(dismissed);

-- ── Providers ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS providers (
    id               TEXT PRIMARY KEY,
    name             TEXT NOT NULL,
    provider_type    TEXT NOT NULL,
    base_url         TEXT,
    api_key_env_var  TEXT,
    models           TEXT,
    created_at       DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- ── Cowork executions ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS cowork_executions (
    id          TEXT PRIMARY KEY,
    user_id     TEXT NOT NULL,
    kind        TEXT NOT NULL DEFAULT 'team',
    agent_id    TEXT,
    command     TEXT,
    prompt      TEXT,
    status      TEXT NOT NULL DEFAULT 'queued',
    result      TEXT,
    created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at  DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_cowork_executions_user ON cowork_executions(user_id);
CREATE INDEX IF NOT EXISTS idx_cowork_executions_status ON cowork_executions(status);

-- ── A://Labs — Courses ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS alabs_courses (
    id          TEXT PRIMARY KEY,
    code        TEXT UNIQUE NOT NULL,
    title       TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    tier        TEXT NOT NULL,
    canvas_url  TEXT,
    modules     INTEGER NOT NULL DEFAULT 0,
    capstone    TEXT NOT NULL DEFAULT '',
    cover_image TEXT NOT NULL DEFAULT '',
    demos_url   TEXT,
    sort_order  INTEGER NOT NULL DEFAULT 0,
    published   INTEGER NOT NULL DEFAULT 0,
    created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at  DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_alabs_courses_published ON alabs_courses(published);
CREATE INDEX IF NOT EXISTS idx_alabs_courses_code ON alabs_courses(code);

-- ── A://Labs — Lessons ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS alabs_lessons (
    id              TEXT PRIMARY KEY,
    course_id       TEXT NOT NULL REFERENCES alabs_courses(id) ON DELETE CASCADE,
    module_number   INTEGER NOT NULL DEFAULT 1,
    lesson_number   INTEGER NOT NULL DEFAULT 1,
    title           TEXT NOT NULL,
    description     TEXT NOT NULL DEFAULT '',
    content_markdown TEXT,
    content_html    TEXT,
    scene_json      TEXT,
    video_url       TEXT,
    duration_minutes INTEGER NOT NULL DEFAULT 0,
    status          TEXT NOT NULL DEFAULT 'draft',
    published_at    DATETIME,
    created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at      DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_alabs_lessons_course ON alabs_lessons(course_id);
CREATE INDEX IF NOT EXISTS idx_alabs_lessons_status ON alabs_lessons(status);

-- ── A://Labs — Enrollments ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS alabs_enrollments (
    id          TEXT PRIMARY KEY,
    user_id     TEXT NOT NULL,
    course_id   TEXT NOT NULL REFERENCES alabs_courses(id) ON DELETE CASCADE,
    lesson_id   TEXT REFERENCES alabs_lessons(id) ON DELETE SET NULL,
    progress    INTEGER NOT NULL DEFAULT 0,
    status      TEXT NOT NULL DEFAULT 'in_progress',
    completed_at DATETIME,
    created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at  DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_alabs_enrollments_user ON alabs_enrollments(user_id);
CREATE INDEX IF NOT EXISTS idx_alabs_enrollments_course ON alabs_enrollments(course_id);

-- ── A://Labs — Certifications ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS alabs_certifications (
    id           TEXT PRIMARY KEY,
    user_id      TEXT NOT NULL,
    course_code  TEXT NOT NULL,
    course_title TEXT NOT NULL,
    tier         TEXT NOT NULL,
    completed_at DATETIME,
    capstone_url TEXT,
    score        INTEGER,
    verified     INTEGER NOT NULL DEFAULT 0,
    created_at   DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at   DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_alabs_certifications_user ON alabs_certifications(user_id);

-- ── A://Labs — Articles ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS alabs_articles (
    id              TEXT PRIMARY KEY,
    slug            TEXT UNIQUE NOT NULL,
    type            TEXT NOT NULL DEFAULT 'blog',
    content_type    TEXT NOT NULL DEFAULT 'feature',
    status          TEXT NOT NULL DEFAULT 'draft',
    title           TEXT NOT NULL,
    subtitle        TEXT NOT NULL DEFAULT '',
    abstract        TEXT NOT NULL DEFAULT '',
    authors         TEXT NOT NULL DEFAULT '[]',
    teams           TEXT NOT NULL DEFAULT '[]',
    tags            TEXT NOT NULL DEFAULT '[]',
    keywords        TEXT NOT NULL DEFAULT '[]',
    content_markdown TEXT,
    content_html    TEXT,
    reading_time    INTEGER NOT NULL DEFAULT 0,
    featured        INTEGER NOT NULL DEFAULT 0,
    series          TEXT,
    issue_number    TEXT,
    license         TEXT NOT NULL DEFAULT 'CC BY 4.0',
    access_level    TEXT NOT NULL DEFAULT 'public',
    published_at    DATETIME,
    created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at      DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_alabs_articles_status ON alabs_articles(status);
CREATE INDEX IF NOT EXISTS idx_alabs_articles_slug ON alabs_articles(slug);
