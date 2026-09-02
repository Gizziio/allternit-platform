-- User credit balance for prepaid hosted runtime usage.
--
-- Credits are consumed as hosted runtime usage sessions close. A negative
-- balance blocks new sessions until credits are added.

CREATE TABLE IF NOT EXISTS user_credits (
    user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    balance_usd REAL NOT NULL DEFAULT 0 CHECK (balance_usd >= 0),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TRIGGER IF NOT EXISTS update_user_credits_timestamp
AFTER UPDATE ON user_credits
BEGIN
    UPDATE user_credits SET updated_at = CURRENT_TIMESTAMP WHERE user_id = NEW.user_id;
END;

CREATE TABLE IF NOT EXISTS credit_transactions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    amount_usd REAL NOT NULL,
    transaction_id TEXT NOT NULL UNIQUE,
    source TEXT NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_credit_transactions_user
    ON credit_transactions(user_id, created_at);
