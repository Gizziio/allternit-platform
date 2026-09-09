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
  an immutable receipt for audit (retention capped at 10,000 entries).

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
```

As of this writing the Python suites above pass in full, the Rust `aci_`
tests pass (40/40), and the six graded rows in `adapter_grades.json` were
reproduced on 2026-09-09 by executing the conformance suites — the full
measurement where the runtimes were available, and the CDP suite directly
against a headless Chrome listening on the CDP port.
