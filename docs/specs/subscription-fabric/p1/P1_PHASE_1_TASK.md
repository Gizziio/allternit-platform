# P1 Phase 1 Task — subscription-gateway: scaffolding + store + config + security

You are building Phase 1 of 2 of `services/subscription-gateway/` (the Allternit **Subscription Gateway** daemon — always say "Subscription Gateway", never bare "gateway"). This daemon turns paid consumer AI subscriptions into addressable capabilities. **Do NOT start Phase 2 files** (events/*, http/*, main.ts, router/) — a second phase does those.

## Normative sources (read first)

- `docs/specs/subscription-fabric/IMPLEMENTATION_PLAN.md` §0–§2 (stack/placement, file layout lines 57–99, P1 verify+gate at lines 138–143)
- `docs/specs/subscription-fabric/HARDENING.md` — D3 (line 21: structural keychain boot-refusal), D12 (lines 96–104: caller_outbox), D15 refinement (line 147)
- `docs/specs/subscription-fabric/REVIEW_CLAUDE.md` — §A6 security (lines 480–491), §A8 worker model (lines 510–517)
- Contracts package (P0, merged): `platform/packages/subscription-fabric-contracts/` — **import its types/schemas** (`@allternit/subscription-fabric-contracts`, `workspace:*`) instead of redeclaring them.

## Repo conventions to match

- Service idiom: mirror `services/replies-runtime/` (ESM `"type": "module"`, `tsx` dev, `tsc` build, express for HTTP later).
- Tests: vitest (`"test": "vitest --passWithNoTests"` style scripts: `"test": "vitest run"`), like `platform/packages/subscription-fabric-contracts`.
- SQLite: `better-sqlite3` pinned **13.0.3** (exact, not caret), `@types/better-sqlite3` dev dep.
- No git operations. You MAY run `pnpm install` (repo root, pnpm only) and the package's build/test.

## Exact deliverables

Create `services/subscription-gateway/` with:

1. `package.json` — name `subscription-gateway`, version `0.1.0`, ESM. Deps: `better-sqlite3` 13.0.3 (exact), `express` ^4.18.2, `@allternit/subscription-fabric-contracts` workspace:*. Dev: `typescript` ^5.3.0, `tsx` ^4.7.0, `vitest` ^1.0.0, `@types/better-sqlite3`, `@types/express`, `@types/node`, `supertest` + `@types/supertest` (Phase 2 uses them; add now). Scripts: `dev` (tsx watch src/main.ts), `build` (tsc -b if project refs needed, else tsc), `typecheck`, `test` (vitest run), `start` (node dist/main.js).
2. `tsconfig.json` — mirror `platform/packages/subscription-fabric-contracts/tsconfig.json` (project reference to the contracts package if you import it — the contracts package shows the `tsc -b` pattern).
3. `README.md` — 20 lines max: what it is, UDS default, state location, keychain requirement.
4. `src/config.ts` — env + optional policy file loading. Defaults (all overridable by env, prefix `SUBS_GATEWAY_`): state dir `~/.allternit/subscriptions/` (`SUBS_GATEWAY_STATE_DIR`), DB at `<state>/state.db` (WAL), artifacts at `<state>/artifacts/<sha256[0:2]>/<sha256>`, UDS at `<state>/gateway.sock` (mode 0600), optional TCP `127.0.0.1:7788` (off unless `SUBS_GATEWAY_TCP=1`), policy file `<state>/policy.yaml` (parse minimally — a tiny hand-rolled YAML subset for flat keys is acceptable; document it; no new YAML dep). Expand `~` manually. Export a `loadConfig(env)` pure function + a `Config` type.
5. `src/store/db.ts` — better-sqlite3 open/create, `PRAGMA journal_mode=WAL`, `foreign_keys=ON`, and a **migration runner**: `migrations` table (`version INTEGER PRIMARY KEY`, `applied_at TEXT`), applies `src/store/migrations/*.sql` in filename order inside a transaction, **idempotent** (running twice is a no-op — test this).
6. `src/store/migrations/0001_init.sql` — tables mirroring the contracts schemas: `accounts`, `quota_pools`, `tasks`, `task_attempts`, `artifacts`, `thread_mappings`, `events` (append-only ledger: `event_id TEXT PRIMARY KEY`, `task_id`, `caller_id`, `seq INTEGER`, `kind TEXT`, `payload TEXT` JSON, `created_at`), `caller_outbox` (`event_id TEXT`, `caller_id TEXT`, `delivered_at TEXT NULL`, `acked_at TEXT NULL`, PK (event_id, caller_id) — D12), `adapter_stats` (`adapter_id`, `adapter_version`, `capability`, `success_count`, `failure_count`, `updated_at`), `tokens` (`token_id`, `caller_id`, `name`, `token_hash`, `scopes` JSON array, `created_at`, `revoked_at NULL`). Sensible columns/types/indices from the contracts package field names; JSON text for nested objects.
7. `src/store/queries.ts` — typed row mappers + prepared-statement helpers for: insert/get/update task status, append event (monotonic `seq` per task), outbox enqueue/deliver/ack/fetch-undelivered, token lookup by hash, account upsert/get. Every function takes the `Database` handle (dependency-injected, testable).
8. `src/security/tokens.ts` — per-caller scoped bearer tokens (§A6.2). Scopes: `tasks:submit | tasks:read | artifacts:read | accounts:manage | approve:external_publish`. `issueToken(callerId, name, scopes)` → returns plaintext token once, stores **sha256 hash** in `tokens` table; `verifyToken(db, presented)` → `{ caller_id, scopes } | null`; `revokeToken`. Constant-time hash comparison (`crypto.timingSafeEqual`).
9. `src/security/keychain.ts` — D3's structural local-only guarantee. Node has no keychain API, so shell out to macOS `/usr/bin/security` (`find-generic-password` / `add-generic-password`, service name `com.allternit.subscription-gateway`) via `child_process.execFileSync`. **Injectable backend**: `createKeychain(backend?)` where backend defaults to the real CLI but tests inject a fake. `requireKeychain()` returns the backend or **throws `KeychainUnavailable`** — `main.ts` (Phase 2) will call this at boot and refuse to start without it (D3). Also `getOrCreateMasterKey()` (32 random bytes, base64, stored under account `master-key`) used for future at-rest encryption. Windows/DPAPI note: one comment line only (D15 — the Sessions image needs a keychain-equivalent; out of scope here).
10. `src/security/redact.ts` — §A6.8: pure functions `redactText(s)` (mask email addresses, long digit runs ≥6, bearer-like tokens), `redactExcerpt(s, max=500)` for QuotaSignal.raw_excerpt-style audit strings. Table-driven tests.
11. `src/security/navlock.ts` — §A6.5: pure `isOriginAllowed(url, manifestOrigins, extraAllowed)` (exact host match against manifest origins + provider auth/CDN extras; scheme must be https except localhost), `assertNavigationAllowed(...)` throwing a typed error. The worker (later phases) enforces it at the context-route level; you only build the predicate + tests.
12. `test/` — vitest covering: migration idempotency + fresh-boot schema, queries round-trips incl. outbox enqueue/deliver/ack/undelivered ordering, token issue/verify/revoke (constant-time path), keychain boot-refusal (fake backend that throws → `requireKeychain` propagates `KeychainUnavailable`; fake working backend → master key stable across calls), redact table tests, navlock table tests (allowed origin, subdomain rejection, http rejection, localhost exception).

## Hard gates

- No provider-name literals (`chatgpt|claude|kimi|gemini|grok|deepseek|openai|anthropic`) anywhere in the service — same rule as P0.
- `pnpm -F subscription-gateway build` and `pnpm -F subscription-gateway test` both PASS before you finish.
- No comments narrating code; one-line spec pointers (// §A6) where useful.

## Completion sentinel

Write `docs/specs/subscription-fabric/p1/P1_PHASE_1_NOTES.md` with YAML frontmatter (`status`, `files_changed`, `deviations`, `remaining`, `verify`) then prose. That file existing = done.
