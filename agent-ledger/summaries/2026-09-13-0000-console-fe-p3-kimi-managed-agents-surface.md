# Session attestation — session/console-fe-p3 (2026-09-12/13)

**PR:** #454 (merge `09b73ac23`) — `feat(platform-console): Phase 3 — Managed Agents surface`
**Program:** Frontend console port, Phase 3 of 7.

## What was done

Full Managed Agents surface in `surfaces/platform.allternit.com`, every request/response shape confirmed against backend handlers (citations inline in `src/lib/managed-agents.ts`):

- **Agents**: ListPage list (search, filters, `is_bot` → Cloud vs Hub-bot kind, MonoChip IDs, pagination) + full Create/Edit FormPage (General with Rendered|Raw toggle; Tools with per-tool permissions matching the real backend schema `auto|always_allow|always_ask` — agent_routes.rs:1721, MCP servers, custom tools; Skills attach; Manager subagents via GET/POST /agents/:id/subagents) + detail with archive. Old AgentsPage superseded; its session runner preserved verbatim as QuickStartPanel.
- **Sessions** (cloud facade): list with honest columns (cost always derived by backend; tokens only when present — no fabricated in/out split), create (agent/computer-kind/budget), detail with live SSE via GET-capable api.stream(), Turns/Threads/Outputs tabs, follow-up + interrupt (both POST /sessions/:id/events per cloud_agents_routes.rs:1094), archive.
- **Deployments** over /api/v1/beta/deployments — create body is genuinely {agent_id,cron,metadata}; name/env/vault persist in clearly-labeled metadata. Runs list, Trigger now, Pause/Resume, Delete.
- **Computers**: relocation of compute console; kind filter uses the real ComputerKind enum (local|byo_vps|managed|byoc|cloud_desktop); honest no-VM-driver banner.
- **Vaults**: CRUD+PATCH over /api/v1/vaults; credentials add/revoke; secrets sealed server-side never returned — stated in UI; no fake Status column.
- **Memory**: stores (entry_count/last_write_at), entries with cursor pagination, live search, entry view/edit/delete.
- **Stub retirement**: ai-surface AgentStudioView ("simulated save") now a moved-to-console notice; exports + ViewRegistry registration intact; ai typecheck zero new errors (7 pre-existing missing-module errors, baseline-verified via stash).

## Verification evidence

- tsc --noEmit platform 0 errors; pnpm build success; preview 200 on all 13 routes; release-preflight 35/0. Parent re-verified tsc/build/preflight independently.
- api.stream() extended for GET (Playground POST behavior unchanged).

## Honest deferrals

- Signed-in interactive smoke (live SSE session, toolset PUT round-trip) needs a Clerk session — program-wide deferral.
- No desktop rebuild (platform console not desktop-bundled).
