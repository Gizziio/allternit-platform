# Storage Layout (Locked)

Authoritative truth (append-only):
- `.a2r/ledger/events/YYYY-MM-DD.jsonl`

Atomic correctness (transactional):
- `.a2r/leases/leases.db`

Immutable evidence blobs (generated IDs):
- `.a2r/receipts/<receipt_id>/receipt.json`
- `.a2r/blobs/<blob_id>`

Fast retrieval (derived, rebuildable):
- `.a2r/index/index.db` (SQLite FTS)

Mail threads (derived view):
- `.a2r/mail/threads/<thread_id>.jsonl` (projection from ledger events)

Context packs (derived view):
- `.a2r/work/dags/<dag_id>/wih/context/<wih_id>.context.json`

Notes:
- Ledger is the single source of truth for state transitions.
- Leases are authoritative for locks only.
- Receipts and blobs are immutable evidence referenced by events.
- Index and mail thread files are projections and can be rebuilt.
- Tests: `tests/invariants.rs::authoritative_stores_are_created` asserts that ledger JSONL files, `leases.db`, receipt directories, and CAS blobs exist once the stores are initialized.
