-- Replies Runtime — persistence schema
-- Phase 2: replace in-memory store.ts with this Postgres-backed schema.
-- Run once against Neon/Postgres. Idempotent (IF NOT EXISTS throughout).

-- ---------------------------------------------------------------------------
-- conversations
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS conversations (
  id          text        PRIMARY KEY,
  metadata    jsonb,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- replies
-- Canonical reply record. items[] is the ordered list of ReplyItems
-- (same shape as Reply.items in @a2r/replies-contract). Written incrementally
-- via reduceReplyEvent; full snapshot persisted on reply.completed/failed.
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS replies (
  id               text        PRIMARY KEY,
  conversation_id  text        REFERENCES conversations(id) ON DELETE SET NULL,
  status           text        NOT NULL CHECK (status IN ('streaming', 'complete', 'failed')),
  model            text        NOT NULL DEFAULT 'unknown',
  input            jsonb       NOT NULL DEFAULT '{}',
  items            jsonb       NOT NULL DEFAULT '[]',
  usage            jsonb,
  metadata         jsonb,
  created_at       timestamptz NOT NULL DEFAULT now(),
  completed_at     timestamptz
);

CREATE INDEX IF NOT EXISTS idx_replies_conversation_id ON replies (conversation_id);
CREATE INDEX IF NOT EXISTS idx_replies_status           ON replies (status);
CREATE INDEX IF NOT EXISTS idx_replies_created_at       ON replies (created_at);

-- ---------------------------------------------------------------------------
-- runs
-- One run per reply (1:1 in phase 1; could be 1:many for retries later).
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS runs (
  id              text        PRIMARY KEY,
  reply_id        text        NOT NULL REFERENCES replies(id) ON DELETE CASCADE,
  status          text        NOT NULL CHECK (status IN ('pending', 'running', 'completed', 'failed', 'cancelled')),
  provider        text        NOT NULL,
  provider_model  text,
  started_at      timestamptz NOT NULL DEFAULT now(),
  completed_at    timestamptz,
  error           text
);

CREATE INDEX IF NOT EXISTS idx_runs_reply_id   ON runs (reply_id);
CREATE INDEX IF NOT EXISTS idx_runs_status     ON runs (status);

-- ---------------------------------------------------------------------------
-- run_events
-- Append-only log of ReplyEvents for a run. Used for replay and audit.
-- seq is monotonically increasing per run (application-assigned).
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS run_events (
  id          bigserial   PRIMARY KEY,
  run_id      text        NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
  seq         integer     NOT NULL,
  type        text        NOT NULL,
  payload     jsonb       NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (run_id, seq)
);

CREATE INDEX IF NOT EXISTS idx_run_events_run_id ON run_events (run_id, seq);
CREATE INDEX IF NOT EXISTS idx_run_events_type   ON run_events (type);

-- ---------------------------------------------------------------------------
-- artifacts
-- Large outputs (code, files, images) linked to a reply and optionally a run.
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS artifacts (
  id           text        PRIMARY KEY,
  reply_id     text        NOT NULL REFERENCES replies(id) ON DELETE CASCADE,
  run_id       text        REFERENCES runs(id) ON DELETE SET NULL,
  type         text        NOT NULL,
  title        text        NOT NULL,
  mime_type    text,
  uri          text,
  metadata     jsonb,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_artifacts_reply_id ON artifacts (reply_id);
CREATE INDEX IF NOT EXISTS idx_artifacts_type     ON artifacts (type);
