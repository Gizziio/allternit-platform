ALTER TABLE desktop_usage ADD COLUMN os TEXT;

CREATE TABLE IF NOT EXISTS desktop_pricing (
    provider        TEXT NOT NULL,
    os              TEXT NOT NULL,
    price_per_minute REAL NOT NULL DEFAULT 0.0,
    currency        TEXT NOT NULL DEFAULT 'USD',
    PRIMARY KEY (provider, os)
);

-- Seed rough placeholder prices for metering demos.
INSERT OR IGNORE INTO desktop_pricing (provider, os, price_per_minute, currency) VALUES
  ('incus', 'linux', 0.005, 'USD'),
  ('incus', 'windows', 0.015, 'USD'),
  ('tart', 'macos', 0.050, 'USD');
