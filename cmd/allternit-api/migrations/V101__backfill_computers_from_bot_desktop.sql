-- Phase 6 backfill: ensure every bot_desktop_sandboxes row has a unified
-- computers row. This is idempotent and safe to re-run.

INSERT INTO computers (id, kind, provider, status, owner_type, owner_id, bot_id, name, os, host, native_id, billing_source)
SELECT
    lower(hex(randomblob(16))),
    'cloud_desktop',
    s.provider,
    s.status,
    'bot',
    s.bot_id,
    s.bot_id,
    coalesce(a.name, 'Bot desktop') || ' sandbox',
    s.os,
    s.host,
    s.sandbox_id,
    'credits'
FROM bot_desktop_sandboxes s
JOIN agents a ON a.id = s.bot_id
WHERE NOT EXISTS (
    SELECT 1 FROM computers c
    WHERE c.bot_id = s.bot_id AND c.kind = 'cloud_desktop' AND c.status != 'deleted'
);

INSERT INTO computer_cloud_desktop (computer_id, sandbox_id, control_state)
SELECT c.id, c.native_id, 'bot_controls'
FROM computers c
LEFT JOIN computer_cloud_desktop d ON d.computer_id = c.id
WHERE c.kind = 'cloud_desktop' AND d.computer_id IS NULL;
