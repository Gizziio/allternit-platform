# 2026-09-26 05:48 — session/subsfab-p3 — kimi-code — subscription-gateway P3 phase 1 (worker layer + artifact store)

**PR:** #747 · **Merge SHA:** 4eb92f26d (merge commit) · **Branch:** session/subsfab-p3 (deleted after merge)

## What was done

Executed `docs/specs/subscription-fabric/p3/P3_PHASE_1_TASK.md` exactly: Phase 1 of 3 of P3 — the subscription-gateway worker layer plus the real content-addressed artifact store, fake-adapter tested. No provider adapter, no CLI (later phases).

- `src/artifacts/store.ts` — real contracts `ArtifactSink` (§A6.6): temp-file streaming under `<state>/artifacts/tmp/`, sha256 verify against `file.sha256`, magic-byte MIME verify (png/jpeg/webp/gif/pdf/zip; OOXML accepted as zip), content-addressed sharded commit, `com.apple.quarantine` xattr via `/usr/bin/xattr -w`, `local_path` stored relative to the artifact root, idempotent `fail`, never auto-opens.
- `src/queue/scheduler.ts` — pure per-`(provider, account_id)` FIFO queues with `interactive > normal > background` lanes; background never dequeued while higher lanes wait for the same worker (§A8). Table-tested.
- `src/worker/worker.ts` — `runAttempt` executor: attempt row with sha256 prompt fingerprint, SDK `createExecutionContext` wired with the real sink / manifest pacer / selector resolver / redacting logger, durable two-write `markSubmitted` (`sent_unconfirmed` → `acknowledged`) on `task_attempts`. Consumes the full `AdapterEvent` union into the ledger (outbox + SSE fan-out intact); quota.signal → quota_pools, model.observed mismatch on reasoning/deep → pool degraded (§A4), needs_user pause, detached → provider_running + watch handoff, done → completed/partial with result artifacts. Error or throw while `sent_unconfirmed` → `submission_ambiguous`, retryable false, fallback_eligible false — never resubmitted.
- `src/worker/supervisor.ts` — per-`(provider, account_id)` lifecycle (§A8): `ensureWorker` reconciles `sent_unconfirmed` attempts while the lane is gated (`nextTask` null until ready); `crash` re-runs the full recovery rule; per-attempt stall watchdog (90 s default / 1200 s research.deep / config-overridable via policy keys) fails tasks `stalled`, retryable only when `not_sent` (§A9); injectable timers; aborts the worker stream on stall; terminal guard prevents double finalization.
- `src/worker/reconcile.ts` — §A2 sweep: acknowledged/duplicate → adopt thread + resume, not_found → fail `submission_ambiguous`, ambiguous or missing adapter/reconcile → needs_user. Blind resubmit structurally impossible (reconcile never calls execute).
- `src/worker/detach.ts` — watch scheduler: doubling backoff capped at 15 min, injectable timers, cancel; watch ctx is read-only (markSubmitted throws).
- `src/worker/progress.ts` — thin D11 bridge (event → ledger kind mapping incl. progress.heartbeat, artifact.partial previews ledgered as byte counts) + watchdog activity tracker.
- http wiring — `POST /v1/tasks` enqueues into the scheduler (stays queued with zero adapters; StaticRouter still no-routes); cancel dequeues.
- `store/queries.ts` — attempt update + sent_unconfirmed sweep, artifact insert/storage-update/list, quota pool upsert/get/recordQuotaSignal; `updateTaskStatus` gained result/error options.
- `config.ts` — `stall_timeout_s` / `stall_timeout_s.<capability>` policy keys.
- Sentinel: `docs/specs/subscription-fabric/p3/P3_PHASE_1_NOTES.md` (deviations + remaining work listed there).

## Verification evidence

- `pnpm -F subscription-gateway build` — PASS (tsc -b project references incl. new SDK reference, clean; re-run after merging origin/main, still clean).
- `pnpm -F subscription-gateway test` — PASS, 16 files, **108/108** (all 77 P1 tests green; 31 new).
- Provider-literal gate: `grep -riE 'chatgpt|claude|kimi|gemini|grok|deepseek|openai|anthropic' services/subscription-gateway/src services/subscription-gateway/test` — no matches.
- Never-resubmit proven by test (test/supervisor.test.ts): sent_unconfirmed attempt + reconcile not_found → `submission_ambiguous` with `submissionCount === 1` / `executeCalls === 1`.
- Worker happy path drives the SDK `complete` fixture in a real browser via the fixture-web declarative adapter (bundled chromium first, system-Chrome fallback — no `playwright install`, per environment note).
- Quarantine xattr read back with `/usr/bin/xattr -p com.apple.quarantine` (test/artifacts.test.ts).

## Incidents

- PR merge initially blocked CONFLICTING: `.steering/checkpoint.md` conflicted with session/gizzi-tui-parity's checkpoint (their work had already landed; kept this session's checkpoint). Resolved, merged main into the branch, re-ran build+test (green), merged.

## Deferred / honest notes

- Desktop binary rebuild skipped: this session touched only `services/subscription-gateway` + its spec docs — nothing the desktop bundles.
- Phase 2 remaining: real adapter registration, dispatcher draining supervisor-gated lanes, SdkAdapterRuntime attach/probe, real watch-page reconcile ctx, main.ts config→supervisor wiring. `artifacts/preview.ts` still unbuilt (not in this phase's deliverables).
- Reconcile ctx in Phase 1 tests is a dummy ExecutionContext (fake adapter ignores it); missing makeCtx/adapter/reconcile is treated as ambiguous per spec.
