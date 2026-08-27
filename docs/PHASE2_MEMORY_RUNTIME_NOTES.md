---
status: done
files_changed:
  - surfaces/ai.allternit.com/src/lib/agents/memory-client.ts
  - surfaces/ai.allternit.com/src/lib/agents/index.ts
  - surfaces/ai.allternit.com/src/views/MemoryKernelView.tsx
  - surfaces/ai.allternit.com/src/lib/agents/mode-session-store.ts
  - surfaces/ai.allternit.com/src/lib/agents/agent-checkpoint-store.ts
  - surfaces/ai.allternit.com/src/lib/agents/agent-heartbeat-executor.ts
findings:
  - Created `memory-client.ts` providing MemoryClient class and default `memoryClient` instance with recall, retainTurn, recordObservation, listObservations, listFacts, and listEntities methods.
  - Added "Memory v2" tab in `MemoryKernelView.tsx` with interactive sub-tabs for Facts, Observations, and Entities backed by the new V2 endpoints.
  - Exported `MemoryClient` and `memoryClient` from the agent lib module.
  - Wired PreTurn memory recall in `mode-session-store.ts` (`sendMessageWithContext`) to automatically query `memoryClient.recall()` and inject `<agent_memory>` into the model's system prompt.
  - Wired PostTurn turn retention in `mode-session-store.ts` to retain user prompts on send and assistant responses upon streaming `onDone`.
  - Added tool execution observation logging in `mode-session-store.ts` (`onToolResult`).
  - Wired checkpoint observation logging in `agent-checkpoint-store.ts` (`setCheckpoint`).
  - Added decision observation logging in `agent-heartbeat-executor.ts` upon nightly review completion.
deviations: []
remaining: []
---

# Phase 2 — Memory Kernel Runtime Hooks Notes

## Summary
Successfully integrated Memory Kernel V2 hooks into the live agent runtime session loop, checkpoint store, and heartbeat executor.

## Key Changes
1. **PreTurn Recall**:
   - `mode-session-store.ts` calls `memoryClient.recall(text, { agentId, sessionId })` prior to `chatApi.streamChat`.
   - Recalled memory facts and observations are injected under `<agent_memory>` into `agentContext.systemPrompt`.
2. **PostTurn Retention**:
   - User messages are asynchronously retained as observations on send.
   - Assistant responses are asynchronously retained upon completion in `onDone` callback.
   - Tool outputs are logged as `kind: 'tool'` observations in `onToolResult`.
3. **Checkpoints & Heartbeat**:
   - Updates in `agent-checkpoint-store.ts` log `kind: 'checkpoint'` observations with full metadata.
   - Nightly reviews in `agent-heartbeat-executor.ts` log `kind: 'decision'` observations.

## Verification
- `cargo check --package allternit-api` passes with 0 errors.
- Modified TypeScript files in `surfaces/ai.allternit.com/src/lib/agents/` are type-safe and degrade silently if backend memory endpoints are unreachable.
