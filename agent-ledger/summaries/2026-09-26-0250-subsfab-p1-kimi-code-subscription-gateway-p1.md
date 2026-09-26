# Attestation — session/subsfab-p1 — Subscription Gateway P1 (skeleton + store + security + D12 spine)

**Date:** 2026-09-26 ~02:50 CDT
**Agent:** Kimi Code (orchestrator) + kimi CLI executor (regular K3 model, per Eoj's switch away from glm/deepseek)
**PR:** #738 — merged as merge commit `b1943a704` (merge, not squash)
**Branch:** `session/subsfab-p1`, cut from `origin/main` @ `2654916c4`

## What was done

P1 of the Subscription Capability Fabric (IMPLEMENTATION_PLAN §2): the Subscription Gateway daemon skeleton at `services/subscription-gateway/`:

- **store/** — better-sqlite3 13.0.3 (WAL, foreign_keys), idempotent transaction-wrapped migration runner, 9 tables mirroring P0 contracts (accounts, quota_pools, tasks w/ partial unique idempotency index, task_attempts, artifacts, thread_mappings, events append-only with UNIQUE(task_id,seq), caller_outbox D12, adapter_stats, tokens hash-only); dependency-injected typed queries
- **security/** — scoped bearer tokens (§A6.2, sha256 at rest, timingSafeEqual), D3 keychain boot-refusal via `/usr/bin/security` with injectable backend + master-key provisioning, redaction (§A6.8), navlock predicate (§A6.5, loopback-exempt)
- **events/** — append-only ledger with monotonic per-task seq; SSE hub (drop-oldest + gap markers); **D12 completion-push spine** (durable per-caller outbox, acked at-least-once delivery, reconnect replay idempotent on event_id, 7d acked retention); terminal-state notify (CommRails peer message for bot requesters, desktop drop file for user/cli/system, MCP no-op stub for P5; failures → `notify.failed` ledger rows, never crash)
- **http/** — UDS default (0600, stale-socket unlink) + optional loopback TCP 7788 (token-always); Host guard (arrival-port comparison, DNS-rebinding defense) + Origin guard (default deny-all) per §A6.1; scope-enforced routers for tasks/events/artifacts/accounts/capabilities; unauthenticated `/v1/health`
- **main.ts** — boot: config → requireKeychain (D3 refusal) → migrations → wire → listen; graceful shutdown with WAL checkpoint; `router/resolve.ts` static no-route stub (real router P4)
- **docs** — 7788 registered in `docs/Operations/PORT_REGISTRY.md` (new Local Daemons section) and `QUICK_REFERENCE.md`

## How it was verified (P1 gate, orchestrator-independent)

- `pnpm -F subscription-gateway build` PASS (tsc -b), `test` PASS **77/77** (10 files) — incl. D12 outbox-replay gate (disconnect → reconnect → exactly the missed events exactly once → ack → no further replay), D3 keychain-refusal boot, scope 403s, Host/Origin 403s, migration idempotency
- **Live smoke 7/7** against the real daemon booted through the real macOS keychain: UDS `/v1/capabilities` → `[]`, TCP no-token → 401, TCP token → `[]`, bad Host → 403, any Origin → 403, socket mode 0600, `/v1/health` → 200. Smoke daemon + scratch fully cleaned up afterward (4 orphan pnpm/tsx processes killed, /tmp state removed, 7788 verified free)
- Provider-name-literal gate grep over src+test: zero matches
- Executor deviations (7) each reviewed and accepted — documented in `docs/specs/subscription-fabric/p1/P1_PHASE_2_NOTES.md`

## Incidents / honest deferrals

- **tmux server died with the deleted-P0-worktree cwd** (ENOENT on every new pane). Fixed by killing the stale tmux server — the week-old detached `termius` session went with it. Noted for future orchestration: ao-spawn after any worktree teardown needs a fresh server or `-c` check.
- Regular kimi (K3) executor ran both phases in one session cleanly — much better process compliance than glm-5.3-flash in P0 (which drifted and was killed).
- Deferred by design: at-rest encryption (master key provisioned, unused), outbox prune scheduling, worker/queue/adapters (P2/P3), real router (P4), MCP surface (P5).
- DAG gate skipped (owner waiver). Desktop rebuild skipped (new local-only daemon, not bundled).
- allternit-rails fork-storm origin still unknown; no recurrence this session.

## Next

P2 — adapter SDK + conformance suite + DeclarativeChatAdapter (platform/packages/subscription-adapter-sdk) per IMPLEMENTATION_PLAN §2, fresh session worktree.
