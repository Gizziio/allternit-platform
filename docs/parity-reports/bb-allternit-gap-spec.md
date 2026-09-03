# bb → Allternit Gap Specification (Incremental Parity — Phase 1)

> Scope: core agent-IDE entities (Projects, Threads, Environments, Hosts, Events) and their API/web surfaces.
> Strategy: Option A — implement bb semantics inside Allternit's existing architecture rather than vendoring bb source.
> Target worktree: `/Users/joe/Desktop/allternit-workspace/allternit-session-cacb228c-026d-4ea5-85fe-aa09788e3c7c`

---

## 1. Current State

### 1.1 bb (reference)
bb's product model is built around five first-class entities:

| Entity | bb tables | Purpose |
|--------|-----------|---------|
| **Project** | `projects`, `project_sources`, `project_execution_defaults` | Top-level work container with source roots and per-provider defaults. |
| **Environment** | `environments` | Workspace/runtime context bound to project + host + path. |
| **Host** | `hosts`, `host_daemon_sessions` | Execution machine registry and active daemon lease. |
| **Thread** | `threads`, `thread_sections`, `thread_tabs`, `thread_search_segments`, `thread_dynamic_context_file_states` | Conversation/work unit with lifecycle, sections, tabs, search. |
| **Event** | `events`, `prompt_history_entries`, `queued_thread_messages`, `deferred_thread_messages`, `pending_interactions` | Append-only timeline + message queues + interactions. |

Plus supporting tables: `terminal_sessions`, `plugins`, `plugin_*`, `app_settings_values`, `app_theme`, `system_experiments`.

Full detail: `/Users/joe/bb-fork-analysis/docs/allternit-mapping/bb-data-model-deep-dive.md`

### 1.2 Allternit (target)
Allternit has partially-overlapping concepts spread across three subsystems:

| bb concept | Allternit closest equivalent | Location |
|------------|------------------------------|----------|
| Project | `cowork_projects` (API), `Project` (Drizzle web, unused), mode stores | `cmd/allternit-api/src/cowork_routes.rs`, `surfaces/ai.allternit.com/src/lib/db/schema-sqlite.ts` |
| Thread | `beta_sessions` (API), `Chat` (Drizzle web, unused), mode session stores | `cmd/allternit-api/src/beta_session_routes.rs`, `surfaces/ai.allternit.com/src/views/chat/ChatStore.ts` |
| Environment | `sandbox_instances`, `agent_runtimes`, `workspaces` | `cmd/allternit-api/src/agent_runtime_routes.rs` |
| Host | `agent_runtimes` | `cmd/allternit-api/src/agent_runtime_routes.rs` |
| Event | `beta_session_events`, `agent_session_messages` | `cmd/allternit-api/src/beta_session_routes.rs` |

There is **no unified bb-style entity graph** today. The cleanest integration path is to add a new bb-compatible route tree and schema, backed where possible by existing tables.

---

## 2. Mapping Decisions

### 2.1 Core entity mapping

| bb entity | Allternit representation | Decision |
|-----------|--------------------------|----------|
| `projects` | New `bb_projects` table in `allternit-api` + sync to web `Project` | bb projects are first-class; cowork projects remain separate but may converge later. |
| `project_sources` | New `bb_project_sources` table | Source-root abstraction is bb-specific. |
| `environments` | New `bb_environments` table; link to `sandbox_instances` where applicable | bb environments have git/worktree semantics not present in Allternit sandboxes. |
| `hosts` | Extend `agent_runtimes` OR new `bb_hosts` table | `agent_runtimes` is close but lacks bb's connect-machine routing and permission mode. Decision: **new `bb_hosts`** and treat `agent_runtimes` as one host type. |
| `threads` | New `bb_threads` table; sync to web `Chat` | bb threads have richer lifecycle/events than beta_sessions. |
| `events` | New `bb_events` table; sync to web `Message`/`Part` | bb events are richer (tool calls, file parts, lifecycle). |
| `terminal_sessions` | New `bb_terminal_sessions` or bridge to `/terminal/*` mux | Allternit already has terminal mux; decision: bridge to existing terminal service. |
| `plugins` | Bridge to `platform/plugins/` and `A2UICapsule` | Allternit plugin SDK is the long-term home; bb plugin semantics added incrementally. |

### 2.2 Auth / identity boundary

- bb has local `user` + cloud `user` (better-auth) + API keys.
- Allternit uses Clerk (`users` table in API) + Better Auth on web surface.
- Decision: reuse Allternit's `users` table; add bb API key support via new `bb_api_keys` table if needed later. For Phase 1, rely on Clerk session.

### 2.3 Cloud / local boundary

- bb keeps threads/events/terminals strictly local; cloud only handles identity + routing.
- Allternit's `allternit-api` is already local-first (SQLite default).
- Decision: mirror bb's boundary. New bb tables live in local SQLite only.

---

## 3. Schema Additions (allternit-api)

### 3.1 New migration: `cmd/allternit-api/migrations/V92__bb_core_entities.sql`

Add the following tables. Column naming follows Rust/SQLx snake_case conventions.

```sql
-- bb_hosts: execution machine registry
CREATE TABLE bb_hosts (
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
CREATE INDEX bb_hosts_user_last_seen_idx ON bb_hosts(user_id, last_seen_at);

-- bb_projects: top-level work container
CREATE TABLE bb_projects (
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
CREATE INDEX bb_projects_user_updated_idx ON bb_projects(user_id, updated_at);
CREATE INDEX bb_projects_user_deleted_idx ON bb_projects(user_id, deleted_at);
CREATE INDEX bb_projects_user_sort_idx ON bb_projects(user_id, sort_key, id);
CREATE UNIQUE INDEX bb_projects_personal_singleton_idx ON bb_projects(user_id, kind) WHERE kind = 'personal';

-- bb_project_execution_defaults
CREATE TABLE bb_project_execution_defaults (
    project_id TEXT PRIMARY KEY REFERENCES bb_projects(id) ON DELETE CASCADE,
    provider_id TEXT NOT NULL,
    model TEXT NOT NULL,
    service_tier TEXT NOT NULL DEFAULT 'default',
    reasoning_level TEXT,
    permission_mode TEXT NOT NULL DEFAULT 'full',
    updated_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
);

-- bb_project_sources: workspace roots
CREATE TABLE bb_project_sources (
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
CREATE INDEX bb_project_sources_project_idx ON bb_project_sources(project_id);
CREATE INDEX bb_project_sources_host_idx ON bb_project_sources(host_id);

-- bb_environments: project + host + path runtime context
CREATE TABLE bb_environments (
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
CREATE INDEX bb_environments_project_idx ON bb_environments(project_id);
CREATE INDEX bb_environments_host_path_lookup_idx ON bb_environments(host_id, path);
CREATE INDEX bb_environments_status_idx ON bb_environments(status);

-- bb_thread_sections: folders for threads
CREATE TABLE bb_thread_sections (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
    updated_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
    UNIQUE(user_id, name)
);

-- bb_threads: conversation/work unit
CREATE TABLE bb_threads (
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
CREATE INDEX bb_threads_project_updated_idx ON bb_threads(project_id, updated_at);
CREATE INDEX bb_threads_project_archived_deleted_idx ON bb_threads(project_id, archived_at, deleted_at);
CREATE INDEX bb_threads_environment_idx ON bb_threads(environment_id);
CREATE INDEX bb_threads_parent_idx ON bb_threads(parent_thread_id);
CREATE INDEX bb_threads_section_archived_deleted_idx ON bb_threads(section_id, archived_at, deleted_at);
CREATE INDEX bb_threads_environment_archived_deleted_idx ON bb_threads(environment_id, archived_at, deleted_at);
CREATE INDEX bb_threads_active_maintenance_idx ON bb_threads(deleted_at) WHERE deleted_at IS NULL;
CREATE INDEX bb_threads_pin_sort_idx ON bb_threads(pin_sort_key) WHERE pinned_at IS NOT NULL;

-- bb_events: append-only timeline
CREATE TABLE bb_events (
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
CREATE UNIQUE INDEX bb_events_thread_sequence_idx ON bb_events(thread_id, sequence);
CREATE INDEX bb_events_environment_idx ON bb_events(environment_id);
CREATE INDEX bb_events_thread_type_sequence_idx ON bb_events(thread_id, event_type, sequence);
CREATE INDEX bb_events_thread_turn_type_item_sequence_idx ON bb_events(thread_id, turn_id, event_type, item_kind, sequence);
CREATE INDEX bb_events_parent_tool_call_thread_parent_sequence_idx ON bb_events(thread_id, parent_tool_call_id, sequence) WHERE parent_tool_call_id IS NOT NULL;
CREATE INDEX bb_events_item_lifecycle_thread_item_sequence_idx ON bb_events(thread_id, item_id, sequence) WHERE item_id IS NOT NULL;
CHECK(scope_kind = 'turn' AND turn_id IS NOT NULL OR scope_kind = 'thread' AND turn_id IS NULL);

-- bb_prompt_history_entries
CREATE TABLE bb_prompt_history_entries (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL REFERENCES bb_projects(id) ON DELETE CASCADE,
    thread_id TEXT NOT NULL REFERENCES bb_threads(id) ON DELETE CASCADE,
    scope TEXT NOT NULL,
    request_sequence INTEGER NOT NULL,
    input TEXT NOT NULL,
    created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
    UNIQUE(thread_id, request_sequence)
);
CREATE INDEX bb_prompt_history_project_scope_idx ON bb_prompt_history_entries(project_id, scope, created_at, request_sequence, id);

-- bb_queued_thread_messages
CREATE TABLE bb_queued_thread_messages (
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
CREATE INDEX bb_queued_thread_messages_thread_created_idx ON bb_queued_thread_messages(thread_id, created_at, id);
CREATE INDEX bb_queued_thread_messages_thread_sort_idx ON bb_queued_thread_messages(thread_id, sort_key, id);

-- bb_host_daemon_sessions
CREATE TABLE bb_host_daemon_sessions (
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
CREATE INDEX bb_host_daemon_sessions_host_status_idx ON bb_host_daemon_sessions(host_id, status);
CREATE INDEX bb_host_daemon_sessions_status_closed_idx ON bb_host_daemon_sessions(status, closed_at, id);
```

### 3.2 Rust types

Add `cmd/allternit-api/src/bb/` module:

- `cmd/allternit-api/src/bb/mod.rs` — module root
- `cmd/allternit-api/src/bb/models.rs` — Rust structs mirroring new tables
- `cmd/allternit-api/src/bb/db.rs` — SQLx queries
- `cmd/allternit-api/src/bb/routes.rs` — Axum route handlers
- `cmd/allternit-api/src/bb/contracts.rs` — request/response JSON types

Use `sqlx::FromRow` and `serde::{Deserialize, Serialize}`.

---

## 4. API Additions (allternit-api)

### 4.1 Route tree under `/api/v1/bb/`

Mount a new router in `cmd/allternit-api/src/main.rs`:

```rust
mod bb;
...
let bb_router = bb::routes::bb_router(state.clone());
app = app.nest("/api/v1/bb", bb_router);
```

### 4.2 Endpoints (Phase 1 subset)

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/bb/projects` | List bb projects |
| POST | `/bb/projects` | Create bb project |
| GET | `/bb/projects/:id` | Get project |
| PATCH | `/bb/projects/:id` | Update project |
| DELETE | `/bb/projects/:id` | Soft-delete project |
| POST | `/bb/projects/:id/sources` | Add source |
| GET | `/bb/projects/:id/files` | List workspace files |
| GET | `/bb/threads` | List threads |
| POST | `/bb/threads` | Create thread |
| GET | `/bb/threads/:id` | Get thread |
| PATCH | `/bb/threads/:id` | Update thread |
| POST | `/bb/threads/:id/send` | Send message |
| GET | `/bb/threads/:id/timeline` | Get timeline |
| GET | `/bb/threads/:id/events` | Get events |
| POST | `/bb/threads/:id/events/wait` | Long-poll event |
| GET | `/bb/environments/:id` | Get environment |
| POST | `/bb/environments/:id/actions` | Workspace actions |
| GET | `/bb/hosts` | List hosts |
| POST | `/bb/hosts` | Register host |
| GET | `/bb/hosts/:id` | Get host |

Additional routes (terminal, plugin, settings) deferred to later phases.

---

## 5. Web Platform Additions

### 5.1 Drizzle schema changes

File: `surfaces/ai.allternit.com/src/lib/db/schema-sqlite.ts`

1. Add `mode` enum to existing `Project` table: `chat | cowork | code | design | bb`.
2. Add `bbProjectId` and `bbThreadId` columns to `Chat`.
3. Add `UserPreference` table: `(user_id, key, value, scope, updated_at)`.
4. Re-generate migration: `src/lib/db/migrations-sqlite/0001_bb_web_entities.sql`.

### 5.2 New views

Create under `surfaces/ai.allternit.com/src/views/bb/`:

- `BBProjectView.tsx` — bb-native project detail.
- `BBThreadView.tsx` — bb-native thread detail.
- `BBSettingsPanel.tsx` — bb settings section.

Wire into:

- `src/views/project/unified/types.ts` — add `'bb'` to `ProjectMode`.
- `src/views/project/unified/useUnifiedProjects.ts` — include bb projects.
- `src/views/project/unified/ProjectDetailRouter.tsx` — route `bb` mode.
- `src/shell/ShellRail.tsx` — add bb entries.

### 5.3 Sync layer

Add `surfaces/ai.allternit.com/src/lib/agents/bb-sync.ts` to sync local Drizzle cache with Rust API `/api/v1/bb/*`.

---

## 6. Host Runtime Bridge

bb's host-daemon semantics (workspace provisioning, provider bridges) are the largest runtime gap. Phase 1 does **not** implement a full host-daemon port. Instead:

1. Add `bb_hosts` table to register execution targets.
2. For local development, bridge workspace file ops to existing `allternit-mux` or `agent-runtime` local APIs.
3. Provider bridge logic deferred to Phase 2/3.

---

## 7. Acceptance Criteria for Phase 1

1. `cmd/allternit-api` builds and runs with new `bb_*` tables.
2. New `/api/v1/bb/*` routes respond correctly for CRUD on projects, threads, environments, hosts.
3. `surfaces/ai.allternit.com` typechecks with new bb columns and views.
4. New Drizzle migration applies cleanly.
5. A manual end-to-end test creates a bb project, creates a thread, and lists events.

---

## 8. Deferred to Later Phases

- Plugin SDK mapping (`plugins` tables, plugin marketplace, bb plugin runtime).
- Terminal session integration.
- Host-daemon workspace provisioning and provider bridges.
- bb CLI command groups.
- Mobile/desktop surface integration.
- bb connect cloud identity/routing.
- FTS5 thread search.
- Thread sections/tabs, dynamic context files.
- API keys and local auth.

---

## 9. File Checklist

### Rust API
- [ ] `cmd/allternit-api/migrations/V92__bb_core_entities.sql`
- [ ] `cmd/allternit-api/src/bb/mod.rs`
- [ ] `cmd/allternit-api/src/bb/models.rs`
- [ ] `cmd/allternit-api/src/bb/db.rs`
- [ ] `cmd/allternit-api/src/bb/contracts.rs`
- [ ] `cmd/allternit-api/src/bb/routes.rs`
- [ ] `cmd/allternit-api/src/main.rs` (mount router)

### Web platform
- [ ] `surfaces/ai.allternit.com/src/lib/db/schema-sqlite.ts`
- [ ] `surfaces/ai.allternit.com/src/lib/db/migrations-sqlite/0001_bb_web_entities.sql`
- [ ] `surfaces/ai.allternit.com/src/lib/db/bb-projects.ts`
- [ ] `surfaces/ai.allternit.com/src/lib/db/bb-threads.ts`
- [ ] `surfaces/ai.allternit.com/src/lib/agents/bb-sync.ts`
- [ ] `surfaces/ai.allternit.com/src/views/bb/BBProjectView.tsx`
- [ ] `surfaces/ai.allternit.com/src/views/bb/BBThreadView.tsx`
- [ ] `surfaces/ai.allternit.com/src/views/project/unified/types.ts`
- [ ] `surfaces/ai.allternit.com/src/views/project/unified/useUnifiedProjects.ts`
- [ ] `surfaces/ai.allternit.com/src/views/project/unified/ProjectDetailRouter.tsx`
