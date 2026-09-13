# Allternit Computer Use — Safety & Evaluations

This is the system card for **Allternit Computer Use**: what we measure, how we
measure it, the current measured results, the approval and safety architecture
those results sit on, and what we have not measured yet.

Every number on this page is traceable to a file in the repository. Nothing
here is aspirational: where a measurement does not exist yet, the entry says
**pending measurement** and says why.

## How we measure (and how we don't)

Allternit Computer Use is evaluated with **in-repo conformance suites**, not
vendor-run benchmarks. The suites live in
`domains/computer-use/core/conformance/` and are executed by
`conformance.measured`, which writes its results — pass counts, pass rate, and
a grade — to `domains/computer-use/core/conformance/adapter_grades.json`.
Grades are computed from measured pass rates, never declared:

| Grade | Measured pass rate |
|-------|--------------------|
| `experimental` | < 50% |
| `beta` | 50–89% |
| `production` | ≥ 90% |

We want to be explicit about what this means:

- These are **deterministic conformance checks** (does navigation, extraction,
  screenshotting, JS evaluation, and the result envelope contract work against
  real targets), plus routing/policy enforcement checks. They are not
  end-task success benchmarks like WebArena, OSWorld, or WebVoyager scores.
- **We have not run any vendor-published agentic benchmark.** No such number
  appears on this page. That is a pending measurement, not a hidden one.
- An adapter whose runtime is unavailable at measurement time is recorded as
  `measured: false` with a `null` grade rather than being silently dropped or
  given a declared grade.

## Measured adapter conformance

Recorded in `adapter_grades.json` (last updated 2026-09-09). Each row names
the suite definition in `domains/computer-use/core/conformance/suites.py`.

| Adapter | Suite | Measured | Pass rate | Grade |
|---------|-------|----------|-----------|-------|
| `browser.playwright` | `browser-deterministic-v1` (8 tests) | yes | 8/8 = 100% | `production` |
| `browser.cdp` | `browser-deterministic-v1` (8 tests) | yes | 8/8 = 100% | `production` |
| `browser.mock` | `browser-deterministic-v1` (8 tests) | yes | 8/8 = 100% | `production` |
| `retrieval.playwright-crawler` | `retrieval-v1` (5 tests) | yes | 5/5 = 100% | `production` |
| `hybrid.orchestrator` | `hybrid-v1` (3 tests) | yes | 3/3 = 100% | `production` |
| `_routing_policy` | `routing-policy-v1` (6 tests) | yes | 6/6 = 100% | `production` |
| `browser.browser-use` | `browser-adaptive-v1` (3 tests) | **pending measurement** — browser-use runtime unavailable at measurement time | — | ungraded |
| `desktop.pyautogui` | `desktop-v1` (4 tests) | **pending measurement** — suite requires an interactive display (`--desktop`) | — | ungraded |

Two honest caveats on the measured rows:

- `hybrid.orchestrator` was measured with `browser.mock` as the registered
  sub-adapter, offline. The grade covers orchestration semantics (delegation,
  workflow chaining, envelope contract), not real cross-family execution.
- The browser-deterministic and retrieval suites hit real sites
  (`example.com`, `httpbin.org`). They measure live automation behavior, but
  they are conformance checks, not adversarial or long-horizon task
  evaluations.

### Batch dispatch (measured 2026-09-12)

Grant-bound batch dispatch (spec `stagehand-batch-fork`, P1–P2) is measured
outside `conformance/suites.py` — the suites live in the Rust crate and the
pytest tree, so they are recorded here instead of in `adapter_grades.json`:

| Component | Suite | Pass rate | Grade |
|-----------|-------|-----------|-------|
| Batch grant gate (Rust `aci_batch`) | `cargo test -p allternit-api --lib aci_batch` (19 tests: descriptor hashing, tamper/expiry/replay rejection, per-step fallback, receipts) | 19/19 = 100% | `production` |
| Adversarial batch-grant recall (Rust `aci_batch_adversarial`) | `cargo test -p allternit-api --lib aci_batch -- --nocapture` (35 scripted attack cases across 6 classes: descriptor tampering, replay, scope widening, mixed-risk routing, expiration, receipt-chain integrity) | 35/35 = 100% blocked | `production` |
| Engine batch dispatch | `tests/test_batch_dispatch.py` (20 tests: plan→grant→batch→observation, halt-at-first-failure, fallback paths) + `tests/test_batch_adversarial.py` (17 engine-side attack assertions: denied retries fail closed, steps stable between attempts, no-receipt fails closed, approval kinds never batched) | 20/20 and 5/5 tests = 100% | `production` |
| Live gated batch (real stack) | 3-step batch → `confirmation_required` → handoff approve → real Chrome executed all steps → receipt `completed` 3/3, `one_grant` | 16/16 = 100% | `production` |

Economics on the canned 3-step task: **4 model turns step-by-step → 2 turns
batched** (`model_turns_saved` is recorded on the batch-context ledger event).

Adversarial recall, honestly scoped: the attack cases are **scripted** — a
hand-enumerated adversary (per-field descriptor mutations, grant replay and
cross-user redemption, scope widening, TTL races, offline receipt-trail
tampering), not a trained attacking model. Every scripted attack is blocked:
each mutation or widening changes the SHA-256-bound descriptor hash and is
denied `approval_denied`, grants are single-use and owner-bound, expired
grants are refused with a denied receipt on the trail, and the batch-receipt
JSONL now carries a SHA-256 hash chain — `verify_batch_receipt_chain`
detects an altered, dropped, reordered, or injected record. Reproduce:

```bash
# Rust gate + adversarial suite (per-class tallies with --nocapture)
cargo test -p allternit-api --lib aci_batch -- --nocapture
# Engine dispatch + engine adversarial suite
cd domains/computer-use/core && PYTHONPATH="." python -m pytest \
  tests/test_batch_dispatch.py tests/test_batch_adversarial.py -q
```

Remaining caveats: small *n* (one live task shape so far — the number shows
the mechanism works end-to-end, not long-horizon reliability); batch model
emission was exercised with a scripted provider, not a frontier vision model;
recall against an *adaptive* (model-driven) adversary is still unmeasured —
the scripted suite covers the known attack surface, not novel attacks.
Record→teach→batch workflow compilation is deferred.

## Safety architecture

### Confirmation taxonomy and approval grants

Every computer-use action on every entry route — the ACU planning loop
(`/api/aci/run`), the direct control routes (`/api/v1/computers/:id/*`), and
the capability path (`/tools/execute`) — is classified server-side in
`cmd/allternit-api/src/aci_safety.rs` as:

- **reversible** — read-only or trivially undoable (cursor moves, file reads,
  `ls`). Proceeds without confirmation.
- **risky** — state-mutating but usually undoable (clicks, typing that
  submits, writes to user files, `rm`, package installs, `git push`).
- **irreversible** — destructive or hard to undo (`rm -rf /`, `mkfs`, writes
  under `/etc`, `~/.ssh`, `C:\Windows`).

Risky and irreversible actions require an approval grant minted by
`cmd/allternit-api/src/aci_approvals.rs`. Grants are:

- **Hash-bound** — bound to the SHA-256 of a canonical serialization of the
  exact action payload. An action whose hash differs from the granted hash is
  denied with `approval_denied`, even with a valid-looking `approval_id`.
- **Single-use** — redemption consumes the grant; replay is denied.
- **Expiring** — grants lapse after a short TTL (default 120 seconds via
  `ALLTERNIT_ACI_GRANT_TTL_SECS`, aligned with the planning loop's approval
  timeout).
- **Receipted** — every redemption attempt, allowed or denied, is recorded as
  an immutable receipt for audit (retention capped at 10,000 entries). Batch
  receipts additionally carry a SHA-256 hash chain — an altered, dropped,
  reordered, or injected trail record is detectable offline (see the batch
  dispatch section).

Enforcement is entirely server-side; a compromised or modified client cannot
approve its own actions. The TypeScript SDK's approval predicates are a UX
pre-filter only.

### Backend safety policy

`aci_safety.rs` also enforces, on the API side (so a misconfigured client
cannot bypass it):

- **Host allowlisting/blocklisting** — URLs extracted from the run goal are
  checked against `ALLTERNIT_ACI_ALLOWED_HOSTS` / `ALLTERNIT_ACI_BLOCKED_HOSTS`
  / wildcard patterns. Modes: `enforce` (default), `audit` (log and allow),
  `off`.
- **Sensitive-data masking** — API keys, bearer tokens, passwords, credit
  card numbers, and SSN-like patterns in the goal text are redacted before the
  goal is used.
- **Sensitive-action handoff** — goals mentioning payments, CAPTCHA, identity
  verification, form submissions, or file up/downloads return
  `handoff_required` for a human instead of running autonomously.
- **Circuit breaker** — per-actor rate limits (default 30 actions/minute,
  300/hour) plus cooldown after bursts and after 5 consecutive errors.

### Declarative policy layer (optional, fail-closed)

An optional JSON policy document extends the rule engine in
`cmd/allternit-api/src/permission_policy.rs` with declarative, bot-scoped
rules. It is configured by pointing `ALLTERNIT_ACI_POLICY_FILE` at the
document and has three states:

- **Env unset** — the engine is off. Nothing in this section applies and
  behavior is unchanged from the pre-policy gateway (the default).
- **Env set, document missing/empty/malformed** (bad JSON, unknown action
  value, rule without `tool`) — the gateway refuses to start and names the
  offending rule in the log. A missing or broken policy never means an
  unguarded gateway.
- **Env set, valid document** — every action on the policy seats is
  evaluated before anything else. A document that parses to zero rules
  denies every action.

The document is `{"rules": [...]}` where each rule extends `PermissionRule`:

```json
{
  "rules": [
    { "id": "no-secrets", "tool": "aci.run", "intent": "*secret*", "action": "deny" },
    { "id": "bots-read-only", "tool": "computer.file_write", "botId": "bot-a", "action": "ask" },
    { "id": "default", "tool": "*", "action": "allow" }
  ]
}
```

Semantics:

- Every field a rule specifies must match the action descriptor (AND);
  fields the rule omits are wildcards.
- Precedence is deny, then ask, then allow. A matching deny anywhere in the
  document beats any allow. `ask` passes through to the existing
  grant/approval flow above unchanged — the policy layer never replaces it.
- An action no rule speaks for is denied (fail-closed).

Two seats evaluate the document, always policy-first, existing safety
machinery second — `aci_safety`, grants, `enforce_confirmation`, host policy,
and the circuit breaker all still run on every path:

- `POST /api/aci/run` — after goal validation, before `aci_safety` and grant
  redemption. The descriptor is `tool: "aci.run"`, the goal as intent, the
  optional `botId` request field as bot id, and the first `allowedSites`
  entry as host.
- `execute_computer_tool` (direct control routes and `computer_*` tools) —
  before confirmation enforcement and before anything touches the guest.

**Audit-before-act.** Every allow/deny decision is appended (write + flush +
fsync) to `<computer_use_dir>/policy_audit/policy_audit.jsonl` before the
action dispatches. A row therefore exists for every policy-gated action,
including refusals that never reached an executor and actions whose executor
failed afterwards. Rows carry `{ts, decision, rule_id, bot_id, session_id,
actor, tool, intent, host, path, mcp_tool, run_id}` with absent fields
omitted. `ask` verdicts write no row here — they fall through to the grant
flow, which persists its own redemption receipts before execution.

**Read API.** `GET /api/aci/policy/audit?bot_id=<id>&limit=<n>` (default
limit 100, capped at 1000) returns the newest rows first, filtered by bot id
when given.

If the audit row cannot be written, the gateway refuses the action instead
of running unaudited: an action that cannot be recorded does not dispatch.

### Run monitor

The ACU planning loop accepts a pluggable monitor
(`domains/computer-use/core/core/monitor.py`) that evaluates every step after
each OBSERVE phase and can pause the run for human review:

- **Heuristic monitor (default, always on)** — a prompt-injection keyword scan
  over extracted page text (13 patterns such as "ignore previous
  instructions"), plus identical-action loop detection (the same
  action+target repeated 5 consecutive times pauses the run as a likely
  stuck loop).
- **VLM monitor (optional swap-in)** — when `ACU_MONITOR_VLM_PROVIDER` is set,
  each step's screenshot plus pending action is classified by a
  vision-language model returning a one-line `continue` / `pause: <reason>`
  verdict. Heuristic checks run first as a cheap pre-filter; provider or
  network failures degrade to continue — a monitor failure never breaks a run.

### Credential vault

Computer-use runs that need credentials reference them **by name**; the
client never sends the secret. The server-side vault
(`cmd/allternit-api/src/aci_credentials.rs`, shipped in PR #177) resolves the
value at run-provision time and injects it into the sandbox environment
(`sandbox_env`) and nowhere else:

- Values are sealed with **AES-256-GCM** at rest; the store refuses to write
  when no encryption key is configured rather than falling back to plaintext,
  and records without the `enc:v1:` sealed prefix are dropped at load.
- Plaintext is **never** placed in the model context, echoed by an API
  response, or written to logs, receipts, or run-event buffers.
- **TOTP seeds** are the exception to env injection (a seed in `env` would be
  bulk-exfiltratable by any command the model runs): the agent completes 2FA
  by calling `GET /api/aci/credentials/:name/totp`, which returns a fresh
  RFC 6238 code while the seed stays sealed.

### Cost observability

Every run records per-stage input/output/total token counts and an
`est_cost_usd` estimate on its persistent run record, exposed over the gateway
REST API (`GET /v1/computer-use/runs/{run_id}/cost` and
`GET /v1/computer-use/cost/summary`). Cost reporting is honest about its own
limits: `pricing` is `provider-reported` when the vision provider returns a
cost, `estimated` from token counts otherwise, and `unavailable` (all zeros)
for paths that make no LLM calls (direct, replay, and workflow runs). This is
observability, not billing.

## Known limits and pending measurements

- **Vendor agentic benchmarks** (WebArena, OSWorld, WebVoyager, and similar):
  pending measurement — no vendor-run benchmark has been executed yet.
- **Adaptive browser automation** (`browser.browser-use`,
  suite `browser-adaptive-v1`): pending measurement — the browser-use runtime
  was unavailable at measurement time. Install it (or place a venv at
  `~/browser-use/venv/`) and rerun the measurement command below.
- **Desktop automation** (`desktop.pyautogui`, suite `desktop-v1`, 4 tests):
  pending measurement — requires an interactive display; run the measurement
  with `--desktop`.
- **Cross-family orchestration under real adapters**: the hybrid grade was
  measured against a mock sub-adapter. Real multi-adapter orchestration is
  pending measurement.
- **VLM monitor accuracy**: the monitor's pause/continue precision and recall
  have not been benchmarked. Pending measurement.
- **Adversarial / red-team evaluation**: prompt-injection resistance is
  covered by the heuristic keyword scan and unit tests for masking and host
  policy, but no dedicated red-team exercise has been run. Pending
  measurement.
- **Grades are point-in-time.** A `production` grade reflects the last
  measurement in `adapter_grades.json`, not a guarantee about future runs.

## Reproduce it yourself

From the repository root, with the conformance venv active:

```bash
# Offline measurement: mock adapter, hybrid orchestrator, routing/policy
cd domains/computer-use/core
PYTHONPATH="." python -m conformance.measured

# Live measurement: adds real headless Chromium (playwright, crawler)
# and a CDP-attached Chrome when one is listening on ACU_CDP_PORT (default 9222)
PYTHONPATH="." python -m conformance.measured --network

# Desktop suite (needs an interactive display)
PYTHONPATH="." python -m conformance.measured --desktop
```

The pytest suites behind the grades:

```bash
cd domains/computer-use/core/gateway

# Measured-conformance harness (mock 8/8, hybrid 3/3, routing 6/6, grading honesty)
PYTHONPATH=".." python -m pytest ../tests/test_measured_conformance.py -q

# Run monitor (heuristic + VLM swap-in)
PYTHONPATH=".." python -m pytest ../tests/test_monitor.py -q

# Cost accounting and cost endpoints
PYTHONPATH=".." python -m pytest ../tests/test_cost_accounting.py -q
```

Rust safety enforcement:

```bash
cargo test -p allternit-api aci_   # aci_safety, aci_approvals, aci_credentials

# Batch grant gate (batch descriptors, tamper/expiry/replay, per-step fallback)
cargo test -p allternit-api --lib aci_batch

# Adversarial batch-grant recall (scripted adversary; per-class tallies)
cargo test -p allternit-api --lib aci_batch -- --nocapture

# Engine batch dispatch (plan→grant→batch→observation, halt-on-failure)
# + engine adversarial suite (denied retries fail closed, no-receipt fails closed)
cd domains/computer-use/core && PYTHONPATH="." python -m pytest \
  tests/test_batch_dispatch.py tests/test_batch_adversarial.py -q
```

As of this writing the Python suites above pass in full, the Rust `aci_`
tests pass (40/40), and the six graded rows in `adapter_grades.json` were
reproduced on 2026-09-09 by executing the conformance suites — the full
measurement where the runtimes were available, and the CDP suite directly
against a headless Chrome listening on the CDP port.
