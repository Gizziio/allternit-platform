# A2rchitech Memory v2 Full Implementation Pack

Generated: 2026-01-20 23:31:59Z

This pack implements **all** missing pieces from the audit:
- ✅ Remove truth-loss (`INSERT OR REPLACE`)
- ✅ Truth-preserving timeline fields + state transitions
- ✅ Conflict detection + resolution strategies
- ✅ Active decay + scheduled maintenance (nightly/weekly/monthly)
- ✅ RLM → memory policy control plane
- ✅ Context decision tree routing (tiered retrieval)
- ✅ Graph memory schema + traversal hooks (additive)

## Drop-in targets (from audit)
- SQLite storage impl: `services/state/memory/src/storage/mod.rs`
- Memory fabric: `services/state/memory/src/lib.rs` (`MemoryFabric::query_memory`, `store_memory`)
- Kernel scheduler: `services/kernel/src/main.rs` (start background daemon)
- Context budgets: `crates/kernel/kernel-contracts/src/lib.rs` (enforce injection budgets)
- RLM: `crates/rlm/*` (already exists; we add the memory policy interface)

## Integration markers
Search for `TODO(INTEGRATE)` and wire to your existing:
- DB pool / connection type
- tracing/logging macros
- ContextBundle injection call sites
