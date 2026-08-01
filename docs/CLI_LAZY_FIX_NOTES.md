---
task: docs/CLI_LAZY_FIX_TASK.md
spec: .steering/spec.md
status: done
date: 2026-08-01
requirements:
  R1: done
  R2: done
  R3: done
files_changed:
  - rails/src/bin/allternit-rails.rs
  - rails/src/bus/mod.rs
tests: cargo test -p allternit-agent-system-rails (82 lib + 5 invariants + 1 doc-test, 0 failed)
---

# CLI lazy startup fix — notes

## What was wrong

`rails/src/bin/allternit-rails.rs` `main()` eagerly built Ledger, Leases,
ReceiptStore, Index, Vault, Gate, Bus, and WorkOps for EVERY subcommand before
dispatch. Leases/Index/Bus are sqlx SQLite stores, so any CLI invocation —
including subcommands that never touch SQLite (`ticket ready`,
`graph insights`) — could abort startup with SQLITE_CANTOPEN.

## R1 — lazy per-subcommand construction

`main()` now eagerly builds only:

- `Ledger` — `Ledger::new` is pure path math, no disk I/O (ledger.rs:22-41).
- `Mail` — `Mail::new` is a pure config holder (mail/mail.rs).

Everything else lives behind a new `Stores` struct in
`rails/src/bin/allternit-rails.rs` with `tokio::sync::OnceCell` accessors
(tokio "full" already in the tree — no new crates). Each accessor builds its
store on first use and caches it; dependent accessors compose
(`gate()` pulls `leases()`/`receipts()`/`index()`/`vault()`). Subcommand arms
fetch only what they use:

- Nothing heavy: `ticket *`, `graph *`, `transport *`, `gate status`,
  `gate rules`, `wih list/context`, `ledger *`, `plan show`, `dag render`,
  `vault status`, `gate verify` (ledger only).
- Gate (pulls the whole stack): `plan new/refine`, `wih pickup/sign-open/
  close`, `lease request`, `gate check/decision/mutate`, `work *`.
- Leases only: `lease release`, `mail reserve/release`.
- Index only: `index rebuild`.
- Bus only: `bus *`, `mail send`.
- Vault only: `vault archive`.
- Full set (by design): `runner *`, `init`.

No subcommand's output changed.

## R2 — create-if-missing connect options

Verified `SqliteConnectOptions::create_if_missing(true)` + `ensure_dir`
already present in:

- `rails/src/leases/leases.rs:71-73`
- `rails/src/index/search.rs:37-39`
- `rails/src/mail/index.rs:48-50` (E2 mail index)

One store was missing it: `Bus::new` (`rails/src/bus/mod.rs`) connected via a
plain `sqlite://` URL, which does NOT create the db file. Fixed to:

```rust
let connect_opts = SqliteConnectOptions::new()
    .filename(&db_path)
    .create_if_missing(true);
let pool = SqlitePoolOptions::new()
    .max_connections(4)
    .connect_with(connect_opts)
    .await?;
```

## R3 — verification (exact commands + output)

Build:

```
$ cargo build -p allternit-agent-system-rails --bin allternit-rails
    Finished `dev` profile [unoptimized + debuginfo] target(s) in 48.06s
```

Script (`/tmp/r3-check.sh`, runs each command in a fresh `mktemp -d` and
asserts on exit code and directory (non-)existence):

```
$ /tmp/r3-check.sh "$PWD/target/debug/allternit-rails"
PASS: ticket ready exit code
PASS: ticket ready: no .allternit/leases
PASS: ticket ready: no .allternit/index
--- ticket ready stdout:
[]
--- ticket ready stderr:
PASS: graph insights exit code
PASS: graph insights: no .allternit/leases
PASS: graph insights: no .allternit/index
--- graph insights stdout:
{
  "content_hash": "af1349b9f5f9a1a6a0404dea36dcc9499bcb25c9adc112b7cc9a93cae41f3262",
  "metric_statuses": {
    "pagerank": "computed",
    "betweenness": "computed",
    "hits": "computed",
    "critical_path": "computed",
    "cycles": "computed"
  },
  "health": {
    "node_count": 0,
    "edge_count": 0,
    "density": 0.0,
    "cyclic": false,
    "cycle_count": 0,
    "longest_chain_len": 0,
    "most_blocked": null,
    "ready_count": 0
  },
  "keystones": [],
  "bottlenecks": [],
  "quick_wins": []
}
--- graph insights stderr:
PASS: index rebuild exit code
PASS: index rebuild: index.db created
--- index rebuild stdout:
indexed 0 events
--- index rebuild stderr:
ALL R3 CHECKS PASSED
```

## Test suite

```
$ cargo test -p allternit-agent-system-rails
test result: ok. 82 passed; 0 failed  (lib unittests)
test result: ok. 5 passed; 0 failed   (tests/invariants.rs)
test result: ok. 1 passed; 0 failed   (doc-tests)
```
