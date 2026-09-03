# Steering checkpoint — platform follow-up pass

## Goal
Add Groq to the live Allternit Cloud model catalog, prove `/v1/chat/completions` works across all listed providers, and verify the deployed `platform.allternit.com` pages render correctly in a browser.

## Just did
- Created session worktree `allternit-session-platform-followup-20260903` on branch `session/platform-followup-20260903`.
- Queried Groq `/v1/models`; confirmed Groq returns pricing as numeric strings.
- Fixed `generic_openai.rs` `OpenAiPricing` to deserialize prices from either JSON numbers or numeric strings.
- Added 4 curated Groq aliases to `catalog.rs`: `qwen3.6-27b-groq`, `qwen3.8-27b-groq`, `gpt-oss-20b-groq`, `gpt-oss-120b-groq`.
- Updated router unit tests for the expanded 24-entry catalog; all 12 model_router tests pass.
- Built and deployed the API binary to the VPS; verified `/v1/models` returns 24 models including the 4 Groq aliases.
- Smoke-tested `/v1/chat/completions`: Together (works), Groq (works + streaming works), Fireworks (routes, model returns empty content), DeepInfra/OpenRouter blocked by upstream account balance.
- Verified `platform.allternit.com` pages in headless browser; found and fixed:
  - `model-catalog.ts` was reading prices/name/context only from `extra`, but the API flattens them to top-level fields.
  - Updated `ModelsPage.tsx` and `PlansPage.tsx` provider copy to list Groq as live.
- Ran `bun run typecheck` and `bun run build` for the platform surface; both pass.

## Next
- Commit API and front-end changes, push `session/platform-followup-20260903`, merge into `main`, and deploy `platform.allternit.com`.
- Re-verify production `/models` shows prices and Groq copy after deploy.
- Clean up worktree/branch and update ledger.

## Open questions
- Fireworks aliases route successfully but the chosen reasoning models (DeepSeek V4 Pro, Qwen 3.8 Max) return empty `content`. Is this acceptable for now, or should we swap to non-reasoning Fireworks aliases?
- DeepInfra and OpenRouter keys have no upstream balance; should we add credits or remove them from marketing until funded?
