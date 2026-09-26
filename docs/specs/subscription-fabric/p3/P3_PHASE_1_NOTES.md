---
status: done
files_changed:
  - services/subscription-gateway/package.json
  - services/subscription-gateway/tsconfig.json
  - services/subscription-gateway/src/config.ts
  - services/subscription-gateway/src/main.ts
  - services/subscription-gateway/src/store/queries.ts
  - services/subscription-gateway/src/artifacts/store.ts
  - services/subscription-gateway/src/queue/scheduler.ts
  - services/subscription-gateway/src/worker/worker.ts
  - services/subscription-gateway/src/worker/supervisor.ts
  - services/subscription-gateway/src/worker/reconcile.ts
  - services/subscription-gateway/src/worker/detach.ts
  - services/subscription-gateway/src/worker/progress.ts
  - services/subscription-gateway/src/http/server.ts
  - services/subscription-gateway/src/http/routes_tasks.ts
  - services/subscription-gateway/test/helpers.ts
  - services/subscription-gateway/test/scheduler.test.ts
  - services/subscription-gateway/test/artifacts.test.ts
  - services/subscription-gateway/test/worker.test.ts
  - services/subscription-gateway/test/supervisor.test.ts
  - services/subscription-gateway/test/detach.test.ts
  - services/subscription-gateway/test/http-enqueue.test.ts
deviations:
  - "createArtifactStore(db, config) returns the ArtifactSink directly; the per-attempt source context (task_id, attempt_no, provider, account_id, adapter, thread/project/bot, sensitivity) rides on config.source, so the worker constructs one sink per attempt. The §S5 artifact row needs those fields and the contracts begin(ref, meta) signature does not carry them."
  - "MIME verify treats OOXML (pptx/docx/xlsx) as matching when magic bytes sniff zip — they are zip containers; the declared format/mime is then kept on the row. Unknown magic bytes → failed (the recognized set is exactly png/jpeg/webp/gif/pdf/zip + OOXML)."
  - "Supervisor reconcile ctx: reconcileAttempts takes an optional makeCtx (watch-page ExecutionContext factory). When the adapter or its reconcile fn OR makeCtx is missing, the attempt is treated as ambiguous per spec; in Phase 1 tests makeCtx is a dummy since the fake adapter's reconcile ignores ctx. Phase 2 wires the real watch-page ctx."
  - "reconcileAttempts gained an optional filter { provider, account_id } so the supervisor sweeps only its own worker key on (re)start; attempts with a missing adapter are included when the account matches (they take the no-adapter ambiguous path)."
  - "acknowledged/duplicate reconcile outcomes set the task back to running (adopted) with a status_detail noting the adoption; spec says 'task resumes/adopts' without naming a status."
  - "Watchdog stall timeout defaults live in two layers: WorkerSupervisor default (1200 s research.deep, else 90 s) and config.stallTimeoutFor(config, capability) reading policy keys stall_timeout_s / stall_timeout_s.<capability> — the supervisor's stallTimeoutS dep is the injection point main.ts will wire to config in Phase 2."
  - "Worker status transitions: progress/reply/heartbeat events flip running → streaming but deliberately leave provider_running untouched (detached execution is still provider-side; Critical #3)."
  - "http wiring: GatewayDeps.scheduler is optional; POST /v1/tasks enqueues after insert + task.created ledger event, cancel removes from the queue. With zero adapters the task parks in the 'unrouted' lane and the StaticRouter still returns no-route, as specified."
remaining:
  - "Phase 2 (P3_PHASE_2_TASK.md): real adapter registration, route→router→worker activation (dispatcher that drains supervisor-gated lanes into runAttempt), SdkAdapterRuntime attach/probe on worker start, real watch-page makeReconcileCtx, config→supervisor stallTimeoutS wiring in main.ts."
  - "artifacts/preview.ts (sandboxed preview bundles) is still unbuilt — not in this phase's deliverables."
  - "Detached watch pages currently share the task's artifact sink; watch-side partial-artifact capture paths land with the real adapter."
verify:
  - "pnpm -F subscription-gateway build — PASS (tsc -b project references incl. the new SDK reference, clean)"
  - "pnpm -F subscription-gateway test — PASS (16 files, 108/108 tests; all 77 P1 tests still green)"
  - "grep -riE 'chatgpt|claude|kimi|gemini|grok|deepseek|openai|anthropic' services/subscription-gateway/src services/subscription-gateway/test — no matches"
  - "Never-resubmit proven: supervisor restart test counts submissions — sent_unconfirmed attempt + reconcile not_found → task failed submission_ambiguous with submissionCount === 1 and executeCalls === 1 (test/supervisor.test.ts)"
  - "Worker happy path drives the SDK complete fixture in a real browser (bundled chromium, system-Chrome fallback) via the fixture-web declarative adapter (test/worker.test.ts)"
  - "Quarantine xattr read back with /usr/bin/xattr -p com.apple.quarantine (test/artifacts.test.ts)"
---

# P3 Phase 1 — subscription-gateway: worker layer + artifact store

Phase 1 of 3 of P3 per `docs/specs/subscription-fabric/p3/P3_PHASE_1_TASK.md`:
the worker layer that executes adapters, plus the real content-addressed
artifact store. P1 (store/security/http/events) and P2 (adapter SDK) were
built on as-is; no defects found in either.

## What landed

- **`src/artifacts/store.ts`** (§A6.6) — the real contracts `ArtifactSink`:
  `begin` inserts the artifact row (`retrieval_state: downloading`) and opens a
  temp file under `<state>/artifacts/tmp/`; `write` streams chunks with an
  incremental sha256; `commit` verifies sha256 against `file.sha256`, verifies
  MIME by magic bytes (png/jpeg/webp/gif/pdf/zip, OOXML accepted as zip),
  renames to `<state>/artifacts/<sha256[0:2]>/<sha256>`, sets
  `com.apple.quarantine` via `/usr/bin/xattr -w`, and stores `local_path`
  **relative** to the artifact root; `fail` marks the row failed and removes
  the temp file (idempotent — the SDK calls it again after a commit throw).
  Nothing is ever auto-opened.
- **`src/queue/scheduler.ts`** (§A8) — pure per-`(provider, account_id)` FIFO
  queues with priority lanes `interactive > normal > background`; a background
  task is never dequeued while interactive/normal waits for the same worker.
  `enqueue`/`next`/`peek`/`remove`/`size`; unrouted tasks park under an
  `unrouted` key. Table-tested.
- **`src/worker/worker.ts`** (§A1/§A8, Critical #2) — the executor:
  `runAttempt` creates the attempt row (`not_sent`, sha256 prompt fingerprint
  over normalized prompt + input hashes), wires `createExecutionContext` with
  the real sink, manifest pacer, injected selector resolver, redacting logger,
  and a durable `onMarkSubmitted` that performs the two-write
  (`sent_unconfirmed` → `acknowledged`) on `task_attempts` before the adapter
  continues. Consumes the `AsyncIterable<AdapterEvent>`: every event appended
  to the ledger (`events/log.ts`, fan-out to outbox + SSE intact);
  running → streaming transitions; `quota.signal` → `quota_pools` upsert
  (hard_error → exhausted, soft signals → degraded); `model.observed` →
  attempt.observed_model + §A4 pool degraded when a reasoning/deep request is
  answered by a different model; `needs_user` → task paused with status_detail;
  `detached` → provider_running + watch handoff; `done` → completed/partial
  with result artifacts; `error`/throw while `sent_unconfirmed` →
  `submission_ambiguous` (retryable false, fallback_eligible false) — **never
  resubmitted**.
- **`src/worker/supervisor.ts`** (§A8) — worker lifecycle per
  `(provider, account_id)`: `ensureWorker` runs the reconcile sweep while the
  lane is gated (`nextTask` returns null until ready), `crash` re-runs the full
  recovery rule. Per-attempt stall watchdog with injectable timers: no event or
  heartbeat for `stall_timeout_s` (90 s default, 1200 s research.deep,
  config-overridable) → task failed `stalled`, retryable only when
  `submission_state = not_sent` (§A9). On stall the worker's AbortController is
  aborted; a terminal guard in the worker prevents double finalization.
- **`src/worker/reconcile.ts`** (§A2) — `reconcileAttempts(db, adapters, deps)`:
  `acknowledged` → attempt acknowledged + task resumes; `duplicate` → attempt
  acknowledged + provider_thread_id adopted, no resubmit; `not_found` → task
  failed `submission_ambiguous` (fallback_eligible: false); `ambiguous` or
  missing adapter/reconcile → task `needs_user`. Blind resubmit is impossible
  — reconcile never touches `execute`.
- **`src/worker/detach.ts`** (§A8/Critical #3) — watch scheduler: exponential
  backoff doubling from `poll_after_s`, capped at 15 min, injectable timers,
  cancel; a throwing poll reschedules (the stall watchdog owns failing the
  task). The worker's watch context is read-only: `markSubmitted` is replaced
  with a throw, so watch pages structurally cannot submit.
- **`src/worker/progress.ts`** (D11) — thin bridge: adapter events → ledger
  append (kind = event tag, `progress.heartbeat` included, `artifact.partial`
  previews ledgered as byte counts) + an activity tracker feeding the watchdog.
- **`src/http/` wiring** — `POST /v1/tasks` enqueues into the scheduler after
  insert; cancel removes. Minimal per spec: full route→router→worker
  activation is Phase 2.
- **`src/store/queries.ts`** — `updateAttempt`, `listAttemptsBySubmissionState`,
  `insertArtifact`/`updateArtifactStorage`/`listArtifactsForTask`,
  `upsertQuotaPool`/`getQuotaPool`/`recordQuotaSignal`; `updateTaskStatus`
  gained `result`/`error` options (backward compatible).
- **`src/config.ts`** — `stall_timeout_s` / `stall_timeout_s.<capability>`
  policy keys → `stallTimeoutFor(config, capability)`.

## Tests (31 new, 108 total)

- `scheduler.test.ts` — priority ordering, background-starvation guard, FIFO
  within lanes, per-key isolation, peek/remove, duplicate rejection.
- `artifacts.test.ts` — sharded sha-path commit with quarantine xattr read back
  via `xattr -p`, relative `local_path`, sha mismatch → failed, MIME mismatch →
  failed, unknown magic → failed, OOXML-as-zip verify, idempotent fail.
- `worker.test.ts` — happy path through the fixture-web declarative adapter
  driving the SDK `complete` fixture in a real browser (ledger order
  asserted, attempt `not_sent → sent_unconfirmed → acknowledged`, task
  completed with extracted text); durable two-write proven by reading the DB
  between `markSubmitted` calls; quota signal → pool degraded; model.observed
  downgrade → pool degraded; needs_user pause; sent_unconfirmed error →
  submission_ambiguous with exactly one submission; detach → provider_running +
  watch scheduled + resume completes the task.
- `supervisor.test.ts` — watchdog stall (retryable false when sent_unconfirmed,
  true when not_sent), heartbeat re-arm, per-capability 1200 s research.deep
  timeout; restart recovery: queue gated (`reconciling`) while reconcile runs,
  not_found → submission_ambiguous with **exactly one submission** across crash
  + recovery; acknowledged adopts thread without re-executing; missing adapter
  → needs_user.
- `detach.test.ts` — backoff schedule 5→10→20 s, 15 min cap, cancel, throwing
  poll reschedules.
- `http-enqueue.test.ts` — POST /v1/tasks enqueues (queued with zero adapters),
  cancel dequeues.
