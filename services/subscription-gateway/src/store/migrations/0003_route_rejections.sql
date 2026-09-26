-- P4 Phase 2 — observability: durable per-decision rejections. Phase 1 stores
-- only the latest route_decision per task (overwritten each hop); this table
-- appends every rejected pair of every decision so /v1/stats/rejections can
-- answer "why not this adapter?" over time.

CREATE TABLE route_rejections (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  task_id TEXT NOT NULL,
  decision_id TEXT NOT NULL,
  adapter_id TEXT NOT NULL,
  account_id TEXT,
  reason TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX route_rejections_created ON route_rejections (created_at, id);
