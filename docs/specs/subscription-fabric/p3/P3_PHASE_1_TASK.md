# P3 Phase 1 Task — subscription-gateway: worker layer + artifact store (fake-adapter tested)

You are building Phase 1 of 3 of P3 in `services/subscription-gateway/` — the worker layer that executes adapters, plus the real content-addressed artifact store. P1 (store/security/http/events) and P2 (adapter SDK at `platform/packages/subscription-adapter-sdk/`) are merged and reviewed. **Do NOT build the chatgpt-web adapter or CLI** — later phases.

## Normative sources (read first)

- `docs/specs/subscription-fabric/IMPLEMENTATION_PLAN.md` — layout lines 57–120 (queue/worker/artifacts), P3 scope lines 152–157
- `docs/specs/subscription-fabric/REVIEW_CLAUDE.md` — **§A2/Critical #2 (at-most-once: markSubmitted two-write, reconcile, never blind-resubmit)**, **§A8 worker model (lines 510–517: one worker per (provider,account), 1 interactive page + N_watch=2 read-only watch pages, crash → reconcile sent_unconfirmed BEFORE queue resumes, stall watchdog per capability 90s chat / 20m deep research, retryable only if not_sent, fairness interactive>normal>background)**, §A4 (cooldown/circuit-breaker inputs), §A6.6 (quarantine, MIME verify, never auto-open)
- `docs/specs/subscription-fabric/HARDENING.md` — D11 (progress events already flow from the SDK; your job is bridging them into the ledger), profile ownership fix #6 (line 39: SingletonLock → `profile_locked`)
- Contracts `@allternit/subscription-fabric-contracts` and SDK `@allternit/subscription-adapter-sdk` — use them; the gateway package already builds with tsc -b project references. Add the SDK as a `workspace:*` dependency.

## Exact deliverables (all in `services/subscription-gateway/src/` unless noted)

1. `artifacts/store.ts` — the real contracts `ArtifactSink`: `createArtifactStore(db, config)` with `begin(ref, meta)` (artifact row, `retrieval_state: downloading`, temp file under `<state>/artifacts/tmp/`), `write(artifact_id, chunk)`, `commit(artifact_id, file)` (sha256-verify against `file.sha256`, move to `<state>/artifacts/<sha256[0:2]>/<sha256>`, set `com.apple.quarantine` xattr via `/usr/bin/xattr -w`, MIME verify by magic bytes — png/jpeg/webp/gif/pdf/zip/pptx/docx/xlsx — mismatch → `failed`), `fail(artifact_id, reason)`. Never auto-opens anything. Store row keeps `local_path` RELATIVE to the artifact root (contracts rule).
2. `queue/scheduler.ts` — per-`(provider, account_id)` FIFO queues with priority lanes `interactive > normal > background`: `enqueue(task)`, `next(provider, accountId)` (a background task is never returned while an interactive/normal task waits for the same worker, §A8), `peek`, `remove(taskId)` for cancel. Pure, table-tested.
3. `worker/supervisor.ts` — owns worker lifecycle per `(provider, account_id)`: `ensureWorker(key)`, crash detection → restart, and the **§A8 recovery rule**: before the queue resumes after any (re)start, every attempt in `sent_unconfirmed` goes through `reconcile()`. Per-attempt watchdog: no ledger event or adapter heartbeat for `stall_timeout_s` (per capability; defaults 90 chat, 1200 research, overridable in config) → fail as `stalled` (§A9 row: retryable only when `submission_state = not_sent`). Injectable clock/timers for tests.
4. `worker/worker.ts` — the executor: given an adapter (contracts `SubscriptionAdapter`) + browser page, wire the SDK `createExecutionContext` with the real artifact sink, pacer (from adapter manifest pacing), selector resolver, redacting logger, and a **durable markSubmitted** that performs the two-write transition on `task_attempts` (`sent_unconfirmed` → `acknowledged`) via store queries. Consume the adapter's `AsyncIterable<AdapterEvent>`: append every event to the ledger (`events/log.ts` — which already fans out to outbox + SSE), transition task status (`running`/`streaming` → terminal on `done`/`error`), map `quota.signal` → quota_pools update, `needs_user` → task `needs_user` + status_detail, `model.observed` → attempt.observed_model (+ §A4 downgrade: if requested_model_class was `reasoning|deep` and observed differs, mark the pool `degraded`), `detached` → hand off to detach.ts. Submission failures: `submission_ambiguous` when state is `sent_unconfirmed` at crash — **never resubmit**.
5. `worker/reconcile.ts` — §A2 recovery: `reconcileAttempts(db, adapters)` — for each `sent_unconfirmed` attempt call `adapter.reconcile(attempt, ctx)`; map `acknowledged` → mark attempt acknowledged + task resumes/adopts; `duplicate` → mark attempt, adopt provider_thread_id, do not resubmit; `not_found` → fail task `submission_ambiguous` (fallback_eligible: false); `ambiguous` → task `needs_user` with detail. Missing adapter/reconcile fn → treat as `ambiguous`.
6. `worker/detach.ts` — detached watch polling: `scheduleWatch(resumeToken, pollAfterS)` with exponential backoff (cap 15 min), resuming `adapter.resume(token, ctx)` on read-only watch pages; events flow like the interactive path. Watch pages never submit (read-only — enforce by not wiring a composer-capable context; document).
7. `worker/progress.ts` — thin bridge: SDK progress/heartbeat events → ledger append (kind mapping, `progress.heartbeat` included), updating the task's `last_change_at` used by the supervisor watchdog. Most logic already lives in the SDK/log — keep this file small.
8. `http/` wiring — replace the P1 placeholder task flow: `POST /v1/tasks` now enqueues into the scheduler (status `queued` → worker picks up when an adapter+worker exist; with zero registered adapters it stays queued and the static router still returns no-route). Keep the change minimal — full route→router→worker activation lands with the real adapter in Phase 2.
9. `test/` — vitest, all with a **fake adapter** (config-only, drives SDK fixture pages via the SDK's launchBrowser pattern — reuse `@allternit/subscription-adapter-sdk` test fixtures or embed minimal ones) and injectable clocks:
   - scheduler priority/fairness table tests
   - sink: commit lands at the sharded sha path, quarantine xattr set (read back with `xattr -p`), sha mismatch → failed, MIME mismatch → failed, local_path relative
   - worker happy path: fake adapter emits submitted/progress/done → ledger has the events in order, task completes, attempt went not_sent→sent_unconfirmed→acknowledged
   - watchdog: no events past stall_timeout → task failed `stalled`, retryable false when sent_unconfirmed
   - supervisor restart: sent_unconfirmed attempt → reconcile called BEFORE scheduler resumes; not_found → `submission_ambiguous`, and the task is NOT resubmitted (assert prompt_fingerprint submitted exactly once)
   - quota signal → pool row updated; model.observed downgrade → pool degraded
   - detach: scheduleWatch fires resume on the backoff schedule (fake timers)

## Hard gates

- `pnpm -F subscription-gateway build` and `test` PASS (all P1 tests stay green — 77 passing today).
- Never-resubmit proven by test (reconcile not_found path asserts exactly one submission).
- No provider-name literals in gateway `src/` or `test/` (fake adapter is `fixture-web`).
- No comments narrating code; one-line spec pointers only.

## Completion sentinel

Write `docs/specs/subscription-fabric/p3/P3_PHASE_1_NOTES.md` with YAML frontmatter (`status`, `files_changed`, `deviations`, `remaining`, `verify`) then prose. That file existing = done.
