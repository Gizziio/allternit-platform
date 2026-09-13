# Agent Work Attestation — media-plugins-v1 Phase 1

**Date:** 2026-09-13 17:45
**Session ID:** mediaplug1
**Branch:** session/media-plugins-v1
**Agent:** kimi (orchestrated via agent-orchestrator tmux `ao-mediaplug1`; orchestrator review + land by kimi-code)
**Commit:** PR #487, merge `6c193e422`
**DAG:** `dag_309296` / `wih_3745` (CommRails)
**Ledger entry:** [../LEDGER.md](../LEDGER.md)

## What was done

Phase 1 of the media plugins plan (`docs/MEDIA_PLUGINS_MAP.md`, research queue `rq-20260913-007`): first-party video + image generation in the platform plugin system, server-side media plane, BYOK via the existing V134 credential machinery, cost preview before every metered generate.

- **API (`cmd/allternit-api`)** — new `src/media/` module (`clients.rs`, `catalog.rs`, `handlers.rs`, `tests.rs`) + migration `V171__media_jobs.sql` (`media_jobs`, `media_artifacts`). Routes: `GET /api/v1/media/catalog`, `POST /api/v1/media/video/jobs`, `GET /api/v1/media/video/jobs/:id`, `GET …/download`, `POST /api/v1/media/image/generate`, `GET /api/v1/media/artifacts/:id`. Providers: MiniMax H3 (V2 API, primary video), fal Seedance 2.0 fast/standard + i2v (fallback video) + FLUX schnell (image), gpt-image (OpenAI-compatible). All behind a mockable `MediaTransport` trait.
- **Platform (`surfaces/ai.allternit.com`)** — `modes/media-cost.ts` (unit-price catalog mirror + cost preview), `video-generation.ts` providers `minimax-h3` + `fal-seedance`, `image-generation.ts` providers `gpt-image` + `flux-fal` (Bonsai local stays the zero-cost default), `plugins/built-in/{video,image}/plugin.ts` config surface + `cost-preview` progress event, `views/settings/MediaProvidersCard.tsx` (BYOK attach/remove through existing `/api/v1/gateway/route-credentials`), contract test `modes/media-plane.test.ts`.
- **office-slides-app** — `ai-ipc.ts` `generate_image` was permanently failing on the stubbed Genspark path; it now tries the Allternit media plane first and still fails closed.

## How it works

The load-bearing decision: **all provider protocols run server-side** in `allternit-api`. V134 route-credentials never return decrypted keys to the browser, so the plugins cannot call fal/MiniMax/OpenAI directly client-side without breaking that property or creating a forbidden parallel key registry. The browser drives submit → poll → download against `/api/v1/media/*`; artifacts are downloaded server-side into `media_artifacts` and served through the API (owner-scoped, 404 for other users) so expiring provider URLs never reach the client.

Key resolution per request: caller's V134 credential (`minimax` / `fal` / `openai`) first; else platform env keys (`MINIMAX_API_KEY` / `FAL_KEY` / `OPENAI_API_KEY`) **only** when `ALLTERNIT_MEDIA_PLATFORM_FUNDED=1` — the platform-funded metered lane ships **disabled**. No key → `400 no_provider_key` with an actionable message.

Gateway decision (deliverable 5): **deferred, explicit** — `/v1/images/*` gateway placeholders are not replaced in this phase; that surface serves external virtual-key API consumers (different trust/metering model) and gets its own design pass in Phase 2. Recorded in the PR body and `docs/MEDIAPLUG1_NOTES.md`.

Incidents: the executor's tmux session was killed by the orchestrator mid-PR-composition (errant `pkill` on the pane's process group). No work was lost — everything was already committed; push/PR/merge were completed by the orchestrator per the land ritual.

## Verification

Re-run first-hand by orchestrator review (not just executor-claimed):

- `cargo test -p allternit-api --lib media` — 22/22 media tests pass (24 incl. name-filter bleedover, 0 failed).
- `vitest run media-plane.test.ts` — 10/10; `pluginStandards.test.ts` — 3/3.
- `tsc --noEmit` (ai.allternit.com) — clean (0 errors).
- Migration tail V167–V171, single V171, no version collision.
- Hard gates confirmed in diff: cost-preview before metered calls; platform env lane flag-gated and default-off; no hardcoded keys; no decrypt endpoint / parallel client-side registry; fails closed (502s, no fabricated media); no Sora / face-swap.
- CI on PR #487: desktop vitest, typecheck+build, gitleaks, SW-cache, typography all pass. Vercel checks fail on an account-level deployment rate limit (pre-existing, unrelated to this diff).
- Rebased onto origin/main (incl. PR #484 migration renumber) before push — clean.

## Known gaps / remaining work

- **Live provider smoke test not done** — no real BYOK keys in the environment; all provider wiring covered by mock-transport contract tests. First real generation with an attached key is the smoke test. Needs from Eoj: MiniMax / fal / OpenAI keys attached in Settings when metered lanes should go live.
- **Phase 2 (not this PR)**: audio capability per `docs/specs/tts-product.md`; design-pool retrieve-before-generate in `views/design/`; gateway media endpoints (decision above); legacy provider pickers in VideoModeView / SwarmSetup.
- MiniMax 2K unit price flagged as estimate in the catalog (official 768P price verified, 2K corroborated).

## Files changed

- `cmd/allternit-api/migrations/V171__media_jobs.sql` — media_jobs + media_artifacts tables
- `cmd/allternit-api/src/media/{mod,clients,catalog,handlers,tests}.rs` — media plane module (~2.4k lines incl. tests)
- `surfaces/ai.allternit.com/src/lib/agents/modes/{media-cost.ts,video-generation.ts,image-generation.ts,media-plane.test.ts}` — providers + cost preview + contract tests
- `surfaces/ai.allternit.com/src/plugins/built-in/{video,image}/plugin.ts` — config surface + cost-preview event
- `surfaces/ai.allternit.com/src/views/settings/MediaProvidersCard.tsx` (+ SettingsView mount) — BYOK card
- `packages/@allternit/office-slides-app/src/main/ai-ipc.ts` — generate_image via media plane, fail-closed
- `docs/MEDIA_PLUGINS_MAP.md`, `docs/MEDIAPLUG1_NOTES.md` — plan + closeout notes
