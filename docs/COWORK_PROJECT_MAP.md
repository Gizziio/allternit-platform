# gizzi-code Cowork Project view — Gap Map

**Item:** #8 Cowork Project view (GAP → gizzi-code)  
**Branch:** `feat/gizzi-cowork-project`  
**Source of truth:** web `surfaces/ai.allternit.com/src/views/cowork/CoworkProjectView.tsx`

## Current gizzi-code state

- A `cowork` command already exists (`cmd/gizzi-code/src/cli/ui/ink-app/commands/cowork/`).
  - It renders `IntelliTaskScreen`, a Kanban/schedule view over `/api/v1/tasks`.
  - It is NOT project-scoped and does not use `/api/v1/cowork/projects`.
- No project list or project-detail command exists.

## Web reference (CoworkProjectView.tsx)

- Project selector / header with title, instructions, archive/delete actions.
- Two tabs: Tasks and Agent Tasks (filtered by `mode !== 'agent'` / `mode === 'agent'`).
- Task list with create, rename, status, assignee.
- Composer at the bottom that:
  - Creates a task
  - Creates a Cowork session (`POST /api/v1/cowork/sessions`)
  - Binds session to task
  - Sends the initial message to the session
- Backend: `/api/v1/cowork/projects`, `/api/v1/cowork/sessions`, `/api/v1/tasks`.

## Phase plan

### Phase 1 — `cowork project` command (this task)
- Add a new sub-command `cowork project` (or standalone `cowork-project`) registered alongside the existing `cowork` command.
- Fetch `/api/v1/cowork/projects` and render a selectable project list.
- On selection, show a project detail screen:
  - Title + instructions
  - Tasks list (human + agent segments)
  - "New task" input that creates a task + Cowork session + sends the message
- Use the existing gateway API pattern (authenticated fetch to `http://127.0.0.1:8013/api/v1/...`).

### Phase 2 (later) — Rich project management
- Edit instructions, archive/delete project, rename tasks, assign tasks.
- Bind tasks to existing Cowork sessions.

### Phase 3 (later) — Session workspace inside CLI
- Open an active Cowork session in the REPL/chat surface.

## Key files

- Read:
  - `cmd/gizzi-code/src/cli/ui/ink-app/commands/cowork/cowork.tsx`
  - `cmd/gizzi-code/src/cli/ui/ink-app/commands/cowork/index.ts`
  - `cmd/gizzi-code/src/cli/ui/ink-app/commands.ts`
  - `cmd/gizzi-code/src/screens/IntelliTaskScreen.tsx`
  - `surfaces/ai.allternit.com/src/views/cowork/CoworkProjectView.tsx`
  - `surfaces/ai.allternit.com/src/views/cowork/CoworkStore.ts`
- Write:
  - `cmd/gizzi-code/src/cli/ui/ink-app/commands/cowork-project/index.ts`
  - `cmd/gizzi-code/src/cli/ui/ink-app/commands/cowork-project/cowork-project.tsx`
  - Update `cmd/gizzi-code/src/cli/ui/ink-app/commands.ts` to register the new command.

## Constraints

- Match gizzi-code conventions: `// @ts-nocheck`, ink UI (`Box`, `Text`, `useInput`), command type `local-jsx`.
- No backend changes.
- No builds/typechecks required; syntax review only.
