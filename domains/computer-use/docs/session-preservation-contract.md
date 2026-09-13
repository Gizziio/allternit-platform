# Session-Preservation Contract — Computer-Use Batches

**Status:** v1 (P2, 2026-09-12) — binding for `stagehand-batch-fork` phase P2 and later.
**Gate:** this contract is written and landed *before* the planning loop consumes
batches (spec deliverable gate). The planning loop's batch path (`core/batch_dispatch.py`)
implements exactly the record type defined here — no more, no less.

## 1. What state exists per run today

A computer-use run (one `PlanningLoop.run()` invocation, run id `cu-<hex>`) currently
owns or touches four state surfaces:

| Surface | Location | Lifetime | Written by |
|---|---|---|---|
| Run record | `runs.sqlite3` (`RunPersistence`) | Durable, terminal-status rows kept until TTL | Gateway router, at run start/finalize |
| Canonical event ledger | `events.sqlite3` (`EventLedger`, `canonical_events` table) | Durable, append-only | Gateway router (`_emit_canonical`) |
| Recording | `ActionRecorder` artifacts + `recordings_index` table | Durable files + index row | Recorder, per step |
| Sandbox env | `os.environ` injection via `sandbox_env_context` | Run-scoped, restored after | Gateway router around the run |

The browser/page itself lives outside the Python process: the batch executor
(P1, `cmd/allternit-api/src/aci_batch.rs`) spawns the vendored runtime sidecar,
which owns a Chrome tab over CDP. The page, its cookies, localStorage, and DOM
state belong to that browser session, not to the run.

## 2. What survives a batch boundary

A **batch** is a grant-bound descriptor of N ordered whitelisted actions executed
back-to-back in one transport call (`POST /api/aci/batch`, spec §P1).

**Survives a batch boundary** (because it lives in the browser, which outlives any
single batch):

- The browser process and tab (microVM/host Chrome owned by the sidecar session).
- Page state: DOM, cookies, localStorage/sessionStorage, scroll position — whatever
  the granted steps changed or left alone.
- The run's durable records (runs table, event ledger, recordings) — these are
  run-scoped, not batch-scoped, and persist regardless.

**Does NOT survive a batch boundary:**

- Any implicit model "scratch" state — chain-of-thought, working memory, partial
  reasoning. The model is stateless between turns; nothing here changes that.
- Per-batch scratch context (spec REPL semantics, ADOPT #1): the in-browser scratch
  context the runtime may create at batch start is **discarded when the batch
  completes**. Nothing in the Python engine reads or writes it; if scratch state
  ever escapes the batch context, that is a bug, not a feature.
- Grant state: batch grants are single-use and consumed at dispatch.

**Rule (binding): cross-batch state is carried only as explicit ledger/receipt
writes.** If the model or engine needs something from batch k to inform batch k+1,
the only legitimate carriers are:

1. The batch receipt (`batch-receipts.jsonl`, Rust side) — descriptor hash, per-step
   outcomes, halt position. Pointed at by the batch-context record (§4).
2. The batch-context record on the canonical event ledger (§4).
3. The observation returned to the planning loop (`LoopStep.after_screenshot_b64`,
   AX snapshot, extracted text) which flows into the next plan call as history.

Anything else — REPL variables, module globals, undocumented caches — is not a
persistence channel and must not become one without a contract revision.

## 3. Concurrent-run isolation — the named os.environ tradeoff

Run-scoped sandbox env is injected by mutating the process-wide `os.environ`
(`core/sandbox_env.py`, `sandbox_env_context`). Concurrent runs in one gateway
process therefore share one environment namespace: **overlapping runs that set the
same variable name see last-writer-wins values for the overlap window.** This is a
known v1 tradeoff, documented in `sandbox_env.py`; per-run OS-environment isolation
is a v2 concern. Batches do not change it — a batch inherits whatever environment
the enclosing run established, and batch steps never receive env material the run
did not already have. This contract names the tradeoff; it does not pretend it is
solved.

Batch-specific concurrency note: two batches against the **same** browser session
execute sequentially behind the run's own loop; two batches against *different*
sessions are isolated by the sidecar's per-dispatch browser. The engine must not
interleave two batches within one run — the planning loop issues at most one batch
per plan turn.

## 4. The batch-context record (the one new record type)

To make "what happened across the boundary" explicit and durable, every batch
dispatched by the planning loop writes exactly two canonical ledger events through
the existing `EventLedger` surface (no new tables, no new stores):

- `batch.context.opened` — written **before** the batch RPC is sent
  (audit-before-act, matching the Rust receipt ordering).
- `batch.context.closed` — written after the batch response returns, carrying the
  outcome.

Payload schema (both events; `closed` adds the outcome fields):

| Field | Type | Meaning |
|---|---|---|
| `batch_id` | string | The descriptor SHA-256 — the same hash the grant binds (from the dispatch response; `pending` in `opened` when not yet known from a denial). |
| `descriptor_hash` | string | Same value, named for the grant surface. |
| `run_id` / `session_id` | string | Owning run and browser/session binding. |
| `step_count` | int | Number of descriptor steps. |
| `step_methods` | string[] | Whitelisted method names only (e.g. `["click","fill"]`). **Arguments are never recorded here** — typed text can be secret material; the Rust receipt owns outcome detail under its own rules. |
| `origin` / `page_url` | string | Descriptor binding. |
| `batch_mode` | string | Grant mode requested by the engine (`batch` one-grant / `per_step`). |
| `receipt_id` | string, closed only | Pointer to the Rust batch receipt — the per-step outcomes live there, not here. |

`closed` outcome fields: `status` (`completed` | `completed_halted` | `denied` |
`failed`), `halted_at` (int or null), `steps_completed`, `model_turns_saved`
(number of plan turns this batch replaced, for the P3 turns-per-task substrate).

This is deliberately a *pointer record*, not a duplicate receipt: the authoritative
per-step outcomes stay in the Rust `batch-receipts.jsonl` (single writer, hash-bound),
and the canonical ledger carries the run-scoped context that links a run's model
turns to the exact granted batch it dispatched.

## 5. Versioning

- The contract version is the `contract_version` field recorded in each
  `batch.context.*` payload, starting at `1`.
- Adding fields is a minor revision (allowed freely; old readers ignore new fields).
- Changing the meaning of an existing field, or adding a new *kind* of cross-batch
  state carrier, is a major revision and requires updating this document and the
  spec's REPL-semantics section in the same PR.
- The record type in code is `core/batch_context.py` (`BatchContextRecord`,
  `open_batch_context` / `close_batch_context`). If this doc and that code disagree,
  the doc is wrong — fix the doc in the same PR.

## 6. What this contract explicitly rejects (v1)

- No live model-mutable REPL with host-reachable state across batches
  (spec REPL semantics REJECT #1).
- No model-authored code in the state context (REJECT #2); the model's only output
  vocabulary in a batch is the 11-action whitelist.
- No implicit persistence through module globals, provider instances, or browser
  scratch beyond the batch context's own discard rule.
