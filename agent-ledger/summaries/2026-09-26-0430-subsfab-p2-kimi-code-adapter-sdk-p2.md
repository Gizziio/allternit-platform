# Attestation — session/subsfab-p2 — Subscription Fabric P2 adapter SDK

**Date:** 2026-09-26 ~04:30 CDT
**Agent:** Kimi Code (orchestrator) + kimi CLI executor (regular K3 model)
**PR:** #742 — merged as merge commit `e43e34808` (merge, not squash)
**Branch:** `session/subsfab-p2`, cut from `origin/main` @ `88726957e`

## What was done

P2 of the Subscription Capability Fabric (IMPLEMENTATION_PLAN §2): `platform/packages/subscription-adapter-sdk/` (`@allternit/subscription-adapter-sdk`) complete:

- **Phase 1 (executor):** selector registry (YAML named locators, ordered fallback, drift telemetry), multi-signal `awaitCompletion` + stall watchdog input, D11 progress extractors (step lists, counter badges, streaming growth, partial artifacts) + 15 s heartbeat, composer (insertText for long prompts), DOM→markdown extractor, banner→QuotaSignal classifier, auth detection, worker-enforced pacer (injectable clock). 9 hand-written `fixture-web` HTML states + selector pack.
- **Phase 2 (executor):** `runtime.ts` (ExecutionContext with markSubmitted two-write ordering + awaited durable write, PageLease use-after-release guard, RedactingLogger), `download.ts` (captureDownload/captureImages → ArtifactSink, magic-byte MIME, origin allowlist), `fixtures.ts` (sanitized recorder/loader), `probe.ts` (non-spending), `declarative.ts` (**DeclarativeChatAdapter** — config-only chat providers), `conformance.ts` (shared suite runner).
- **Orchestrator contracts amendment:** `AdapterEvent` gained the D11 `progress.heartbeat` variant (12-variant union) — P0 transcribed §A1's 11 faithfully, D11 (HARDENING) adds the heartbeat; SDK was casting around the hole. Contracts schema-guard/roundtrip/exhaustiveness tests updated; SDK casts + local duplicate type removed.

## How it was verified (P2 gate, orchestrator-independent)

- SDK build PASS, **68/68 tests** (14 files) — including the two gate items: conformance runner fails loudly on a deliberately-broken selector (names the key), and static fixture trips `stalled` while a heartbeating one does not
- Contracts **41/41** with the new variant; gateway **77/77** still green against amended contracts
- Provider-literal gate grep over SDK + contracts src/test: zero matches
- Phase 1 run had one transient batch of browser-launch hook timeouts under load from sibling sessions; clean rerun passed in ~12 s (noted, not a code issue)

## Incidents / honest deferrals

- **Playwright chromium CDN stalls on this network** (direct AND npmmirror; a 16-min 428K stall killed). Orchestrator patched `test/helpers.ts` with `launchBrowser()` (bundled first, system Chrome `channel:'chrome'` fallback) and converted all 7 DOM test files; executor instructed to preserve it. Bundled chromium remains uninstalled — re-run `playwright install chromium` on a healthier network. Test-infra only; §A5 real-Chrome rules govern provider sessions.
- Executor delegated to its own coder subagent and stalled ~50 min on the download before the orchestrator fix; after steering, closed out cleanly.
- Deferred by design: live `captureDownload` test (needs a download-triggering fixture/server), gateway worker wiring of SDK runtime (P3), real router (P4).
- DAG gate skipped (owner waiver). Desktop rebuild skipped (packages not bundled).

## Next

P3 — chatgpt-web adapter (chat.create/chat.continue/image.generate) + worker/queue/reconcile wiring in the gateway — **first live slice with the manual human gate** (visible login window, `task run --wait` SSE streaming, kill -9 reconcile check). Also replaces the `chatgpt-image` lane (D6) once stable.
