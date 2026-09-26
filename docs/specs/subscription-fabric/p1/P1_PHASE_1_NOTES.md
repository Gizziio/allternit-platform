---
status: complete
files_changed:
  - services/subscription-gateway/package.json
  - services/subscription-gateway/tsconfig.json
  - services/subscription-gateway/README.md
  - services/subscription-gateway/scripts/copy-migrations.mjs
  - services/subscription-gateway/src/config.ts
  - services/subscription-gateway/src/store/db.ts
  - services/subscription-gateway/src/store/migrations/0001_init.sql
  - services/subscription-gateway/src/store/queries.ts
  - services/subscription-gateway/src/security/tokens.ts
  - services/subscription-gateway/src/security/keychain.ts
  - services/subscription-gateway/src/security/redact.ts
  - services/subscription-gateway/src/security/navlock.ts
  - services/subscription-gateway/test/store.test.ts
  - services/subscription-gateway/test/tokens.test.ts
  - services/subscription-gateway/test/keychain.test.ts
  - services/subscription-gateway/test/redact.test.ts
  - services/subscription-gateway/test/navlock.test.ts
deviations:
  - Build script is `tsc -b && node scripts/copy-migrations.mjs` — the copy step
    places the .sql migrations next to the compiled store so `node dist/main.js`
    resolves them at the same relative path as under src/. tsc does not copy
    assets on its own.
  - tsconfig uses NodeNext (not the contracts package's ESNext/node) so the
    emitted ESM runs under `node dist/...`; project reference to
    `@allternit/subscription-fabric-contracts` per the tsc -b pattern.
  - `localhost` / `127.0.0.1` / `::1` are exempt from the navlock origin
    allowlist (not only from the https rule) — loopback is the CDP/devtools
    surface and cannot egress to a provider; tested as the localhost exception.
  - WAL pragma is asserted against a file-backed temp database in tests, since
    `:memory:` databases cannot report WAL.
remaining:
  - Phase 2: events/*, http/*, main.ts, router/ (explicitly not started).
  - main.ts must call requireKeychain() at boot and refuse to start on
    KeychainUnavailable (D3) — the gate exists and is tested; wiring is Phase 2.
  - Port 7788 must be added to the docs/Operations/QUICK_REFERENCE.md port
    table (P1 plan item, not part of this phase's task spec).
  - getOrCreateMasterKey() is issued but not yet used for at-rest encryption.
verify:
  - pnpm -F subscription-gateway build — PASS (tsc -b, 0 errors)
  - pnpm -F subscription-gateway test — PASS (5 files, 44 tests)
  - grep -rniE "chatgpt|claude|kimi|gemini|grok|deepseek|openai|anthropic"
    services/subscription-gateway — PASS (no matches)
  - config smoke via tsx: env overrides, ~ expansion, artifact sharding, and
    policy parsing verified by direct invocation.
---

# P1 Phase 1 — Subscription Gateway scaffolding + store + config + security

## What was built

`services/subscription-gateway/` — Phase 1 of the Subscription Gateway daemon
(TypeScript, ESM, pnpm workspace). No Phase 2 files (events/, http/, main.ts,
router/) were created.

- **config.ts** — `loadConfig(env)` pure function. State dir defaults to
  `~/.allternit/subscriptions/` (`SUBS_GATEWAY_STATE_DIR`); DB at
  `<state>/state.db`, artifacts sharded `<state>/artifacts/<sha256[0:2]>/<sha256>`
  via `artifactPath()`, UDS at `<state>/gateway.sock`, TCP `127.0.0.1:7788`
  off unless `SUBS_GATEWAY_TCP=1`. Policy file `<state>/policy.yaml` parsed by
  a documented flat `key: value` YAML subset (no YAML dependency); `~` is
  expanded manually.
- **store/db.ts** — better-sqlite3 open/create with `journal_mode=WAL` and
  `foreign_keys=ON`, plus a migration runner: `migrations` ledger table,
  applies `src/store/migrations/*.sql` in filename order inside a transaction,
  idempotent on re-run (tested — data survives a second run).
- **store/migrations/0001_init.sql** — `accounts`, `quota_pools`, `tasks`,
  `task_attempts`, `artifacts`, `thread_mappings`, `events` (append-only,
  `UNIQUE(task_id, seq)`), `caller_outbox` (PK `(event_id, caller_id)`, D12),
  `adapter_stats`, `tokens`. Columns mirror contracts field names; nested
  contract objects are JSON text. `tasks` carries a partial unique index on
  `(requester_id, idempotency_key)`.
- **store/queries.ts** — dependency-injected helpers: task insert/get/
  update-status (attempts reassembled into the contract `Task`), append-only
  event insert with monotonic per-task `seq`, outbox enqueue (`INSERT OR
  IGNORE` — idempotent on `event_id`) / mark-delivered / ack /
  fetch-undelivered in ledger insertion order, token lookup by hash, account
  upsert/get.
- **security/tokens.ts** (§A6.2) — `sgw_`-prefixed bearer tokens; sha256 hash
  stored, plaintext returned once; `verifyToken` confirms via
  `crypto.timingSafeEqual`; `revokeToken` sets `revoked_at`. Five scopes per
  §A6.2.
- **security/keychain.ts** (D3) — injectable `KeychainBackend`; the real
  backend shells out to `/usr/bin/security` (service
  `com.allternit.subscription-gateway`, exit 44 = miss). `requireKeychain()`
  throws `KeychainUnavailable` when the backend is down — the Phase 2 boot
  gate. `getOrCreateMasterKey()` returns a stable 32-byte base64 key stored
  under account `master-key`. One-line D15 Windows/DPAPI note included.
- **security/redact.ts** (§A6.8) — `redactText` masks emails, digit runs ≥6,
  bearer headers, `sgw_`/`sk-` tokens, JWTs; `redactExcerpt(s, max=500)`
  redacts then hard-truncates. Table-driven tests.
- **security/navlock.ts** (§A6.5) — pure `isOriginAllowed` (exact host match
  against manifest origins + extras, https required except loopback) and
  `assertNavigationAllowed` throwing typed `NavigationDenied`.

## Verification evidence

44/44 vitest tests pass across 5 files: migration idempotency + fresh-boot
schema + WAL/foreign-key pragmas, task/attempt round-trips, monotonic event
seq, outbox enqueue→undelivered(ordered)→deliver→ack, token issue/verify/
revoke + hash-only storage, keychain boot-refusal and master-key stability,
redact and navlock tables. `tsc -b` build is clean and emits `dist/` with
migrations copied alongside. The no-provider-name-literals gate passes over
all service sources.
