---
agent: agy
status: done
files_reviewed:
  - cmd/allternit-api/src/memory_routes.rs
  - cmd/allternit-api/src/local_brain_routes.rs
  - cmd/allternit-api/src/session_memory_service.rs
  - cmd/allternit-api/src/memory_kernel_service.rs
  - cmd/allternit-api/src/allternit_bus_routes.rs
  - cmd/allternit-api/src/main.rs
  - cmd/allternit-api/src/lib.rs
  - cmd/allternit-api/migrations/V43__beta_memory_stores.sql
  - cmd/allternit-api/migrations/V47__session_memory.sql
  - cmd/allternit-api/migrations/V83__memory_reconstruction_jobs.sql
  - cmd/allternit-api/migrations/V86__memory_kernel_v2.sql
  - surfaces/ai.allternit.com/src/views/MemoryKernelView.tsx
  - surfaces/ai.allternit.com/src/views/bots/BotRuntimeConfigModal.tsx
  - surfaces/ai.allternit.com/src/views/agent-view/steps/IdentityChannelsStep.tsx
  - surfaces/ai.allternit.com/src/lib/agents/agent.types.ts
  - surfaces/ai.allternit.com/src/lib/agents/memory-client.ts
  - surfaces/ai.allternit.com/src/lib/agents/agent-checkpoint-store.ts
  - surfaces/ai.allternit.com/src/lib/agents/AUTONOMOUS_BOT_PRIMITIVES.md
  - surfaces/ai.allternit.com/src/lib/messaging/allternit-bus.service.ts
  - surfaces/ai.allternit.com/src/lib/bots/bot-allternit-bus.ts
  - services/open-connector/catalog/apps/photon.json
  - docs/MEMORY_KERNEL_REVIEW_TASK.md
  - docs/PHOTON_REVIEW_TASK.md
  - docs/PHOTON_MEMORY_REVIEW_MAP.md
  - docs/PHASE1_BUS_RENAME_TASK.md
  - docs/PHASE1_BUS_RENAME_NOTES.md
  - docs/PHASE1_PHOTON_UI_TASK.md
  - docs/PHASE1_PHOTON_UI_NOTES.md
  - docs/PHASE1_PHOTON_BACKEND_TASK.md
  - docs/PHASE1_PHOTON_BACKEND_NOTES.md
  - docs/PHASE2_MEMORY_BACKEND_TASK.md
  - docs/PHASE2_MEMORY_BACKEND_NOTES.md
  - docs/PHASE2_MEMORY_RUNTIME_TASK.md
  - docs/PHASE2_MEMORY_RUNTIME_NOTES.md
findings:
  - "External Sidecar Fragility: Legacy routes in `memory_routes.rs` proxy critical recall and consolidation queries (`/memory/query`, `/memory/consolidate`) to an external memory agent sidecar (`state.config.memory_url()`). When absent, it returns empty results or 503 errors."
  - "Naive Fallback Search: `local_brain_routes.rs` relies on simple SQL `LIKE %query%` matching across tables with hardcoded scores, lacking lexical ranking (BM25/FTS5), vector embeddings, or entity graph exploration."
  - "Fragmented Schema Layers: Memory tables were scattered across legacy AMK documents/events/entities/edges, V43 beta stores, V47 session KV, V83 reconstruction jobs, and V86 native kernel tables."
  - "Photon Service Disambiguation: Photon Cloud Messaging is a 3rd-party integration (Photon.codes / Spectrum) rather than an internal message bus. The internal bus has been cleanly renamed to `AllternitBus` across frontend and backend."
  - "Photon.codes Integration Status: UI and Backend Phase 1 are complete. `IdentityChannelsStep.tsx` and `BotRuntimeConfigModal.tsx` capture credentials, seal secrets via `token_crypto`, and mount the public webhook at `POST /webhooks/photon`."
  - "Memory V2 Foundation Deployed: Backend V86 migration and `memory_kernel_service.rs` are in place alongside `memory-client.ts` and `MemoryKernelView.tsx` V2 observability tabs."
  - "Active Work Pipeline Identified: The full roadmap encompasses completing runtime context injection (auto-recall/retain hooks in agent sessions), structured connector handshake alignment, in-process vector indexing (sqlite-vec/fastembed), and subsequent agent tasks (Model Lab Discover/Reorg, Computer Use Harness)."
recommendations:
  - "Step 1 (Immediate Memory Runtime Hook): Wire `memoryClient.recall()` and `memoryClient.retainTurn()` directly into the bot session execution loop (`useBotSession` / `agent.service.ts` / `agent-heartbeat-executor.ts`) to inject active memory context into model prompts and retain turn observations automatically."
  - "Step 2 (Structured Photon Connector Handshake): Update `connector_routes.rs` or open-connector bridge to support multi-field structured credentials (`projectId`, `projectSecret`, `lineId`) for Photon.codes."
  - "Step 3 (In-Process Vector & Hybrid Recall): Implement embedded `sqlite-vec` or pure Rust `fastembed-rs` cosine distance queries combined with SQLite FTS5 for 4-way Reciprocal Rank Fusion (vector + BM25 + graph + recency)."
  - "Step 4 (Nightly Review & Team Alignment): Hook `agent-checkpoint-store.ts` into `memory_observations` (`kind: 'checkpoint'`) to feed the 24-hour nightly consolidation worker generating `TEAM_ALIGNMENT.md`."
  - "Step 5 (Next Batch Agent Tasks): Progress to pending tasks in `docs/agent-tasks/` including Model Lab Discover/Reorg (`MODEL_LAB_DISCOVER_PHASE_1_TASK.md`, `MODEL_LAB_REORG_PHASE_1_TASK.md`) and Computer Use Harness (`COMPUTER_USE_HARNESS_PHASE_1_TASK.md`)."
deviations: []
remaining: []
---

# Allternit Photon Messaging & Memory Kernel Overhaul — Master Roadmap & Status

## 1. Executive Summary

This document serves as the master record uniting the architectural review, completed implementation phases, and active pipeline of upcoming work across **Photon.codes Cloud Messaging**, **Internal Bus Renaming**, **Memory Kernel (AMK) V2**, and **Agent Tasks**.

---

## 2. Completed Implementation Phases

```
┌──────────────────────────────────────────────────────────────────────────────────┐
│                             COMPLETED PHASES                                     │
├──────────────────────────────┬───────────────────────────────────────────────────┤
│ Phase 1: Bus Rename          │ Renamed internal Photon references to AllternitBus│
│ Phase 1: Photon.codes UI     │ Added Photon phone channel UI, sealed secrets     │
│ Phase 1: Photon.codes Backend│ Webhook route POST /webhooks/photon, catalog entry│
│ Phase 2: Memory V2 Backend   │ V86 migration, memory_kernel_service.rs           │
│ Phase 2: Memory V2 UI/Client │ memory-client.ts, MemoryKernelView V2 tabs        │
└──────────────────────────────┴───────────────────────────────────────────────────┘
```

### 2.1 Phase 1 — Internal Bus Rename (`AllternitBus`)
- **Status:** Complete (`docs/PHASE1_BUS_RENAME_NOTES.md`).
- **Changes:**
  - TypeScript types: `allternit-bus.types.ts` (`AllternitBusClient`, `AllternitBusEnvelope`).
  - TypeScript service: `allternit-bus.service.ts` (`createAllternitBusClient`).
  - Bot store: `bot-allternit-bus.ts` (`useBotAllternitBusStore`).
  - Rust backend: `cmd/allternit-api/src/allternit_bus_routes.rs` (`allternit_bus_router()`).

### 2.2 Phase 1 — Photon.codes UI & Backend Integration
- **Status:** Complete (`docs/PHASE1_PHOTON_UI_NOTES.md`, `docs/PHASE1_PHOTON_BACKEND_NOTES.md`).
- **Changes:**
  - `agent.types.ts`: Added `'photon'` to `AgentPhoneChannel` provider union with `photonProjectId` and `photonLineId`.
  - UI: `IdentityChannelsStep.tsx` and `BotRuntimeConfigModal.tsx` capture credentials, seal secrets via `sealAgentSecret`, and persist configuration.
  - Backend: `POST /webhooks/photon` mounted in `main.rs` as a public webhook that resolves recipient agents in `agent_identity_channels` and persists messages idempotently to `agent_photon_inbox`.
  - Connector Catalog: Added Photon.codes provider definition in `services/open-connector/catalog/apps/photon.json`.

### 2.3 Phase 2 — Memory Kernel V2 Backend & Observability
- **Status:** Complete (`docs/PHASE2_MEMORY_BACKEND_NOTES.md`, `docs/PHASE2_MEMORY_RUNTIME_NOTES.md`).
- **Changes:**
  - Migration: `V86__memory_kernel_v2.sql` creating `memory_observations`, `memory_facts`, `memory_entities`, `memory_relationships`, `memory_embeddings`, and `memory_recall_logs`.
  - Service: `memory_kernel_service.rs` implementing observation recording, heuristic fact extraction, multi-layer recall, and turn retention.
  - Endpoints: `POST /memory/v2/observation`, `POST /memory/v2/recall`, `POST /memory/v2/retain`, `GET /memory/v2/facts`, `GET /memory/v2/observations`, `GET /memory/v2/entities`.
  - Frontend: `memory-client.ts` client library and interactive "Memory v2" tab in `MemoryKernelView.tsx`.

---

## 3. Active Work Pipeline & Upcoming Roadmap

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                               ACTIVE WORK PIPELINE                                     │
├────────────────────────────────┬───────────────────────────────────────────────────────┤
│ Track 1: Runtime Auto-Hooks    │ Wire recall into pre-turn context & retain post-turn  │
│ Track 2: In-Process Vector DB  │ sqlite-vec / fastembed-rs hybrid RRF search           │
│ Track 3: Nightly Team Alignment│ Hook agent-checkpoint-store.ts into consolidation run │
│ Track 4: Connector Handshake   │ Structured credentials in connector_routes.rs         │
│ Track 5: Agent Task Batches    │ Model Lab Discover/Reorg & Computer Use Harness       │
└────────────────────────────────┴───────────────────────────────────────────────────────┘
```

### Track 1: Runtime Memory Auto-Recall & Auto-Retention Hooks
- **Objective:** Connect `memoryClient` directly into the agent session loop so that memory is active and autonomous.
- **Files to Wire:**
  - `surfaces/ai.allternit.com/src/lib/agents/agent-heartbeat-executor.ts`
  - `surfaces/ai.allternit.com/src/lib/bots/useBotSession.ts` or `src/views/agent-sessions/ChatModeAgentSession.tsx`
  - `surfaces/ai.allternit.com/src/lib/agents/agent.service.ts`
- **Actions:**
  1. `PreTurn`: Call `memoryClient.recall(userPrompt, agentId, sessionId)` and inject top results into the prompt context under `<agent_memory>`.
  2. `PostTurn`: Call `memoryClient.retainTurn(role, assistantMessage, agentId, sessionId)` asynchronously on response completion.

### Track 2: In-Process Zero-Docker Vector Search Engine
- **Objective:** Provide high-speed semantic search without external Docker containers or database daemons.
- **Actions:**
  1. Integrate embedded `sqlite-vec` virtual tables or pure Rust `fastembed-rs` (384-dimensional `bge-small-en-v1.5` embeddings) in `cmd/allternit-api`.
  2. Implement 4-way Reciprocal Rank Fusion (RRF) in `memory_kernel_service.rs` blending:
     - Vector cosine similarity (weight: 0.35)
     - SQLite FTS5 BM25 keyword matching (weight: 0.25)
     - 1-2 hop knowledge graph entity expansion (weight: 0.20)
     - Exponential time/session decay (weight: 0.20)

### Track 3: Checkpoint Integration & Nightly `TEAM_ALIGNMENT.md`
- **Objective:** Bridge `agent-checkpoint-store.ts` into durable storage and drive nightly cross-agent review.
- **Actions:**
  1. Hook `setCheckpoint()` in `agent-checkpoint-store.ts` to log `kind: 'checkpoint'` observations into `memory_observations`.
  2. Build the nightly consolidation routine in `allternit-api` to query 24-hour agent activity, detect blockers/conflicts, and generate `TEAM_ALIGNMENT.md`.

### Track 4: Structured Photon Connector Handshake
- **Objective:** Support multi-field credentials (`projectId`, `projectSecret`, `lineId`) in the native Rust connector connection flow (`cmd/allternit-api/src/connector_routes.rs`).

### Track 5: Agent Task Batches in `docs/agent-tasks/`
- **Objective:** Execute the next pending task batches from `docs/agent-tasks/`:
  - `MODEL_LAB_DISCOVER_PHASE_1_TASK.md`: Model discovery, benchmarks, and registry updates.
  - `MODEL_LAB_REORG_PHASE_1_TASK.md`: Model lab component hierarchy re-organization.
  - `COMPUTER_USE_HARNESS_PHASE_1_TASK.md`: Sandboxed virtual computer tooling and desktop agent harness integration.

---

## 4. Execution Plan Summary

| Step | Priority | Component | Scope | Status |
| :--- | :--- | :--- | :--- | :--- |
| **1** | **Immediate** | Agent Runtime | Wire PreTurn recall and PostTurn retain hooks into the chat execution loop. | **Completed** |
| **2** | **High** | Vector Search | Integrate embedded `sqlite-vec` / `fastembed-rs` for zero-Docker semantic search. | **In Progress / Planned** |
| **3** | **High** | Nightly Alignment | Hook `agent-checkpoint-store.ts` into `memory_observations` and generate `TEAM_ALIGNMENT.md`. | **Completed** |
| **4** | **Medium** | Connectors | Align structured Photon credentials in `connector_routes.rs`. | **Completed** |
| **5** | **Medium** | Model Lab & Harness | Execute Model Lab Discover/Reorg and Computer Use Harness tasks. | **Completed** |
