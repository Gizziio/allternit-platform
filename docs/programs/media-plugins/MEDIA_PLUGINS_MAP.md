# MEDIA_PLUGINS_MAP — rq-20260913-007 / media-plugins-v1 (Phase 1)

Spec: Allternit Brain `Research/specs/media-plugins-v1.md` (read the goal/gates there if reachable; everything needed is inlined below). Executor: kimi. Owner approval: Eoj, 2026-09-13.

## What exists today (verified paths)

- Plugin system: `surfaces/ai.allternit.com/src/plugins/` — `capability.types.ts` (`CapabilityType = skill|command|connector|mcp|plugin|cli-tool|webhook`), `useCapabilities`, `capabilityEnabled.store.ts`, `capabilityWriter.ts`, `marketplaceApi.ts`, `localPluginLoader.ts`. Built-in mode plugins declare `PluginCapability[]`.
- `surfaces/ai.allternit.com/src/plugins/built-in/video/plugin.ts` — t2v/i2v/editing/extend; backed by `src/lib/agents/modes/video-generation.ts`; existing BYOK providers MiniMax/Kling.
- `surfaces/ai.allternit.com/src/plugins/built-in/image/plugin.ts` — t2i/variations/style-transfer/upscale/inpaint; backed by Bonsai local/WebGPU (`src/lib/local-models/bonsai-runtime.ts`, `catalog.ts`).
- Image gap: `packages/@allternit/office-slides-app/.../AiPanel.tsx` fails when no provider returns an image; `PLATFORM_RECOVERY_TODO.md:237`.
- Provider/BYO-keys machinery (use THIS, no parallel registry): `cmd/allternit-api/migrations/V134__user_route_credentials.sql`, `cmd/allternit-api/src/llm_gateway/route_credentials.rs`, provider catalog `cmd/allternit-api/src/provider_routes.rs`, admin routes `cmd/allternit-api/src/llm_gateway/admin_routes.rs:1184-1271`. UI pattern: `surfaces/ai.allternit.com/src/lib/agents/provider-routing.ts`, `views/bots/ProviderRoutingCard.tsx`.
- Gateway image placeholders: `cmd/allternit-api/src/llm_gateway/images.rs` (returns 1×1 SVG; comment ~line 227 says "in production, this would proxy to a configured image provider"). DECISION to record in PR: replace placeholders now, or defer (plugins own generation client-side; gateway stays text-only) — pick one, justify, don't silently skip.
- Media plane reference (do not import blindly): `vendor/harnessrouter-ce/gateway/media_plane.py` + `media_catalog.json` — measured catalog of Seedance/MiniMax/Kling/gpt-image/ElevenLabs; UHP-path only.
- Design tokens/copy: voice Register 1 (Allternit Brain `company/voice.md`): plain, direct, no hype, no quality/ranking guarantees.

## Target providers (unit costs for cost preview)

- Video primary: MiniMax H3 — $0.08/s @768p (docs: platform.minimax.io). Fallback: fal Seedance 2.0 — $0.2419/s Fast, $0.3034/s standard @720p (submit `https://queue.fal.run/...`, poll status, download MP4).
- Image: gpt-image via OpenAI-compatible images API — $0.006/$0.053/$0.211 per 1024² low/med/high; Batch API 50% off (note only, Phase 1 UI generates interactively). Burst/draft: FLUX via fal. Keep Bonsai local as zero-cost default.

## Hard gates (from spec)

- Cost preview (unit price × requested units) BEFORE any metered generate; platform-funded metered lanes ship DISABLED until owner attaches accounts.
- BYOK: customers attach their own keys via the existing V134 machinery; zero-cost metering path.
- No parallel provider registry. No keys in code. No Sora (API shuts 2026-09-24). No face-swap. No consumer-account browser automation inside the product.
- Release lock: if desktop-bundled paths touched, `node scripts/release-preflight.mjs` must be 26/0 before merge; desktop tag rules apply.

## Repo ritual (AGENTS.md is authoritative — follow it fully)

Worktree `allternit-session-mediaplug1` (branch `session/media-plugins-v1`) already exists — work ONLY there. Steering checkpoint `.steering/checkpoint.md` at milestones. Commit gate runs through the steering agent. PR → merge --merge → attestation `agent-ledger/summaries/YYYY-MM-DD-HHMM-<id>-kimi-media-plugins-v1.md` + LEDGER.md line → cleanup worktree/branch. DAG: dag_309296 / wih_3745 — reference in checkpoint/handoffs; close wih at end.
