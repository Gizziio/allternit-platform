# Phase 2 — Memory Kernel Backend Overhaul (Additive)

## Goal
Build a modern, native Rust/SQLite memory pipeline **alongside** the existing Memory Kernel tables. Do not drop or disable any existing tables or routes.

## Files to read first

- `cmd/allternit-api/src/memory_routes.rs`
- `cmd/allternit-api/src/local_brain_routes.rs`
- `cmd/allternit-api/src/session_memory_service.rs`
- `cmd/allternit-api/migrations/V43__beta_memory_stores.sql`
- `cmd/allternit-api/migrations/V83__memory_reconstruction_jobs.sql`
- `surfaces/ai.allternit.com/src/lib/agents/agent-checkpoint-store.ts`
- `surfaces/ai.allternit.com/src/lib/agents/AUTONOMOUS_BOT_PRIMITIVES.md`

## Files to modify/create

1. `cmd/allternit-api/migrations/V84__memory_kernel_v2.sql`
   Create new tables (do not touch old ones):
   ```sql
   memory_observations (
     id TEXT PRIMARY KEY,
     user_id TEXT NOT NULL,
     agent_id TEXT,
     session_id TEXT,
     kind TEXT NOT NULL, -- turn | file | tool | decision | checkpoint
     content TEXT NOT NULL,
     timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
     source TEXT
   );

   memory_facts (
     id TEXT PRIMARY KEY,
     user_id TEXT NOT NULL,
     agent_id TEXT,
     fact TEXT NOT NULL,
     confidence REAL NOT NULL DEFAULT 0.8,
     valid_from DATETIME DEFAULT CURRENT_TIMESTAMP,
     valid_until DATETIME,
     source_observation_id TEXT REFERENCES memory_observations(id)
   );

   memory_entities (
     id TEXT PRIMARY KEY,
     user_id TEXT NOT NULL,
     agent_id TEXT,
     entity_id TEXT NOT NULL,
     name TEXT NOT NULL,
     type TEXT NOT NULL,
     summary TEXT,
     last_updated DATETIME DEFAULT CURRENT_TIMESTAMP
   );

   memory_relationships (
     id TEXT PRIMARY KEY,
     user_id TEXT NOT NULL,
     source_entity_id TEXT NOT NULL,
     target_entity_id TEXT NOT NULL,
     relation TEXT NOT NULL,
     confidence REAL DEFAULT 0.8,
     valid_from DATETIME DEFAULT CURRENT_TIMESTAMP
   );

   memory_embeddings (
     id TEXT PRIMARY KEY,
     user_id TEXT NOT NULL,
     target_type TEXT NOT NULL, -- fact | entity | observation
     target_id TEXT NOT NULL,
     embedding BLOB NOT NULL,
     model TEXT,
     created_at DATETIME DEFAULT CURRENT_TIMESTAMP
   );

   memory_recall_logs (
     id TEXT PRIMARY KEY,
     user_id TEXT NOT NULL,
     agent_id TEXT,
     session_id TEXT,
     query TEXT NOT NULL,
     results TEXT NOT NULL, -- JSON array
     created_at DATETIME DEFAULT CURRENT_TIMESTAMP
   );
   ```
   Add indexes on `user_id`, `agent_id`, `session_id`, `target_type/target_id`, `timestamp`.

2. `cmd/allternit-api/src/memory_kernel_service.rs` (new file)
   Implement a service module with:
   - `record_observation(db, user_id, agent_id, session_id, kind, content, source) -> Result<String>`
   - `extract_facts(db, user_id, agent_id, observation_id, content) -> Result<Vec<Fact>>`
     - For now, extract simple sentence-level facts using a regex/heuristic fallback.
     - If `state.config.memory_url()` is reachable, call it for LLM-based extraction; otherwise use heuristic.
   - `recall(db, user_id, agent_id, session_id, query, limit) -> Result<Vec<RecallResult>>`
     - Keyword search over `memory_facts` and `memory_observations`.
     - If sqlite-vec or embedding service is available, include semantic search.
     - Rank by recency + keyword match score.
   - `retain_turn(db, user_id, agent_id, session_id, role, content) -> Result<()>`
     - Records observation and extracts facts.

3. `cmd/allternit-api/src/memory_routes.rs`
   - Add routes:
     - `POST /memory/v2/observation`
     - `POST /memory/v2/recall`
     - `POST /memory/v2/retain`
   - Keep all existing `/memory/*` routes unchanged.

4. `cmd/allternit-api/src/lib.rs`
   - Add `pub mod memory_kernel_service;`

5. `cmd/allternit-api/src/agent_execution.rs` or `cmd/allternit-api/src/agent_session_routes.rs`
   - Hook `retain_turn` after assistant completion.
   - Hook `recall` before assistant generation (or leave as runtime-side hook for now).

## Constraints
- No Docker dependencies.
- Use SQLite only; optional sqlite-vec extension if available.
- Existing tables and routes must remain functional.
- Do not run dev servers.
- Run `cargo check --package allternit-api` and fix errors.

## Deliverable
Write `docs/PHASE2_MEMORY_BACKEND_NOTES.md` with YAML frontmatter:
```yaml
---
status: done
files_changed: []
findings: []
deviations: []
remaining: []
---
```
