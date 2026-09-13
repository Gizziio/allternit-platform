# session/cu20-teachbatch — record→teach→batch + auto page binding + aci audit flake fix

- **Date:** 2026-09-12 (landed late evening; PR raised 2026-09-13 ~03:40Z)
- **Agent family:** kimi-code (worker hit quota pre-landing; parent session landed the PR inline)
- **Spec:** `stagehand-batch-fork` deferrals D1 (Brain)
- **PR #447**, merge `4335435d2`; branch `session/cu20-teachbatch`

## What was done
- **A — record→teach→batch:** fully batch-mappable taught workflows compile to ONE grant-bound batch at run start (origin `aci.workflow`); declined/failed grant → per-step fallback via existing approval callback (`workflow.batch_grant` pause); halted batch resumes at the failed step only; `ALLTERNIT_WORKFLOW_BATCH=0`/`batch_enabled=False` opt-out keeps per-step path byte-for-byte; `model_turns_saved` on `batch.context.*` ledger events. Unbatchable steps (navigate/wait/extract/screenshot/download, unresolved `{{params}}`, `safety.requiresApprovalFor`) skip compilation — per-step input-pause contract preserved.
- **B — automatic page binding:** planning loop observes adapter URL post-step/post-batch (`get_url()` + adapter-result fallback) and pins the NEXT batch descriptor binding; operator pin wins; non-browser surfaces keep origin+session binding; `page.observed` SSE event; session-preservation contract §7, v1.1.
- **C — P1-era flake named + fixed:** `aci_routes::policy_seat_tests::audit_api_returns_rows_with_bot_filter`. Root cause: unguarded process-wide `ALLTERNIT_COMPUTER_USE_DIR` env mutation in ~6 test sites racing `POLICY_TEST_LOCK`-holding policy-audit tests (concurrent `set_var` redirects rows between temp dirs). Reproduced 2-of-3 full-suite runs before fix; fix serializes env mutations.

## Verification
- Python touched suites: 47 (main baseline) → 66 passed, 0 failed; test_workflow_batch.py 19/19; test_batch_dispatch.py 20/20
- Live smoke, real stack, both legs green: compiled-batch (one grant → approve → receipt 3/3) and same workflow forced per-step (`ALLTERNIT_WORKFLOW_BATCH=0`)
- `cargo test -p allternit-api --lib aci_` clean post-fix; release-preflight 35/0
- CI: Desktop CI (vitest + typecheck/build) green; gitleaks/typography/cache-guard green; Vercel red on account-wide rate limit only (pre-existing)

## Incidents
- macOS TCC revoked Desktop access mid-session (~20:05 local) — blocked worker + parent for ~1h; user re-granted; resumed cleanly, nothing lost.
- Worker hit 5h model quota at the landing step; parent landed the PR inline (push → conflict with newer main, only .steering/checkpoint.md conflicted, resolved).

## Deferrals (unchanged)
D2 adversarial batch-grant recall; D3 real-model validation campaign; D4 code mode (`code-mode-execution.md` spec).
