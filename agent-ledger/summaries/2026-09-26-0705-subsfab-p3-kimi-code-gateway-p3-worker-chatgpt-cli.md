# Attestation — session/subsfab-p3 — Subscription Fabric P3 (worker layer + chatgpt-web adapter + CLI)

**Date:** 2026-09-26 ~07:05 CDT
**Agent:** Kimi Code (orchestrator) + kimi CLI executor (regular K3 model)
**PR:** #751 — merged as merge commit `02fd5987c` (merge, not squash)
**Branch:** `session/subsfab-p3`, cut from `origin/main` @ `51b263888`

## What was done (automated P3 slice; manual gate deferred to owner)

- **Worker layer** (all fake-adapter tested): per-(provider,account) scheduler with §A8 fairness; worker wiring SDK ExecutionContext + durable two-write markSubmitted + AdapterEvent→ledger/outbox/status bridge (quota signals, model.observed downgrade, provider_running preserved for detached); supervisor with §A2 recovery (reconcile sent_unconfirmed BEFORE queue resume), stall watchdog (90s chat / 1200s research, retryable only if not_sent); detached watch polling with backoff; content-addressed artifact store with quarantine xattr + magic-byte MIME.
- **chatgpt-web adapter**: manifest (3 capabilities, pools, pacing), v1-unverified selector pack (live validation = the manual gate), adapter.ts extending DeclarativeChatAdapter (D5 temp-chat default, chat.continue divergence check, image.generate capture, fingerprint-match reconcile, challenge → needs_user, profile lock → profile_locked), 8 fixture states, SDK conformance + negative control.
- **Adapter registry**: manifests loaded/validated at boot; `/v1/capabilities` returns the live registry view.
- **CLI** (cmd/cli): UDS client, keychain cli-token issued at boot, `subs|caps|task|artifacts` subcommands (task run --wait follows SSE with acks; artifacts open requires the quarantine acknowledgment flag).

## How it was verified (orchestrator-independent)

- Gateway build PASS, **128/128 tests** (18 files; all prior suites green); `@allternit/cli` build PASS, **44/44**; SDK **68/68** still green
- Provider-literal gates clean outside the chatgpt-web adapter scope
- No live provider contact at any point (fixtures + page.route only; playwright install never run — system-Chrome fallback reused)

## Incidents / honest deferrals

- **Manual gate NOT run** (owner-driven, per D-rules): connect → visible-window login → `task run chat.create --prompt … --wait` → kill -9 reconcile check → image artifact. Selectors are v1-unverified and WILL need repair against the real UI. Worker factory (registry→supervisor→runAttempt) and dispatcher (thread_mappings→chat.continue options) activation are Phase 3 runtime wiring deferred to the gate session; D6 media-router migration waits on gate success. Disconnect kill-switch (§A6.9 profile wipe + scoped-token revocation) not built.
- Executor needed two approval interventions (scoped cleanup commands) mid-phase; otherwise clean.
- PR body has cosmetic mangling (shell ate code spans); full detail lives in `docs/specs/subscription-fabric/p3/`.
- DAG gate skipped (owner waiver). Desktop rebuild skipped.

## Next

1. Manual gate with Eoj (commands in `adapters/chatgpt-web/README.md` + `P3_PHASE_2_NOTES.md` remaining list).
2. P4 — real router (resolve/policy/pools/explain) + observability + subs model catalog (D13).
