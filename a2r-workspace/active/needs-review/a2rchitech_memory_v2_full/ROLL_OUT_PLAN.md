# A2rchitech Memory v2 Rollout Plan (Safe, Incremental)

Generated: 2026-01-20 23:31:59Z

This plan upgrades the current system described in the audit:
- `memory_entries` in SQLite with `INSERT OR REPLACE` (truth loss)
- Decay functions exist but are not scheduled
- Qdrant/Redis stores are stubs
- RLM exists but does not govern retrieval/decay

## Phase 0 — No-risk schema extension
1. Apply migration `migrations/sqlite/001_memory_truth_v2.sql`
2. Backfill: set `valid_from = created_at`, `status='active'`, `authority='agent'`, `confidence=0.75` where null.

✅ No runtime code change.

## Phase 1 — Dual-write + shadow-read
1. Replace `INSERT OR REPLACE` with v2 write semantics (supersede timeline)
2. Keep existing read path, but add `A2_MEMORY_SHADOW=1`:
   - compute v2 retrieval context alongside v1
   - log diff sizes + top records (no user visible change)

✅ Safe: users get old behavior while v2 is validated.

## Phase 2 — Enable v2 retrieval (feature flag)
1. Enable v2 context assembly with `A2_MEMORY_V2=1`
2. Enforce budgets via ContextBundle budgets (inject max blocks/chars)
3. Start nightly maintenance daemon (decay + dedupe + consolidation triggers)

✅ Users get better memory; still reversible via flag.

## Phase 3 — Add graph memory (optional, additive)
1. Apply `migrations/sqlite/002_graph_memory.sql`
2. Enable `A2_GRAPH_MEMORY=1`
3. Route only relationship queries to graph traversal

## Phase 4 — Close RLM control loop
1. Wire `crates/rlm::memory_policy` into:
   - write strength (what gets stored)
   - retrieval budget + recency bias
   - decay aggressiveness

## Phase 5 — Production hardening
1. Add test harness (truth preservation, conflict resolution, decay)
2. Add migration to Postgres if needed (same schema)
