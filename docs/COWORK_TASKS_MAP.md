# Cowork Tasks (iOS) — Map

Source: `docs/SURFACE_AUDIT_PROGRESS.md`'s re-scoped "Cowork Project view" / "Cowork Runs view" / "Cowork Tasks view" rows, after live investigation found the audit's original framing (project-nested Tasks/Agent Tasks/Sources tabs) didn't match a stable, buildable reality on web itself.

## What's real vs. what to skip

- **Skip: project-nesting.** Web's own project↔task association is unreliable — task creation syncs `workspace_id`, never `projectId`, to the server, and `fetchTasks()` drops the local `projectId` on every refetch (`useTaskStore.ts:197,603`, `surfaces/ai.allternit.com`). Building iOS to depend on that link means building on a bug. Task list is scoped flat, not nested under a project.
- **Skip: Sources tab.** Zero data-fetching on web — a static placeholder string, never built.
- **Skip (phase 1): comments, queue-claiming, dependencies, SSE live events, deadlines, risk, estimated_minutes.** The real backend (`cmd/allternit-cloud-api/src/routes/tasks.rs`) supports all of these — it's a full Kanban-style task/queue system also used by agent-worker infrastructure — but web's own Tasks/Agent Tasks tabs only surface a fraction of it. Match web's actual usage, not the backend's full capability.
- **Build: a flat task list**, filtered into two views (Tasks / Agent Tasks) by `assignee_type`, with create/status-update/delete — the real, load-bearing part of what `CoworkProjectView.tsx`'s first two tabs do.

## Backend contract (already live, no backend changes)

`cmd/allternit-cloud-api`, mounted at `/api/v1/tasks` (`tasks.rs:352-367`) — **note this is a different host than gizzi-code's `/v1/*` routes iOS's `PtyClient`/`PermissionClient`/`CronClient` use.** This is the same cloud API host `RuntimeDevicesClient` already talks to (`AppConfig.cloudAPIBaseURL`) for device pairing.

- `POST /api/v1/tasks` body `CreateTaskRequest` → `Task` (tenant/owner stamped server-side from the auth token — do not send `tenant_id`/`owner_id`).
- `GET /api/v1/tasks?workspace_id=<id>&status=<csv>&assignee_id=<id>&...` → `Task[]`. **`workspace_id` is required** — use the literal string `"default"`, matching web's own fallback (`task.workspaceId || 'default'`, `useTaskStore.ts:197`) since there's no real per-workspace concept surfaced anywhere in the app today.
- `GET /api/v1/tasks/:id` → `Task`.
- `PUT /api/v1/tasks/:id` body `UpdateTaskRequest` (all fields optional/COALESCE-style) → `Task`.
- `DELETE /api/v1/tasks/:id`.

`Task` fields (`cmd/allternit-cloud-api/src/db/cowork_models.rs:795-816`), **snake_case on the wire** (Rust/serde default, unlike gizzi-code's camelCase — confirmed by `RuntimeDevice`'s existing `CodingKeys` remapping in `InstancesClient.swift`, follow the same pattern):
```
id: String, workspace_id: String, tenant_id: String?, owner_id: String?,
title: String, description: String?,
status: "backlog"|"todo"|"in-progress"|"in-review"|"done" (kebab-case on the wire, TaskStatus enum),
priority: Int, estimated_minutes: Int?, deadline: ISO8601 String?,
assignee_type: "human"|"agent"?, assignee_id: String?, assignee_name: String?, assignee_avatar: String?,
dependencies: [String]?, optimize_rank: Int?, risk: "low"|"medium"|"high"?,
created_at: ISO8601 String, updated_at: ISO8601 String
```
`CreateTaskRequest`: `workspace_id, title, description?, status?, priority?, estimated_minutes?, deadline?, assignee_type?, assignee_id?, assignee_name?, assignee_avatar?, dependencies?, risk?` (no `tenant_id`/`owner_id` — server-derived). `UpdateTaskRequest`: same fields, all optional, PATCH-style.

## iOS conventions to reuse

- **Client shape**: follow `RuntimeDevicesClient` exactly (`Core/API/InstancesClient.swift`) — `APIClient.shared.authorizedRequest(url:method:)` + `client.session.data(for:)` + `client.validate(response:data:)` + manual `JSONDecoder`/`JSONEncoder`, hitting `AppConfig.cloudAPIBaseURL` directly. **Do not** use the private-`APIClient`-instance pattern `PtyClient`/`PermissionClient`/`CronClient` use — those are gizzi-code-server clients, a different host entirely.
- **List/detail/create UI pattern**: `Features/Projects/Views/ProjectsListView.swift` + `ProjectDetailView.swift` (same precedent used for Automation Tasks) — list → tap → detail, single store singleton, full CRUD.
- **Store pattern**: `Core/ProjectStore.swift` / `Core/CronJobStore.swift` — `@MainActor final class ... ObservableObject`, `static let shared`, `@Published` array, `refresh()`/mutation methods that call the client then resync.

## Scope decision

A new **Cowork Tasks** view, reachable from the existing Cowork toggle inside Chats (the audit's already-tracked "Cowork workspace (CoworkRoot)" PARTIAL row — this is one concrete piece of deepening that toggle beyond its current single-button state, not a new top-level tab). Two segments: **Tasks** (`assignee_type != "agent"` or nil) and **Agent Tasks** (`assignee_type == "agent"`), matching `CoworkProjectView.tsx:66-74`'s own filter logic. List shows title, status badge, priority; tap opens detail (title/description/status-changer/assignee/delete); a "+" creates a new task (title, description, status defaulting to `"todo"`, assignee_type Human/Agent toggle).
