-- §1 0001_init — tables mirror @allternit/subscription-fabric-contracts
-- field names; nested contract objects are stored as JSON text.

CREATE TABLE accounts (
  account_id TEXT PRIMARY KEY,
  provider TEXT NOT NULL,
  label TEXT NOT NULL,
  plan TEXT,
  plan_observed_at TEXT,
  profile_ref TEXT NOT NULL,
  session_health TEXT NOT NULL,
  enabled INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE quota_pools (
  pool_key TEXT PRIMARY KEY,
  pool_id TEXT NOT NULL,
  state TEXT NOT NULL,
  remaining INTEGER,
  remaining_confidence TEXT NOT NULL,
  window TEXT NOT NULL,
  reset_at TEXT,
  reset_at_source TEXT,
  local_used_in_window INTEGER NOT NULL DEFAULT 0,
  local_budget INTEGER,
  cooldown_until TEXT,
  last_signal TEXT,
  updated_at TEXT NOT NULL
);

CREATE TABLE tasks (
  task_id TEXT PRIMARY KEY,
  idempotency_key TEXT,
  requester_id TEXT NOT NULL,
  capability TEXT NOT NULL,
  capability_version INTEGER NOT NULL,
  requester TEXT NOT NULL,
  thread_id TEXT,
  project_id TEXT,
  parent_task_id TEXT,
  prompt TEXT NOT NULL,
  inputs TEXT NOT NULL,
  options TEXT NOT NULL,
  routing TEXT NOT NULL,
  constraints TEXT NOT NULL,
  approval_id TEXT,
  priority TEXT NOT NULL,
  status TEXT NOT NULL,
  status_detail TEXT,
  route_decision TEXT,
  result TEXT,
  error TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  completed_at TEXT
);
CREATE UNIQUE INDEX tasks_idempotency
  ON tasks (requester_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;
CREATE INDEX tasks_status ON tasks (status);
CREATE INDEX tasks_thread ON tasks (thread_id);

CREATE TABLE task_attempts (
  task_id TEXT NOT NULL REFERENCES tasks (task_id) ON DELETE CASCADE,
  attempt_no INTEGER NOT NULL,
  adapter_id TEXT NOT NULL,
  adapter_version TEXT NOT NULL,
  account_id TEXT NOT NULL,
  pool_key TEXT NOT NULL,
  submission_state TEXT NOT NULL,
  prompt_fingerprint TEXT NOT NULL,
  provider_thread_id TEXT,
  requested_model_class TEXT,
  observed_model TEXT,
  started_at TEXT NOT NULL,
  ended_at TEXT,
  outcome TEXT NOT NULL,
  error TEXT,
  PRIMARY KEY (task_id, attempt_no)
);

CREATE TABLE artifacts (
  artifact_id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  mime_type TEXT,
  format TEXT,
  title TEXT,
  task_id TEXT NOT NULL,
  attempt_no INTEGER NOT NULL,
  capability TEXT NOT NULL,
  provider TEXT NOT NULL,
  account_id TEXT NOT NULL,
  adapter_id TEXT NOT NULL,
  adapter_version TEXT NOT NULL,
  provider_artifact_id TEXT,
  provider_url TEXT,
  provider_url_expires_at TEXT,
  thread_id TEXT,
  project_id TEXT,
  bot_id TEXT,
  retrieval_state TEXT NOT NULL,
  local_path TEXT,
  sha256 TEXT,
  size_bytes INTEGER,
  local_preview_path TEXT,
  version INTEGER NOT NULL,
  parent_artifact_id TEXT,
  editable_via TEXT NOT NULL,
  export_formats TEXT NOT NULL,
  trust TEXT NOT NULL DEFAULT 'untrusted_provider_output',
  sensitivity TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX artifacts_task ON artifacts (task_id);
CREATE INDEX artifacts_sha256 ON artifacts (sha256);

CREATE TABLE thread_mappings (
  mapping_id TEXT PRIMARY KEY,
  thread_id TEXT NOT NULL,
  epoch INTEGER NOT NULL,
  provider TEXT NOT NULL,
  account_id TEXT NOT NULL,
  adapter_id TEXT NOT NULL,
  provider_thread_id TEXT NOT NULL,
  provider_project_id TEXT,
  provider_url TEXT NOT NULL,
  last_synced_turn_index INTEGER NOT NULL,
  last_turn_fingerprint TEXT NOT NULL,
  model_class TEXT,
  status TEXT NOT NULL,
  on_divergence TEXT NOT NULL,
  context_transfer_from TEXT,
  created_at TEXT NOT NULL,
  last_used_at TEXT NOT NULL
);
CREATE INDEX thread_mappings_thread ON thread_mappings (thread_id, epoch);

CREATE TABLE events (
  event_id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL,
  caller_id TEXT NOT NULL,
  seq INTEGER NOT NULL,
  kind TEXT NOT NULL,
  payload TEXT NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE (task_id, seq)
);
CREATE INDEX events_task ON events (task_id, seq);

-- D12 — durable per-caller outbox: at-least-once delivery, idempotent on
-- event_id, replayed on reconnect until acked.
CREATE TABLE caller_outbox (
  event_id TEXT NOT NULL,
  caller_id TEXT NOT NULL,
  delivered_at TEXT,
  acked_at TEXT,
  PRIMARY KEY (event_id, caller_id)
);
CREATE INDEX caller_outbox_pending
  ON caller_outbox (caller_id)
  WHERE delivered_at IS NULL;

CREATE TABLE adapter_stats (
  adapter_id TEXT NOT NULL,
  adapter_version TEXT NOT NULL,
  capability TEXT NOT NULL,
  success_count INTEGER NOT NULL DEFAULT 0,
  failure_count INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (adapter_id, adapter_version, capability)
);

-- §A6.2 — per-caller scoped bearer tokens; only sha256 hashes are stored.
CREATE TABLE tokens (
  token_id TEXT PRIMARY KEY,
  caller_id TEXT NOT NULL,
  name TEXT NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  scopes TEXT NOT NULL,
  created_at TEXT NOT NULL,
  revoked_at TEXT
);
