# Attestation — session/cu23-codemode (code mode, P4 of stagehand-batch-fork)

**Date:** 2026-09-13, 10:40 local
**Agent:** kimi-code (D4 build session, orchestrated)
**PR:** #474 — merged as `b3de74950` (merge of `session/cu23-codemode`, squashed session commit `b2cfc30f3` + main-merge `ba562d18f`)
**Spec:** `Research/specs/code-mode-execution.md` (C0–C3)

## What shipped

Code execution as the THIRD Allternit computer-use integration mode — strictly
opt-in per run, never the default, behind the same grant discipline as actions
and batches.

- **C0 — grant gate (Rust, `cmd/allternit-api/src/aci_code.rs`).**
  `code_payload` descriptor: SHA-256 over exact code + language +
  origin/session binding. Refuse-list enforced at descriptor time (can NEVER
  be granted, only rewritten as whitelist actions): credential patterns
  (AWS/GitHub/Slack/Google/PEM/sk- literals), destructive/nested calls
  (`child_process`, `subprocess`, `fs.rm`, `rm -rf`, references to the
  code-mode surface itself), URL literals outside the declared task targets
  (fail-closed), host paths outside the run sandbox (absolute paths,
  traversal). Single-use expiring grant per payload; code is always `Risky`
  (no auto-pass). Chained code receipts (`code-receipts.jsonl`) with
  audit-before-act ordering; refusals and denials are receipted too. HTTP
  surface `POST /aci/code` + `/aci/code/receipts/:id`.
- **C1 — sandbox executor (`domains/computer-use/core/core/code_execution.py`
  + `code_runner.mjs`).** Payload runs in a `node:vm` context whose entire
  surface is scoped handles: declared-target-checked `page`/`fetch`
  (fail-closed egress), sandbox-dir-rooted `sandboxFs` (escape refusal),
  `process.env` limited to the `sandbox_env` allowlist — the ONLY credential
  path (PR #187 semantics; the spec file carries key names, never values).
  Hard caps: 30 s wall clock (kill), RLIMIT_AS memory cap, no nested code
  mode. Fixed result envelope only: truncated+scrubbed stdout, exit status,
  screenshot hash+ref. Nothing else crosses back.
- **C2 — loop integration (`core/code_mode.py`, `planning_loop.py`,
  `vision_providers.py`).** `PlanningLoopConfig.code_mode_enabled`, default
  `False` — with the default config a plan carrying a `code` payload executes
  the whitelist action and never touches the code client. When enabled: one
  grant-bound dispatch; `confirmation_required` routes through the same human
  approval flow as batch; validation refusals surface as the step's
  observation and the loop re-plans with whitelist actions — never a silent
  retry of mutated code (a mutation is a new descriptor needing a new grant);
  declined grants fall back to whitelist like batches. Session-preservation
  contract v1.2 gains §8: no state survives between code runs except explicit
  ledger writes; `code.context.opened/closed` records carry bytes + target
  hosts only — payload content never enters the ledger.
- **C3 — measurement + publish.** `docs/public/aci/safety.md` code-mode
  subsection with measured numbers and honest caveats.
  `scripts/code_mode_smoke.sh` — the reproducible live end-to-end.

## Verification evidence

| Suite | Result |
|---|---|
| `cargo test -p allternit-api --lib aci_code` (grant/redeem/replay/tamper/expiry, every refusal class, receipt ordering) | 17/17 |
| `cargo test -p allternit-api --lib aci_batch` (pre-existing substrate, unchanged) | 28/28 |
| `cargo test -p allternit-api --lib aci_batch_adversarial -- --nocapture` | 9/9 (35 attack cases) |
| `aci_approvals` / `aci_safety` / `aci_credentials` | 7/7, 11/11, 11/11 |
| `pytest tests/test_code_execution.py` (egress refusal, fs escape refusal, credential canary, timeout kill, envelope containment, harness second line) | 17/17 |
| `pytest tests/test_code_mode.py` (strictly opt-in, one grant-bound run, approval flow, refusal-as-observation + re-plan, fallback, §8 records) | 10/10 |
| Batch suites (`test_batch_dispatch/context/adversarial`) — no batch semantics changed | all green, unchanged |
| `node scripts/release-preflight.mjs` | 35/0 OK |
| **Live smoke** (`scripts/code_mode_smoke.sh`, real server, enforce mode, dev port 18113) | **12/12 PASS** |

Live smoke, step by step: benign payload → `403 confirmation_required`
(descriptor hash `aa2cd820…` exposed, grant pending) → unapproved replay
blocked → `POST /aci/handoff/:id/approve` (scripted human gate) → approved
payload → 200 with **executed descriptor hash identical to the granted hash**
→ real sandboxed `node:vm` run → envelope `exit_status 0`, stdout
`smoke: ***\ndone` — **the credential canary fired**: the payload echoed its
`sandbox_env` value and the scrubber removed it before the envelope crossed
back → receipt `completed`, metadata-only (byte count, no stdout content) →
grant replay `403` (single-use) → one-token-different payload with the same
grant `403` (hash mismatch) → credential-literal payload `400
code_refused/credential_pattern` → undeclared-host payload `400
code_refused/undeclared_network_target` → declared-host page op with no
browser bridge refused honestly at runtime (`exit_status 13`).

GitHub Actions on PR #474: all pass (gitleaks, validate-typography,
check-sw-cache-bump, Cloudflare Pages, Desktop vitest). The three Vercel
checks failed on account-level `Deployment rate limited — retry in 24 hours`
— Vercel build-quota exhaustion, unrelated to the diff (no frontend files
touched); noted on the PR.

## Incidents and honest deferrals

- **Placement caveat (documented in the safety card):** the measured executor
  placement is the sandboxed runner as a local child process, enabled by an
  explicit operator env gate (`ALLTERNIT_CODE_EXECUTOR=node-sandbox`; default
  = 502, never a host fallback). The production target is the same runner
  microVM-side with the payload crossing the sidecar/VM channel — that
  channel is NOT wired end-to-end yet, so kernel-level VM isolation is
  asserted by design, not measured. The containment layers that ARE measured:
  no host `require`/`process` in the vm context, scoped fs, fail-closed
  egress checks, env allowlist, wall-clock kill.
- **Descriptor egress checks are literal-based**; dynamically constructed
  URLs are caught at runtime by the runner (measured), not at the gate.
- **No adaptive adversary**: the refuse-list is hand-enumerated; a trained
  attacking model has not been run against the gate (same caveat class as the
  batch section).
- **`pyautogui-python`** is in the language allowlist per spec but its
  executor is not wired in this build — presenting one is refused honestly,
  never executed best-effort.
- **Screenshot envelope fields are null in this placement** (no browser
  bridge in the dev harness); the loop's normal post-step observation
  supplies screen evidence.
- **Full `cargo test --lib aci` filter not run to completion**: it exceeds 40
  min wall clock (pre-existing slow `aci_routes` policy-seat tests, the
  documented one-shot flake area). Every aci suite the diff can affect was
  run explicitly and is green (counts above). Pre-existing breakage NOT
  introduced here, confirmed identical on pristine `origin/main`:
  `tests/test_e2e.py` / `tests/test_real_adapters.py` fail collection (missing
  `sessions` module); 15 failures + 5 errors in `test_replay.py` /
  `test_gateway_execute_direct.py`.
- **Desktop rebuild not run** (AGENTS.md step 8): this session's landing
  contract (D4 brief) ends at merge + attestation + cleanup. The change does
  touch `cmd/allternit-api`, which the desktop bundles — the standard
  post-merge desktop rebuild from merged main remains as the usual follow-up.
- **Port note:** the smoke server ran on 18113 because another session's
  dev server holds 18013; 8013 was never touched.
- **History note:** the session's commits were squashed to a single commit
  before merge because an intermediate commit carried a gitleaks-rule-shaped
  fake canary value (`sk-live-…`) that would have landed in main history
  permanently; the squashed branch scans clean (`gitleaks git origin/main..HEAD`
  → no leaks).
- **cu22-named follow-ups NOT touched** (observation disconnect, per-step
  vocabulary, brain timeout), per the D4 scope boundary.
