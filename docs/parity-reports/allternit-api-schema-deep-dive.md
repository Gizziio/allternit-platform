---
status: done
report_type: schema-deep-dive
scope: allternit-api SQLite schema + /api/v1 route tree
created: 2026-08-27
---

# Allternit API Schema Deep Dive — Mapping to bb's Project/Thread/Environment/Host/Event Model

## Executive Summary

This report inventories the SQLite schema and `/api/v1` route tree of `cmd/allternit-api`, then maps it to the bb conceptual model (first-class **Projects**, **Threads**, **Environments**, **Hosts**, and **Events**). Allternit already has many of the pieces, but they are split across three partially-overlapping subsystems: **Agents**, **Cowork**, and **Beta Sessions**. There is no unified bb-style entity graph. The cleanest integration path is to layer a bb-compatible route tree on top of the existing `beta_sessions` event store and `cowork_projects` project store, rather than rewriting the agent/cowork internals.

Key files referenced:
- Schema baseline: `cmd/allternit-api/migrations/V1__baseline_schema.sql`
- Route assembly: `cmd/allternit-api/src/main.rs`
- V1 router: `cmd/allternit-api/src/v1_routes.rs`
- Agent routes: `cmd/allternit-api/src/agent_routes.rs`
- Agent session routes: `cmd/allternit-api/src/agent_session_routes.rs`
- Beta session routes: `cmd/allternit-api/src/beta_session_routes.rs`
- Cowork routes: `cmd/allternit-api/src/cowork_routes.rs`
- File routes: `cmd/allternit-api/src/file_routes.rs`
- Terminal routes: `cmd/allternit-api/src/terminal_routes.rs`

---

## 1. Existing Tables / Entities in allternit-api

The API uses a single SQLite database (`allternit.db`) migrated by Refinery. The baseline schema is in `V1__baseline_schema.sql`; subsequent migrations add columns and tables. Entities are grouped below by bb-relevant concept.

### 1.1 User & Tenant

| Table | Created In | Purpose |
|-------|------------|---------|
| `users` | `V1__baseline_schema.sql` | Clerk-backed users (`id`, `email`, `name`, `role`, `clerk_id`). |
| `organizations` | `V20__organizations.sql` | Multi-tenant org buckets. |
| `user_profiles` | `V65__user_profiles.sql` | Extended user prefs/profiles. |
| `user_backend_preferences` | `V1__baseline_schema.sql` | Local vs. remote execution mode. |
| `user_agent_preferences` | `V31__agent_preferences.sql` | Response style / custom instructions. |

### 1.2 Agent Ecosystem

| Table | Created In | Purpose |
|-------|------------|---------|
| `agents` | `V1__baseline_schema.sql` | Canonical agent definition. Enriched by `V6__agent_enriched_schema.sql` and `V14__agent_modes_and_primary.sql`. |
| `agent_templates` | `V15__agent_templates.sql` | Built-in / custom agent pattern templates (solo, orchestrator-workers, company-builder). |
| `agent_sessions` | `V1__baseline_schema.sql` | Recreated in `V3__agent_session_support.sql` to add `description`, `active`, `tags`, `user_id`. |
| `agent_session_messages` | `V3__agent_session_support.sql` | Messages inside an `agent_sessions` row. |
| `agent_canvases` | `V13__agent_canvases.sql` | Persistent canvas artifacts linked to a session. |
| `agent_runs` | `V32__agent_runs.sql` | Execution records for `POST /agents/:id/runs`. |
| `agent_metrics` | `V1__baseline_schema.sql` | Per-run metric samples. |
| `agent_preferences` / `user_agent_preferences` | `V31__agent_preferences.sql` | User-level agent chat style prefs. |
| `agent_marketplace_listings` | `V35__agent_marketplace.sql` | Cross-user published agent snapshots. |
| `agent_marketplace_ratings` | `V35__agent_marketplace.sql` | Ratings/reviews. |
| `agent_marketplace_installs` | `V35__agent_marketplace.sql` | Install audit trail. |
| `agent_evaluations` | `V18__agent_operations.sql` | Eval suites. |
| `agent_evaluation_runs` | `V18__agent_operations.sql` | Eval run results. |
| `factory_tasks` / `factory_changes` | `V18__agent_operations.sql` | Agent factory change approval flow. |
| `gc_runs` / `gc_policies` | `V18__agent_operations.sql` | Garbage collection / code-quality runs. |
| `agent_secrets` | `V47__session_memory.sql` | Encrypted agent-level secrets. |
| `agent_photon_inbox` | `V47__session_memory.sql` | Photon inbound messages. |
| `agent_identity_channels` | `V47__session_memory.sql` | Email/phone/wallet identity channels. |
| `bot_desktop_sandboxes` | `V91__bot_desktop_sandboxes.sql` | Persistent desktop sandbox mapping per bot. |

**Agent shape (`agents` table, `agent_routes.rs:140-178`)**
- Core: `id`, `user_id`, `name`, `description`, `type`, `parent_agent_id`, `model`, `provider`
- Runtime: `capabilities` (JSON), `system_prompt`, `tools` (JSON), `max_iterations`, `temperature`, `config` (JSON), `status`, `workspace_id`
- Trust / policy: `trust_tier`, `harness_config` (JSON), `enabled_modes` (JSON array of surfaces), `allowed_skills`, `allowed_tools`, `data_classification`, `write_scope`
- Character: `character_json`, `category`, `tags`, `avatar`, `identity_key`
- Mode hierarchy: `mode` (`primary|subagent|orchestrator|council`), `is_primary`, `delegates` (JSON array)
- Create/update body is in `agent_routes.rs:305-348` and validates against `AGENT_CREATION_CHECKLIST.md`.

### 1.3 Session / Thread Ecosystem (Three Overlapping Implementations)

#### A. Conversations (`conversation_routes.rs`)

| Table | Purpose |
|-------|---------|
| `conversations` | Lightweight chat threads (`id`, `user_id`, `title`, `parent_conversation_id`, `gizzi_session_id`). |
| `conversation_messages` | Messages (`role`, `content`, `parent_message_id`, `metadata`). |
| `replies` | Streaming reply state per conversation. |

Routes: `GET|POST /api/v1/conversations`, `GET|POST /api/v1/conversations/:id/messages`, `POST /api/v1/conversations/:id/fork`.

#### B. Agent Sessions (`agent_session_routes.rs`)

| Table | Purpose |
|-------|---------|
| `agent_sessions` | Proxied Gizzi runtime sessions (`agent_id`, `agent_name`, `runtime_model`, `origin_surface`, `session_mode`, `metadata`, `active`, `tags`, `user_id`). |
| `agent_session_messages` | Local message cache. |
| `session_origin_surface` | `V11__session_origin_surface.sql` — maps session → original frontend surface. |
| `ephemeral_sessions` | `V29__ephemeral_sessions.sql` — incognito chat flag. |

Routes: `GET|POST /api/v1/agent-sessions`, `GET|PATCH|DELETE /api/v1/agent-sessions/:id`, `GET|POST /api/v1/agent-sessions/:id/messages`, `POST /api/v1/agent-sessions/:id/abort|revert|unrevert|compact`, `GET /api/v1/agent-sessions/sync`.

These are thin proxies to the Gizzi runtime (`terminal_server_url`); the API does **not** own the authoritative session state.

#### C. Beta Sessions (`beta_session_routes.rs`)

| Table | Created In | Purpose |
|-------|------------|---------|
| `beta_sessions` | `V36__beta_sessions.sql` | Durable managed sessions with budgets and threading. |
| `beta_session_events` | `V36__beta_sessions.sql` | Append-only event stream per session. |
| `beta_session_resources` | `V39__beta_session_resources.sql` | Named credentials/env values attached to a session. |
| `session_files` | `V66__session_files.sql` | Session-scoped file store. |
| `session_memory` | `V47__session_memory.sql` | Key/value memory scoped to `(user_id, session_id)`. |

Routes (all under `/api/v1/beta/sessions`):
- `GET|POST /beta/sessions`
- `GET|PATCH|DELETE /beta/sessions/:id`
- `GET|POST /beta/sessions/:id/events` (SSE + append)
- `GET /beta/sessions/:id/events/list`
- `GET /beta/sessions/:id/events/ws`
- `POST /beta/sessions/:id/interrupt`
- `GET|POST /beta/sessions/:id/resources`
- `DELETE /beta/sessions/:id/resources/:resource_id`
- `GET|POST /beta/sessions/:id/files`
- `GET|DELETE /beta/sessions/:id/files/:file_id`
- `POST /beta/sessions/:id/context/edit`
- `GET|PUT /beta/sessions/:id/tool-context`
- `GET /beta/sessions/:id/memory/search`

**Beta session shape (`beta_session_routes.rs:200-241`)**
- Identity: `id`, `user_id`, `agent_id`, `name`
- Threading: `parent_thread_id` (self-referential FK)
- Status: `active|archived`
- Metadata: arbitrary JSON object
- Budget: `max_tokens`, `max_turns`, `max_tool_calls`, `tokens_used`, `turns_used`, `tool_calls_used`
- Context: `context_window`, `truncation_strategy` (`none|drop_oldest_user|summarize`)
- Timestamps: `created_at`, `updated_at`, `archived_at`

**Beta event shape**
- `sequence` (auto-increment PK)
- `id` (UUID)
- `session_id`
- `event_type`
- `data` (JSON)
- `created_at`

Appendable event types are restricted to `thinking_delta`, `content_block_delta`, `tool_calls`, `refusal` (`beta_session_routes.rs:27-32`). System events (`session_created`, `budget_updated`, `context_warning`, `budget_exceeded`, `user_interrupt`, `session_archived`, `context_summary`) are emitted internally.

### 1.4 Project Ecosystem

#### A. Workspaces (`workspace_routes.rs`)

| Table | Purpose |
|-------|---------|
| `workspaces` | Top-level grouping (`id`, `name`, `slug`, `owner_id`, `description`). |
| `workspace_members` | User/agent membership + role. |
| `workspace_invitations` | Invite tokens. |

Routes: `GET|POST /api/v1/workspaces`, `GET|PUT|DELETE /api/v1/workspaces/:id`, members/invites sub-resources.

#### B. Cowork Projects (`cowork_routes.rs`)

| Table | Created In | Purpose |
|-------|------------|---------|
| `cowork_projects` | `V1__baseline_schema.sql` | Persistent project context for Cowork runs (`title`, `description`, `instructions`, `metadata`). |
| `cowork_sessions` | `V1__baseline_schema.sql` | Runs within a Cowork project (`project_id`, `status`, `mode`, `checkpoint`, `metadata`). |
| `cowork_project_files` | `V28__cowork_project_files.sql` | File attachments metadata per project. |
| `cowork_memory_entries` | `V1__baseline_schema.sql` | Project/session scoped memory. |
| `cowork_personas` | `V1__baseline_schema.sql` | Reusable Cowork personas. |
| `cowork_scheduled_tasks` | `V1__baseline_schema.sql` | Cron-style scheduled Cowork tasks. |
| `cowork_executions` | `V1__baseline_schema.sql` | One-off Cowork execution queue. |
| `cowork_runs` | `V5__cowork_runs.sql` | Rails-backed DAG/WIH runtime runs. |

Routes (under `/api/v1/cowork`):
- `GET|POST /cowork/projects`, `GET|PUT|PATCH|DELETE /cowork/projects/:id`
- `GET|POST /cowork/projects/:id/files`, `DELETE /cowork/projects/:id/files/:file_id`
- `GET|POST /cowork/sessions`, `GET|PUT|PATCH|DELETE /cowork/sessions/:id`
- `GET|POST /cowork/memory`, `GET|POST /cowork/memory/search`, `GET /cowork/memory/health`
- `GET|POST /cowork/personas`, `GET|PUT|PATCH|DELETE /cowork/personas/:id`
- `GET /cowork/connectors`, `GET /cowork/approvals`, `GET|POST /cowork/suggestions`
- `POST /cowork/team-execute`, `POST /cowork/run-agent`

**Cowork project shape (`cowork_routes.rs:96-109`)**
- `id`, `user_id`, `title`, `description`, `instructions`, `metadata`
- Plus `git_remote`, `default_branch` (added in route code, not baseline migration)

### 1.5 Host / Runtime / Environment Ecosystem

| Table | Created In | Purpose |
|-------|------------|---------|
| `agent_runtimes` | `V1__baseline_schema.sql` | Registered agent runtime host (`name`, `host`, `agent_clis`, `status`, `workspace_id`). `user_id` added in `V10__agent_runtime_jobs_and_user_id.sql`. |
| `agent_runtime_jobs` | `V10__agent_runtime_jobs_and_user_id.sql` | Jobs submitted to a runtime. |
| `remote_backend_targets` | `V1__baseline_schema.sql` | Remote backend install target (SSH-based). |
| `ssh_connections` | `V1__baseline_schema.sql` | SSH connection config. |
| `ssh_keys` | `V1__baseline_schema.sql` | User SSH keys. |
| `sandbox_templates` | `V74__sandbox_templates.sql` | Reusable cloud sandbox environment templates. |
| `sandbox_instances` | `V74__sandbox_templates.sql` | Launched sandbox instances. |
| `bot_desktop_sandboxes` | `V91__bot_desktop_sandboxes.sql` | Per-bot persistent desktop sandbox. |

Routes:
- `GET|POST /api/v1/agent-runtimes`, `GET|PATCH|DELETE /api/v1/agent-runtimes/:id`, `POST /api/v1/agent-runtimes/:id/heartbeat`, `GET|POST /api/v1/agent-runtimes/:id/jobs` (`agent_runtime_routes.rs`)
- `/sandbox/*` — separate top-level router, not under `/api/v1` (`main.rs:418`)
- `/vm-session/*` — VM session lifecycle (`main.rs:419`)
- `/terminal/*` — mux-backed terminals (`main.rs:424`)

**Runtime shape (`agent_runtime_routes.rs:38-91`)**
- `id`, `name`, `host` (URL string), `agent_clis` (JSON array), `status`, `last_heartbeat`, `workspace_id`
- Job shape: `command`, `args`, `env`, `working_dir`, `result`, `exit_code`, `stdout`, `stderr`, `duration_ms`

### 1.6 Files & Uploads

| Table | Created In | Purpose |
|-------|------------|---------|
| `files` | `V59__files.sql` | OpenAI-compatible file blob store (`filename`, `purpose`, `bytes`, `size`, `content_type`). |
| `session_files` | `V66__session_files.sql` | Session-scoped file metadata (paths stored on disk). |
| `cowork_project_files` | `V28__cowork_project_files.sql` | Cowork project file attachment metadata. |

Routes:
- `GET /api/v1/files/list`, `GET /api/v1/files/read`, `GET /api/v1/files/raw`, `GET|HEAD /api/v1/files/exists`, `POST /api/v1/files/mkdir`, `DELETE /api/v1/files/delete`, `POST /api/v1/files/write` (`file_routes.rs`)
- `POST /api/v1/uploads` (`upload_routes.rs`)

Note: `file_routes.rs` resolves paths against the real filesystem (not a sandbox) for the Electron desktop use case.

### 1.7 Terminals

Managed by `allternit-mux` over a Unix socket, exposed at `/terminal/*` (not under `/api/v1`):
- `POST /terminal/create`
- `POST /terminal/:session_id/input`
- `POST /terminal/:session_id/close`
- `POST /terminal/:session_id/resize`
- `GET /terminal/:session_id/stream`

### 1.8 Events / Audit / Rails

| Table | Created In | Purpose |
|-------|------------|---------|
| `beta_session_events` | `V36__beta_sessions.sql` | Append-only per-session events. |
| `memory_events` | `V1__baseline_schema.sql` | User/agent memory events. |
| `task_audit_logs` | `V1__baseline_schema.sql` | Task audit trail. |
| `audit_events` | `V53__audit_events.sql` | General audit events. |
| Rails ledger | `cmd/allternit-api/src/rails/` | Local append-only ledger used by `stream_agent_events`. |

---

## 2. Route Tree Structure Under `/api/v1/`

`main.rs:310-400` merges every v1 router into `v1_routes`, then `main.rs:404` nests it at `/api/v1`. The resulting tree is a flat namespace with path prefixes rather than a deep hierarchy.

```
/api/v1
├── /ai/chat                    (v1_routes.rs:114)
├── /health                     (v1_routes.rs:115)
├── /models                     (v1_routes.rs:116)
├── /models/recommend           (v1_routes.rs:117)
├── /voice/voices               (v1_routes.rs:118)
├── /voice/tts/stream           (v1_routes.rs:119)
├── /voice/stt/stream           (v1_routes.rs:120)
├── /cli-tools                  (v1_routes.rs:121)
├── /cli-tools/installed        (v1_routes.rs:122)
├── /providers/*                (provider_routes.rs)
├── /inbox/*                    (inbox_routes.rs)
├── /files/*                    (file_routes.rs)
├── /memory/*                   (memory_routes.rs)
├── /me/*                       (me_routes.rs)
├── /local-brain/*              (local_brain_routes.rs)
├── /library/*                  (library_routes.rs)
├── /workflows/*                (workflow_routes.rs)
├── /ssh/*                      (ssh_routes.rs)
├── /swarm/*                    (swarm_routes.rs)
├── /boards/*                   (board_routes.rs)
├── /cowork/*                   (cowork_routes.rs + rails::routes_cowork)
├── /agents/*                   (agent_routes.rs)
├── /agents-v1/*                (agents_v1_routes.rs)
├── /agent-templates            (agent_routes.rs)
├── /agents/from-template       (agent_routes.rs)
├── /agent-marketplace/*        (agent_routes.rs)
├── /agent-sessions/*           (agent_session_routes.rs)
├── /agent-runtimes/*           (agent_runtime_routes.rs)
├── /agent-preferences/*        (agent_preferences_routes.rs)
├── /agent-workspace/*          (agent_workspace_routes.rs)
├── /agent-operations/*         (agent_operations_routes.rs)
├── /agent-email/*              (agent_email_routes.rs)
├── /beta/sessions/*            (beta_session_routes.rs)
├── /beta/deployments/*         (beta_deployment_routes.rs)
├── /beta/work/*                (beta_work_routes.rs)
├── /beta/memory-stores/*       (beta_memory_store_routes.rs)
├── /webhooks/subscriptions/*   (webhook_subscription_routes.rs)
├── /webhooks/triggers/*        (webhook_trigger_routes.rs)
├── /memory-reconstruction/*    (memory_reconstruction_routes.rs)
├── /user-profiles/*            (user_profile_routes.rs)
├── /canvas/*                   (canvas_routes.rs)
├── /tasks/*                    (task_routes.rs)
├── /queue/*                    (queue_routes.rs)
├── /audit-logs/*               (audit_log_routes.rs)
├── /ssh-keys/*                 (ssh_key_routes.rs)
├── /team-skills/*              (team_skill_routes.rs)
├── /udemy/*                    (udemy_routes.rs)
├── /backend-install/*          (backend_install_routes.rs)
├── /runtime/discover/*         (runtime_discover_routes.rs)
├── /runtime-backend/*          (runtime_backend_routes.rs)
├── /remote-control/*           (remote_control_routes.rs)
├── /connectors/*               (connector_routes.rs)
├── /cloud-credentials/*        (cloud_credentials_routes.rs)
├── /usage/*                    (usage_routes.rs)
├── /uploads/*                  (upload_routes.rs)
├── /llm-gateway/*              (llm_gateway::gateway_keys_router + admin_routes)
├── /enterprise-auth/*          (enterprise_auth::router)
├── /evals/*                    (eval_routes.rs)
├── /eval-metrics/*             (eval_metric_routes.rs)
├── /fallback-credits/*         (fallback_credit_routes.rs)
├── /fallback-retry-policies/*  (fallback_retry_policy_routes.rs)
├── /groundedness-checks/*      (groundedness_check_routes.rs)
├── /latency-budgets/*          (latency_budget_routes.rs)
├── /prompt-leak-checks/*       (prompt_leak_routes.rs)
├── /server-tools/*             (server_tool_routes.rs)
├── /sandbox-templates/*        (sandbox_template_routes.rs)
├── /vault/*                    (allternit_vault::router)
├── /admin/workspaces/*         (admin_workspace_routes.rs)
├── /admin/service-accounts/*   (admin_service_account_routes.rs)
├── /admin/access-tokens/*      (admin_access_token_routes.rs)
├── /admin/spend-limits/*       (admin_spend_limit_routes.rs)
├── /admin/mcp-tunnels/*        (admin_mcp_tunnel_routes.rs)
├── /marketplace/*              (marketplace_routes.rs)
├── /rbac/*                     (rbac_routes.rs)
├── /external-keys/*            (external_keys_routes.rs)
├── /scim/*                     (scim_routes.rs)
├── /admin/audit/*              (admin_audit_routes.rs)
├── /compliance/*               (compliance_routes.rs)
├── /data-residency/*           (data_residency_routes.rs)
├── /device-attestation/*       (device_attestation_routes.rs)
├── /workspaces/*               (workspace_routes.rs)
├── /artifacts/*                (artifact_routes.rs)
├── /conversations/*            (conversation_routes.rs)
├── /office/*                   (office_routes.rs)
├── /office-cli/*               (office_cli_routes.rs)
├── /office-engine/*            (office_engine_routes.rs)
├── /orchestrator/*             (orchestrator_routes.rs)
├── /alabs/*                    (alabs_routes.rs)
├── /automations/*              (automation_routes.rs)
├── /brains/*                   (brain_routes.rs)
└── /hud/*                      (hud_routes.rs)
```

Outside `/api/v1` but relevant:
- `POST /api/agent-chat` — bridges to Gizzi SSE stream.
- `/terminal/*` — mux-backed PTYs.
- `/sandbox/*` — code sandbox execution.
- `/vm-session/*` — VM sessions.
- `/rails/*` and `/api/rails/*` — Rails peer/event system.
- `/stream/*` — event streaming WebSocket.
- `/ws/bots/*` — bot desktop stream.
- `/mcp/*` — MCP dispatcher and server routes.
- `/v1/*` — OpenAI-compatible LLM gateway.

---

## 3. Existing Agent / Session / Thread / Project Concepts and Their Shapes

### 3.1 Agent Concept

Allternit's `agents` table is a rich, user-owned agent registry. It is **not** bb's lightweight "assistant" entity; it is closer to a deployable agent profile.

- **Identity**: `id`, `name`, `description`, `avatar`, `identity_key`
- **Model config**: `provider` + `model`, `temperature`, `max_iterations`
- **Behavior**: `system_prompt`, `capabilities` (JSON flags), `tools` (JSON array), `config` (JSON bag)
- **Trust / policy**: `trust_tier`, `harness_config`, `enabled_modes`, `allowed_skills`, `allowed_tools`, `data_classification`, `write_scope`
- **Mode**: `mode` (`primary|subagent|orchestrator|council`), `is_primary`, `delegates`, `parent_agent_id`
- **Workspace**: optional `workspace_id`
- **Autonomous primitives** (stored partly in `config` JSON): `is_bot`, `bot_profile`, `connector_bindings`, `secret_refs`, `messaging_config`, `identity_channels`

### 3.2 Session / Thread Concept

There are **three** session/thread implementations:

1. **Conversations** — simple chat threads, OpenAI-ish shape, local SQLite authoritative.
2. **Agent Sessions** — proxies to Gizzi runtime sessions; API is not authoritative.
3. **Beta Sessions** — durable managed sessions with events, budgets, resources, files, memory; API is authoritative.

The bb "thread" concept maps most cleanly to **Beta Sessions** because they are:
- Durable and queryable (`beta_sessions` + `beta_session_events`)
- Hierarchical (`parent_thread_id`)
- Event-driven (`beta_session_events` append-only stream)
- Resource-aware (`beta_session_resources`)
- File-aware (`session_files`)
- Budget-aware (`max_tokens`, `max_turns`, `max_tool_calls`)

### 3.3 Project Concept

Two project-like entities exist:

1. **Workspaces** — user/team grouping, membership, invites. No execution semantics.
2. **Cowork Projects** — execution context for Cowork runs: instructions, metadata, files, memory, sessions.

The bb "project" concept maps most cleanly to **Cowork Projects** because they tie together instructions, files, memory, and sessions. However, they are currently Cowork-specific and not linked to Beta Sessions or Agent Sessions.

### 3.4 Environment / Host Concept

- **Environments**: `sandbox_templates` + `sandbox_instances` are the closest to bb "environments" (reusable compute templates with `runtime`, `image`, `resources`, `env`, `network_enabled`, `timeout_secs`).
- **Hosts**: `agent_runtimes` is the closest to bb "hosts" (a named endpoint with `host` URL, status, heartbeat, jobs). `remote_backend_targets` and `ssh_connections` are secondary host-like records for remote backend installs.

### 3.5 Event Concept

- **Beta session events** are the closest to bb events: typed JSON payloads appended to a session-scoped log with ordering (`sequence`) and delivery via SSE/WebSocket/webhooks.
- **Rails ledger** is the cross-agent event bus used by `stream_agent_events`.
- **Memory events**, **task audit logs**, **audit_events** are secondary event stores.

---

## 4. Gaps Relative to bb's Project/Thread/Environment/Host/Event Model

Assuming bb's model has first-class, **mutually-linked** entities like:

- `Project` — owns threads, files, environments, hosts.
- `Thread` — ordered message/event stream, belongs to a project, runs on an environment/host.
- `Environment` — reproducible runtime config (image, packages, env vars, secrets).
- `Host` — actual compute target where threads execute.
- `Event` — typed, ordered, queryable, with project/thread/host scoping and delivery semantics.

Allternit's gaps are primarily **integration gaps**, not missing tables.

### 4.1 No Unified Project-Thread Link

- **Cowork projects** own `cowork_sessions`, but Beta Sessions and Agent Sessions are not linked to a Cowork Project.
- **Workspaces** group agents and members, but do not group threads or environments.
- **Gap**: A bb-style `Project` cannot see all its threads across Agent/Beta/Cowork surfaces.
- **Evidence**: `beta_sessions` has no `project_id`; `agent_sessions` has no `project_id`; `cowork_sessions` has `project_id` but only for Cowork.

### 4.2 No Environment-to-Thread Link

- `sandbox_templates`/`sandbox_instances` are standalone.
- `agent_runtimes` are standalone.
- **Gap**: There is no `environment_id` or `host_id` on `beta_sessions`, `agent_sessions`, or `cowork_sessions`.
- **Evidence**: Beta session row shape in `beta_session_routes.rs:200-241` has no environment/host FK.

### 4.3 Host Model is URL-Centric, Not Compute-Centric

- `agent_runtimes.host` is a URL string, not a structured host record (OS, arch, resources, labels, health).
- `bot_desktop_sandboxes` maps a bot to a sandbox but lacks general host semantics.
- **Gap**: bb's `Host` likely expects structured metadata, labels, capacity, and health.

### 4.4 Event Model is Fragmented

- `beta_session_events` is session-scoped only.
- Rails ledger is agent-scoped.
- `audit_events` is cross-cutting but not structured for bb event types.
- **Gap**: No project-scoped or host-scoped event stream; no event type registry; no event delivery guarantees beyond best-effort webhook delivery in `webhook_subscription_routes.rs`.

### 4.5 Files are Not Project-Scoped

- `files` table is global/purpose-driven (OpenAI shape).
- `session_files` is session-scoped.
- `cowork_project_files` is project-scoped but Cowork-only.
- **Gap**: No unified project file store that Beta Sessions and Agent Sessions can both reference.

### 4.6 Terminals are Outside the v1 API

- `/terminal/*` is mounted at top level, not `/api/v1`.
- Terminal sessions are not linked to projects, threads, or hosts.
- **Gap**: bb likely expects terminals as a thread/host resource.

### 4.7 Missing bb Standard Operations

Likely missing (depending on bb's exact contract):
- `POST /projects/:id/threads` — create thread under project
- `GET /projects/:id/threads` — list threads in project
- `POST /projects/:id/environments` — attach environment
- `POST /threads/:id/runs` — run a thread on a specific environment/host
- `GET /threads/:id/events` — ordered event stream
- `POST /environments/:id/instances` — provision host from environment
- `GET /hosts/:id/threads` — list threads running on a host
- `POST /projects/:id/files` — upload project-scoped file
- `GET /projects/:id/files` — list project files

### 4.8 Schema Migrations Needed for bb Mapping

New tables/columns likely required:
- `bb_projects` (or extend `cowork_projects`) — bb project root.
- `bb_project_threads` linking table (or add `project_id` to `beta_sessions`).
- `bb_environments` (or extend `sandbox_templates`) — structured environment specs.
- `bb_hosts` (or extend `agent_runtimes`) — structured host records with labels/health.
- `bb_thread_host_assignments` — which thread runs on which host/environment.
- `bb_project_files` (or extend `cowork_project_files`) — unified file attachments.
- `bb_events` (or extend `beta_session_events`) — project/host/thread event log.

---

## 5. Recommended Places to Add bb-Compatible Route Trees

### 5.1 Preferred Approach: Layer on Beta Sessions + Cowork Projects

Do not rewrite the existing routers. Add a new bb translation layer:

1. **New module**: `cmd/allternit-api/src/bb_routes.rs`
2. **Mount at**: `/api/v1/bb` (add `.merge(bb_router())` in `main.rs:310-400` before `v1_routes` is nested).
3. **Backends**:
   - Use `cowork_projects` as the bb `Project` backing store.
   - Use `beta_sessions` as the bb `Thread` backing store (add `project_id` FK).
   - Use `sandbox_templates` + `sandbox_instances` as the bb `Environment`/`Host` backing store.
   - Use `beta_session_events` as the bb `Event` backing store (add `project_id`, `environment_id`, `host_id` columns or a separate `bb_events` table).

### 5.2 Suggested Route Tree

```
/api/v1/bb
├── /projects
│   ├── GET    /projects                -> list cowork_projects
│   ├── POST   /projects                -> create cowork_project
│   ├── GET    /projects/:id            -> get project
│   ├── PATCH  /projects/:id            -> update project
│   ├── DELETE /projects/:id            -> archive project
│   ├── GET    /projects/:id/threads    -> list beta_sessions where project_id = :id
│   ├── POST   /projects/:id/threads    -> create beta_session with project_id
│   ├── GET    /projects/:id/files      -> list bb_project_files
│   ├── POST   /projects/:id/files      -> upload/attach file
│   ├── GET    /projects/:id/environments -> list environments for project
│   ├── POST   /projects/:id/environments -> create environment
│   └── GET    /projects/:id/events     -> bb events scoped to project
├── /threads
│   ├── GET    /threads/:id             -> get beta_session
│   ├── PATCH  /threads/:id             -> update beta_session
│   ├── DELETE /threads/:id             -> archive beta_session
│   ├── GET    /threads/:id/messages    -> list beta_session_events filtered to message-like types
│   ├── POST   /threads/:id/messages    -> append event (wraps append_event)
│   ├── GET    /threads/:id/events      -> SSE stream of beta_session_events
│   ├── POST   /threads/:id/runs        -> start run on assigned host/environment
│   ├── GET    /threads/:id/files       -> list session_files
│   └── POST   /threads/:id/files       -> upload session file
├── /environments
│   ├── GET    /environments            -> list sandbox_templates
│   ├── POST   /environments            -> create sandbox_template
│   ├── GET    /environments/:id        -> get template
│   ├── PATCH  /environments/:id        -> update template
│   ├── POST   /environments/:id/instances -> create sandbox_instance (host)
│   └── GET    /environments/:id/instances -> list instances
├── /hosts
│   ├── GET    /hosts                   -> list agent_runtimes + sandbox_instances
│   ├── GET    /hosts/:id               -> get host
│   ├── PATCH  /hosts/:id               -> update host metadata/labels
│   ├── GET    /hosts/:id/threads       -> threads assigned to host
│   ├── POST   /hosts/:id/heartbeat     -> runtime heartbeat
│   └── GET    /hosts/:id/events        -> host-scoped events
└── /events
    ├── GET    /events?project=...&thread=...&host=... -> query bb_events
    └── GET    /events/stream?...       -> SSE fan-out
```

### 5.3 Alternative: Extend Existing Routers

If you prefer not to introduce `/bb`, add bb semantics to existing routes:

- Add `project_id` to `beta_session_routes.rs` create/list filters.
- Add `environment_id`/`host_id` to `beta_session_routes.rs` session row.
- Add `/cowork/projects/:id/sessions` to `cowork_routes.rs`.
- Add `/sandbox/environments` and `/sandbox/hosts` under `/api/v1` in `sandbox_template_routes.rs`.
- Move or alias `/terminal/*` under `/api/v1/threads/:id/terminal` or `/api/v1/hosts/:id/terminal`.

This is more invasive and risks breaking existing frontend contracts. The `/bb` layer is safer.

### 5.4 Migration Order Recommendation

1. `VNN__bb_project_link.sql` — add `project_id` to `beta_sessions`, `sandbox_instances`, `session_files`.
2. `VNN__bb_environments.sql` — create `bb_environments` if `sandbox_templates` shape is insufficient; otherwise add `project_id` to `sandbox_templates`.
3. `VNN__bb_hosts.sql` — create `bb_hosts` view/table or extend `agent_runtimes` with labels/capacity.
4. `VNN__bb_events.sql` — add `project_id`, `environment_id`, `host_id` to `beta_session_events` or create `bb_events`.
5. `VNN__bb_project_files.sql` — create `bb_project_files` linking to `files`/`uploads`.

### 5.5 Files to Create / Modify

- **New**: `cmd/allternit-api/src/bb_routes.rs`
- **Modify**: `cmd/allternit-api/src/main.rs` (add `.merge(bb_router())` in v1 route assembly)
- **Modify**: `cmd/allternit-api/src/v1_routes.rs` only if you want to re-export bb routes under a different path.
- **New migrations**: under `cmd/allternit-api/migrations/` following the `VNN__description.sql` convention.
- **Tests**: add to existing route test patterns if they exist (not analyzed in this pass).

---

## 6. Quick Reference: Entity Mapping

| bb Concept | Closest Allternit Entity | Route File | Migration File |
|------------|--------------------------|------------|----------------|
| Project | `cowork_projects` | `cowork_routes.rs` | `V1__baseline_schema.sql` |
| Thread | `beta_sessions` | `beta_session_routes.rs` | `V36__beta_sessions.sql` |
| Message/Event | `beta_session_events` | `beta_session_routes.rs` | `V36__beta_sessions.sql` |
| Environment | `sandbox_templates` | `sandbox_template_routes.rs` | `V74__sandbox_templates.sql` |
| Host | `agent_runtimes` / `sandbox_instances` | `agent_runtime_routes.rs` | `V1__baseline_schema.sql`, `V74__sandbox_templates.sql` |
| File | `session_files` / `cowork_project_files` | `file_routes.rs`, `beta_session_routes.rs`, `cowork_routes.rs` | `V28__cowork_project_files.sql`, `V59__files.sql`, `V66__session_files.sql` |
| Agent | `agents` | `agent_routes.rs` | `V1__baseline_schema.sql`, `V6__agent_enriched_schema.sql`, `V14__agent_modes_and_primary.sql` |
| Terminal | mux terminals | `terminal_routes.rs` | N/A (runtime state in mux) |

---

## 7. Notes & Risks

- **Auth**: All `/api/v1` routes are behind `auth_middleware` (`main.rs:452-455`). Any new bb routes inherit Clerk JWT auth.
- **Rate limiting / idempotency**: These layers are applied to the protected router (`main.rs:442-454`). bb routes should respect `idempotency-key` and rate-limit headers automatically.
- **Gizzi coupling**: Agent Sessions are not authoritative; do not try to make them the bb thread source of truth. Use Beta Sessions.
- **Cowork coupling**: Cowork Projects have execution semantics tied to the Cowork runtime. If bb projects need to be more general, consider a new `bb_projects` table and keep `cowork_projects` as a projection.
- **SQLite**: The API is single-node SQLite. Heavy bb event query loads may require indexing (already good on `beta_session_events`) but may eventually need Postgres if event volume grows.
