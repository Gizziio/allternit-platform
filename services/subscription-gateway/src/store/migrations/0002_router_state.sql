-- §A4/P4 — gateway-local router state that the contracts schema has no field
-- for: the per-pool cooldown ladder rung + rolling-window anchor, and the
-- per-adapter-version ui_drift circuit breaker (consecutive UI failures).

CREATE TABLE quota_pool_meta (
  pool_key TEXT PRIMARY KEY,
  cooldown_rung INTEGER NOT NULL DEFAULT 0,
  window_anchor TEXT
);

CREATE TABLE adapter_breakers (
  adapter_id TEXT NOT NULL,
  adapter_version TEXT NOT NULL,
  consecutive_ui_failures INTEGER NOT NULL DEFAULT 0,
  state TEXT NOT NULL DEFAULT 'closed',
  opened_at TEXT,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (adapter_id, adapter_version)
);
