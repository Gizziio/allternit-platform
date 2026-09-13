# Steering checkpoint — session/console-fe-p3

**Goal:** Frontend console port Phase 3 — Managed Agents: Agents list + Create agent form (toolset permissions), Sessions list + detail (SSE), Deployments, Computers relocation, Vaults, Memory stores; retire AgentStudioView stub in ai surface.

**Just did:** All Phase 3 pages implemented and verified in worktree `allternit-session-console-fe-p3` on `session/console-fe-p3` (no git commit/push per subagent instructions — parent owns the ritual). Platform `tsc --noEmit` 0 errors, `pnpm build` green, `vite preview` curl 200 on /agents, /agents/new, /sessions, /sessions/new, /sessions/:id, /deployments, /computers, /vaults, /memory (+ detail/edit routes). ai surface `tsc --noEmit`: 7 pre-existing errors (missing workspace modules in office packages), identical before/after the AgentStudioView retirement — none from this change. `node scripts/release-preflight.mjs` 35 passed, 0 failed.

**Backend shapes confirmed (file:line):** agents CRUD/toolset/subagents `cmd/allternit-api/src/agent_routes.rs:39-92,154-199,388-439,1210-1370,1653-1926` (tool permissions are `auto|always_allow|always_ask`, NOT `auto/allow/ask/deny`); session facade `cloud_agents_routes.rs:46-59,114-161,221-254,1094-1383` (follow-up + interrupt both POST /sessions/:id/events; SSE GET /events/stream); deployments `beta_deployment_routes.rs:30-111` (body = agent_id/cron/metadata only — name/environment/vault persist in metadata); computers `computer_routes.rs:36-44,66-93,125-133,153-186` (kind filter values are `local|byo_vps|managed|byoc|cloud_desktop`, NOT the session kinds none/sandbox/desktop/fabric); vaults `allternit_vault.rs:103-145,210-220,433-634` (no status field; secrets never round-trip); memory stores `beta_memory_store_routes.rs:60-120,278-514` (entries cursor-paginated `created_at|id`).

**Deviations to know about:** (1) api.stream() extended to honor `options.method: "GET"` — SSE session events are a GET stream; POST remains default so Playground is unaffected. (2) Old `src/pages/AgentsPage.tsx` (inline session runner) deleted; its capability preserved as QuickStartPanel on the new Agents list. (3) Vault list has no Status column (backend has no status field). (4) `pnpm-lock.yaml` noise from local `pnpm install` was reverted; node_modules in both surfaces were installed locally for verification only.

**Next:** Parent: review, commit/push session branch, PR + merge, attest, cleanup per session ritual.

**Open questions:** None.
