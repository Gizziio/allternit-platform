# Support export manifest and privacy boundary

The session support endpoint emits a bounded ZIP intended for local diagnosis.

Included:

- `manifest.json`: format version, timestamps, session ID, replay cursor coverage,
  platform, architecture, runtime version, and scratchpad file metadata (relative path,
  size, timestamp, and private/shared scope).
- `session.json`: current session/message/part projection.
- `trace.json`: at most 5,000 append-only replay/request events.
- `background-tasks.json`: durable task states owned by the session.
- `logs/`: the final 200 KB of each of at most three recent log files.

Excluded:

- auth stores, OAuth sessions, environment variables, provider credentials, cookies,
  browser storage, shell history, arbitrary workspace files, and database files;
- all scratchpad file contents;
- full unbounded logs, network captures, websocket frames, and process arguments.

Before compression, values under secret-shaped keys are replaced with `<REDACTED>`;
Bearer/API-token-shaped strings and authorization assignments are removed; the user's
home directory becomes `<HOME>`. The archive is produced only on explicit endpoint use.
Callers should still inspect it before sharing because session prompts and tool output are
included to make the failure reproducible.
