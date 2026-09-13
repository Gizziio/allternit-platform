# Steering checkpoint — session/aproduct-0913

## Goal
A:// product-depth phase (2026-09-13), owner-approved. All v0.1 protocol work
merged (PRs #422/#429/#436/#463/#473). Six items, dependency order:
P-T1 store-consolidation boundary → P-T2 non-local compute placement →
P-T3 worker daemon packaging → P-T4 connector breadth → P-T5 Al persona
runtime v0.1 → P-T6 Cowork protocol rendering. No merges — owner reviews.
Worktree: ../allternit-session-aproduct-0913 on session/aproduct-0913.

## Just did
- Ritual: fetched origin, created worktree + branch from origin/main
  (7de4678d8). Read AGENTS.md, MASTER_TRACKING.md, prior checkpoint.
- About to record the A:// Product-Depth Task DAG in MASTER_TRACKING.md.

## Next
1. MASTER_TRACKING.md DAG section (P-T1..P-T6 with DoDs + deps), commit, push.
2. P-T1: map the three run/job stores (Rust cowork-runtime SQLite fabric
   transport; cloud-api Postgres/sqlx; gizzi Drizzle cowork tables); implement
   the consolidation boundary; document per-store status.
3. Then P-T2 → P-T6 per DAG order.

## Open questions
- P-T1: whether cloud-api Postgres run/job tables are live-removable or must
  stay as legacy projections — decide after mapping write paths.
- P-T2: exact contract §8.8 placement-resolution hook location in the claim
  path (verify against A_PROTOCOL.md).
- PR strategy: likely stacked sequential PRs (one per item) so owner can
  review item-by-item.
