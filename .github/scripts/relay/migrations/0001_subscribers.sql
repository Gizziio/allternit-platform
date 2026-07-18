-- allternit-newsletter — subscribers table.
-- Double opt-in flow: rows start 'pending' with a random confirm_token,
-- move to 'confirmed' via /confirm, and to 'unsubscribed' via /unsubscribe.
CREATE TABLE IF NOT EXISTS subscribers (
  email TEXT UNIQUE NOT NULL,
  tag TEXT NOT NULL DEFAULT 'allternit-news',
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'confirmed', 'unsubscribed')),
  confirm_token TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  confirmed_at TEXT,
  source TEXT
);

CREATE INDEX IF NOT EXISTS idx_subscribers_status_tag ON subscribers (status, tag);
