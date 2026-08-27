# Task: Review Memory Kernel Architecture

You are reviewing the Allternit Memory Kernel architecture. Do NOT write implementation code. Produce a written review and a concrete overhaul proposal.

## Files to read

1. `cmd/allternit-api/src/memory_routes.rs`
2. `cmd/allternit-api/src/local_brain_routes.rs`
3. `cmd/allternit-api/src/session_memory_service.rs`
4. `cmd/allternit-api/migrations/V43__beta_memory_stores.sql`
5. `cmd/allternit-api/migrations/V83__memory_reconstruction_jobs.sql`
6. `surfaces/ai.allternit.com/src/views/MemoryKernelView.tsx`
7. `surfaces/ai.allternit.com/src/lib/agents/agent-checkpoint-store.ts`
8. `surfaces/ai.allternit.com/src/lib/agents/AUTONOMOUS_BOT_PRIMITIVES.md`

## Context

- The Memory Kernel (AMK) is described as a three-layer memory system (events, entities, edges).
- It stores data in SQLite tables: `memory_documents`, `memory_events`, `memory_entities`, `memory_edges`, `session_memory`, `beta_memory_stores`.
- `memory_routes.rs` proxies complex queries to an external memory agent sidecar (`state.config.memory_url()`).
- `local_brain_routes.rs` falls back to keyword search when the sidecar is unavailable.
- The user believes this architecture is dated and wants it overhauled.
- The user dislikes Docker dependencies. Any overhaul should stay within the existing Rust/SQLite backend or use optional external binaries, not containerized services.
- Modern agent memory systems (2026) follow this shape:
  1. Ingest every turn/file/tool call.
  2. Extract facts, entities, relationships.
  3. Embed content for semantic search.
  4. Build a knowledge graph.
  5. Recall with hybrid retrieval (vector + graph + keyword + recency).
  6. Consolidate/merge/forget over time.

## Questions to answer

1. What is currently wrong or weak about the Memory Kernel architecture?
2. Which tables/services are redundant? Which should be kept?
3. Propose a concrete no-Docker overhaul:
   - Data model (schema).
   - Ingestion pipeline.
   - Extraction strategy.
   - Embedding/vector search approach without a separate vector DB service.
   - Recall API for the runtime.
   - Mandatory hooks (recall before user message, retain after assistant turn).
4. How does this relate to `agent-checkpoint-store.ts` and nightly review / TEAM_ALIGNMENT.md patterns?
5. Should Hindsight (https://github.com/vectorize-io/hindsight) be a connector, a replacement, or both?

## Constraints

- Do NOT start implementing changes.
- Do NOT run dev servers or builds.
- Keep proposals compatible with the existing Rust/SQLite backend.
- No Docker dependencies.

## Deliverable

Write `docs/PHOTON_MEMORY_REVIEW_NOTES.md` starting with this YAML frontmatter:

```yaml
---
agent: agy
status: done
files_reviewed: []
findings: []
recommendations: []
deviations: []
remaining: []
---
```

Fill in the lists. Then add prose notes explaining each finding and recommendation.
