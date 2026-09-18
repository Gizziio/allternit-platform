# MEDIAPLUG1_NOTES — MEDIA_PLUGINS Phase 1 closeout

Session: `session/media-plugins-v1` · DAG `dag_309296` / `wih_3745` · Executor: kimi · Date: 2026-09-13

## What was implemented

Phase 1 of `docs/programs/media-plugins/MEDIA_PLUGINS_MAP.md`: MiniMax H3 (primary) + fal Seedance 2.0 (fallback) video
backends, gpt-image + FLUX-via-fal image backends, wired through the existing V134 BYOK
credential machinery, with a cost preview (unit price × requested units) before every metered
generate. Audio, design-reference, and gateway media endpoints are Phase 2 (out of scope).

### Architecture decision (the load-bearing one)

**All provider protocols run server-side in `allternit-api`; the browser drives job
submit → poll → download against a new `/api/v1/media/*` surface.**

Reason: the V134 route-credential store (`cmd/allternit-api/src/llm_gateway/route_credentials.rs`)
never returns decrypted keys to the client — by design. The plugins therefore cannot call
fal/MiniMax/OpenAI directly from the browser without either a key-decrypt endpoint (which would
break the "keys never leave the server" property) or a parallel client-side key registry
(explicitly forbidden). The existing codebase already uses this server-side pattern for media:
`/api/v1/providers/video/generate` proxies to the Gizzi media providers. Phase 1 extends that
pattern with a first-party media plane instead of adding a decrypt path.

No V134 migration was needed: `validate_provider_id` already accepts the media credential ids
(`minimax`, `fal`, `openai`), and the `(user_id, provider_id)` row model carries them as-is.

### API (`cmd/allternit-api`)

- `migrations/V171__media_jobs.sql` — `media_jobs` (submit/poll state, provider task ids,
  estimated cost) and `media_artifacts` (downloaded MP4/PNG bytes served back through the API so
  expiring provider URLs are never handed to the client). (Numbered V171, not V168: this branch
  fast-forwarded to origin/main, where PR #484 had already taken V168–V170 to fix a pre-existing
  V142–V144 migration version collision that was breaking every fresh-DB test.)
- `src/media/` — new module (~2.4k lines incl. tests):
  - `clients.rs` — MiniMax H3 (V2 API), fal queue (Seedance 2.0 t2v/i2v + sync FLUX), and
    OpenAI-compatible images (gpt-image) protocol clients behind a `MediaTransport` trait
    (mockable in tests). fal i2v posts to the separate `…/image-to-video` endpoint family.
  - `catalog.rs` — static provider/unit-price catalog + per-user view (BYOK configured state,
    platform-funded lane state, `ALLTERNIT_MEDIA_PLATFORM_FUNDED` default-off).
  - `handlers.rs` — transport-injected core functions + the 6 axum handlers, all requiring
    `get_user`; artifacts are owner-scoped (404 for other users).
  - `tests.rs` — `MockTransport` scripted per `METHOD URL`; 22 tests.
- Key resolution per request: the caller's V134 credential first
  (`route_credentials::get_credential`), else platform env keys (`MINIMAX_API_KEY`, `FAL_KEY`,
  `OPENAI_API_KEY`) **only** when `ALLTERNIT_MEDIA_PLATFORM_FUNDED` is `1`/`true` — the
  platform-funded metered lane ships DISABLED. No key → `400 no_provider_key` with an actionable
  message.

### Platform (`surfaces/ai.allternit.com`)

- `src/lib/agents/modes/media-cost.ts` — unit-price catalog mirror + `previewVideoCost` /
  `previewImageCost` (unit price × units, Register-1 copy, no quality guarantees).
- `src/lib/agents/modes/video-generation.ts` — new providers `minimax-h3` and `fal-seedance`
  (submit → poll → artifact URL against `/api/v1/media/video/jobs`); i2v supported on both;
  cost preview logged before generate; provider failures surface as errors (never fabricated).
- `src/lib/agents/modes/image-generation.ts` — new providers `gpt-image` (size/quality params)
  and `flux-fal` via `POST /api/v1/media/image/generate`; Bonsai local stays the zero-cost default.
- `src/plugins/built-in/{video,image}/plugin.ts` — config surface for the new providers; a
  `cost-preview` progress event is emitted before any metered generate.
- `src/views/settings/MediaProvidersCard.tsx` (+ mounted in the API-keys settings panel) — BYOK
  key attach/remove for MiniMax / fal / OpenAI through the existing
  `/api/v1/gateway/route-credentials` endpoints (ProviderRoutingCard patterns; keys sealed,
  only masked fingerprints displayed).
- `src/lib/agents/modes/media-plane.test.ts` — 10 vitest contract tests (mocked fetch):
  submit→poll→artifact wiring for both video backends, failure surfacing, `no_provider_key`
  propagation, image-plane mapping, and cost-preview math.

### Slides AiPanel fail-closed path (`packages/@allternit/office-slides-app`)

`src/main/ai-ipc.ts` `ai:generate-image` was permanently failing because the vendored Genspark
path is stubbed (`hasGskAuth()` is always false). It now first tries the Allternit media plane
(`POST {gateway}/api/v1/media/image/generate`, gpt-image, size mapped from the requested aspect
ratio, 120 s timeout) and only falls back to the gsk error when the media plane is unreachable
or no provider is configured. Failure stays closed — no fabricated image.

## Gateway decision (deliverable 5)

**Deferred: `cmd/allternit-api/src/llm_gateway/images.rs` placeholders are NOT replaced in this
phase.** The built-in plugins own generation client-side through the new `/api/v1/media/*`
routes; the `/v1/images/*` gateway surface serves external OpenAI-compatible API consumers on
the virtual-key middleware chain and stays text-gateway scope. Replacing the placeholders would
require routing virtual-key-authenticated external calls into per-user media credentials and the
job/artifact infrastructure — a different trust and metering model that deserves its own design
pass (Phase 2). Recorded here and in the PR so it is an explicit choice, not a silent skip.

## Provider shapes (verified from docs in-session)

- **MiniMax H3 uses the V2 API** (not V1): `POST {base}/v2/video_generation` (Bearer, content[]
  multimodal, i2v first-frame uses `role: "first_frame"` + `ratio: "adaptive"`),
  poll `GET {base}/v2/query/video_generation/<task_id>`, terminal status `succeeded` returns
  `task.content.url` directly. $0.08/s @768P (official paygo page); 2K ≈ $0.13/s (corroborated,
  flagged as estimate in the catalog). Sources: platform.minimax.io video-generation guide +
  pricing-paygo page.
- **fal queue**: `POST https://queue.fal.run/<endpoint>` with `Authorization: Key`, response
  carries `status_url`/`response_url`; status `IN_QUEUE`/`IN_PROGRESS`/`COMPLETED` (failure =
  `COMPLETED` + `error`); response body has `video.url` / `images[].url`. Seedance 2.0 endpoints
  live under `bytedance/seedance-2.0/…` (fast variant included); $0.2419/s fast, $0.3034/s
  standard @720p, $0.682/s @1080p. FLUX schnell: sync `POST https://fal.run/fal-ai/flux/schnell`,
  $0.003/MP rounded up. Sources: fal.ai queue docs + model pages.
- **gpt-image**: OpenAI-compatible `POST /v1/images/generations` with `model: gpt-image-2`,
  `size`, `quality`; response entries may carry `url` or `b64_json` (both handled). $0.006 /
  $0.053 / $0.211 per 1024² low/medium/high; Batch API 50% off (noted, not used interactively).

## Verification evidence

- `cargo test -p allternit-api --lib media` — 22 media-module tests passed, 0 failed
  (cargo's summary line says "24 passed" because two unrelated tests match the
  `media` name filter: `aci_routes::…immediately…`, `llm_gateway::batches::…immediately…`).
  Coverage (mock-transport contract tests): MiniMax submit/poll/download + i2v
  `first_frame`/`adaptive` + Bearer; fal `Key` auth, fast/standard endpoints, i2v endpoint
  switch, COMPLETED-with-error → Failed; gpt-image b64+url handling with cost math; flux sync
  call; catalog/key-resolution incl. platform-lane flag default-off; full lifecycle with
  artifact persistence, terminal caching, ownership 404s; router-level 401 /
  400-no_provider_key / 200-catalog.
- `vitest run src/lib/agents/modes/media-plane.test.ts` — 10/10 passed.
- `vitest run src/plugins/pluginStandards.test.ts` — existing plugin standards still pass.
- `pnpm exec tsc --noEmit` (surfaces/ai.allternit.com) — clean except a pre-existing
  `ArtifactTemplateGallery.stories.tsx` `@storybook/test` module error caused by the partial
  node_modules in this environment (present without this change).
- office-slides-app: full `pnpm typecheck` cannot run here (its node_modules in this environment
  lacks `vite`); ran `tsc --noEmit --types react,react-dom` — `src/main/ai-ipc.ts` reports zero
  errors (remaining errors are pre-existing missing-module resolutions in untouched files).
- `node scripts/release-preflight.mjs` — **36 passed, 0 failed** (run because `cmd/allternit-api`
  is a desktop-bundled sidecar; the map's "26/0" reflects an older check count, 0 failures is the
  gate).

## Deferred / not done

- **Live provider calls**: no live keys exist in this environment; all provider wiring is
  covered by mock-transport/mock-fetch contract tests. First real generation with a BYOK key
  attached is the smoke test.
- **Gateway `/v1/images` real proxy** — decision above; Phase 2.
- **Audio, design-reference, gateway media endpoints** — Phase 2 per the map.
- **VideoModeView / SwarmSetup provider pickers** — they still expose the legacy provider set;
  the plugin config path carries the new backends. A picker pass is follow-up UX work, not a
  wiring gap.
- **MiniMax 2K price** flagged as estimate (see above).
