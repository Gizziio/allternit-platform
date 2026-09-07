# Agent Work Attestation — Groq integration + platform verification

**Date:** 2026-09-03 06:04  
**Session ID:** `session/platform-followup-20260903`  
**Branch:** `session/platform-followup-20260903`  
**Agent:** kimi  
**Commit:** `90f97cdb0` — merged into `main`  
**Ledger entry:** [../LEDGER.md](../LEDGER.md)

## What was done

- Added Groq to the Allternit Cloud model router.
- Fixed the generic OpenAI-compatible adapter so it parses pricing values that are returned as numeric strings (Groq's format).
- Added four curated Groq aliases to the static catalog.
- Updated router unit tests for the expanded 24-model catalog.
- Fixed the `platform.allternit.com` model catalog to read flattened API fields (`name`, `prompt_price`, `completion_price`, `context_length`) instead of only the nested `extra` object.
- Updated platform marketing copy on `/models` and `/plans` to list Groq as a live provider.
- Built and deployed the API binary to the VPS and the platform surface to Cloudflare Pages.

## How it works

- `cmd/allternit-cloud-api/src/model_router/generic_openai.rs` now uses `deserialize_price_string` on `prompt`, `completion`, `input`, and `output` pricing fields so both JSON numbers and numeric strings deserialize to `Option<f64>`.
- `cmd/allternit-cloud-api/src/model_router/catalog.rs` contains four new Groq entries mapped to live Groq model IDs, with per-1M-token fallback pricing derived from Groq's published per-token rates.
- `surfaces/platform.allternit.com/src/lib/model-catalog.ts` now reads `model.name`, `model.prompt_price`, `model.completion_price`, and `model.context_length` directly, falling back to `model.extra.*` for older or non-flattened responses.
- `surfaces/platform.allternit.com/src/pages/ModelsPage.tsx` and `PlansPage.tsx` now mention Groq alongside OpenRouter, Together AI, Fireworks AI, and DeepInfra.

## Verification

- `cargo check` and `cargo test model_router` passed (12/12 tests).
- Built the API binary with `cargo zigbuild --target x86_64-unknown-linux-gnu --release` and deployed to `root@100.108.37.126` via `deploy-contabo.sh`.
- Confirmed `https://api.allternit.com/v1/models` returns 24 models including the four Groq aliases.
- Smoke-tested `/v1/chat/completions` with a temporary scoped admin API token:
  - Together `llama-3.3-70b-turbo`: assistant content returned.
  - Groq `qwen3.6-27b-groq`: assistant content returned; streaming `gpt-oss-20b-groq` SSE flow works.
  - Fireworks aliases route but the selected reasoning models return empty `content`.
  - DeepInfra and OpenRouter completions are rejected by upstream due to zero account balance.
- Ran `bun run typecheck` and `bun run build` in `surfaces/platform.allternit.com`; both passed.
- Merged `session/platform-followup-20260903` into `main` at `90f97cdb0` and pushed; verified the Cloudflare Pages-deployed `/models` renders all 24 models with prices and the updated Groq copy.

## Known gaps / remaining work

- DeepInfra and OpenRouter keys need upstream balance before they can serve paid completions.
- Fireworks reasoning aliases return empty assistant content; may need chat-template investigation or swap to non-reasoning models.
- `ai.allternit.com` was not redeployed in this pass.

## Files changed

- `cmd/allternit-cloud-api/src/model_router/generic_openai.rs` — string-or-number pricing deserialization.
- `cmd/allternit-cloud-api/src/model_router/catalog.rs` — four Groq aliases.
- `cmd/allternit-cloud-api/src/model_router/tests.rs` — updated catalog-size assertions and alias checks.
- `surfaces/platform.allternit.com/src/lib/model-catalog.ts` — read flattened API fields.
- `surfaces/platform.allternit.com/src/pages/ModelsPage.tsx` — updated provider copy.
- `surfaces/platform.allternit.com/src/pages/PlansPage.tsx` — updated provider copy.
- `surfaces/platform.allternit.com/bun.lock` — new lockfile from `bun install`.
