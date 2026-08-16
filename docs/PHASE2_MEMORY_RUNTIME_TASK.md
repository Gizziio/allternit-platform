# Phase 2 — Memory Kernel Runtime Hooks

## Goal
Wire mandatory memory recall/retain hooks into the agent runtime so every bot session benefits from the new memory pipeline.

## Files to read first

- `surfaces/ai.allternit.com/src/lib/agents/agent-heartbeat-executor.ts`
- `surfaces/ai.allternit.com/src/lib/agents/agent.service.ts`
- `surfaces/ai.allternit.com/src/lib/agents/agent.types.ts`
- `surfaces/ai.allternit.com/src/lib/bots/useStartBotSession.ts`
- `surfaces/ai.allternit.com/src/views/MemoryKernelView.tsx`

## Files to modify

1. `surfaces/ai.allternit.com/src/lib/agents/memory-client.ts` (new file)
   - Thin client for the new backend memory v2 endpoints:
     - `recall(query, agentId, sessionId, limit)`
     - `retainTurn(role, content, agentId, sessionId)`
     - `recordObservation(kind, content, agentId, sessionId, source)`

2. `surfaces/ai.allternit.com/src/lib/agents/agent-context.ts` or similar
   - Add `memoryContext` field to the context passed to the model.
   - Before every user message, call `memory.recall()` and inject top results as `additionalContext`.
   - After every assistant turn, call `memory.retainTurn()`.

3. `surfaces/ai.allternit.com/src/views/MemoryKernelView.tsx`
   - Add a "Memory v2" tab showing `memory_observations`, `memory_facts`, `memory_entities` from the new endpoints.
   - Keep the existing tabs working.

4. `cmd/allternit-api/src/memory_routes.rs`
   - Add the v2 routes if not already added by the backend task.

## Constraints
- Must not break existing sessions.
- If memory v2 backend returns 404/not-configured, degrade silently (no memory context injected).
- Match existing Allternit UI conventions.
- Do not run dev servers.
- Run `pnpm exec tsc --noEmit` in `surfaces/ai.allternit.com` and fix errors.

## Deliverable
Write `docs/PHASE2_MEMORY_RUNTIME_NOTES.md` with YAML frontmatter:
```yaml
---
status: done
files_changed: []
findings: []
deviations: []
remaining: []
---
```
