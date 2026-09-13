# Session attestation — session/botdefault-0912 (bot default model → Kimi)

- **Date:** 2026-09-12 (late evening)
- **Agent family:** kimi-code
- **PR:** #439 → merge `b07c551ef` (tip `594a2d323`)
- **Topic:** owner follow-up to #435 — "don't have openai/gpt-5-mini as the default
  model, it won't work; use kimi."

## What was done

Bot chats defaulted to `openai/gpt-5-mini` (the agent-catalog default). Desktop
gizzi does not serve that provider, so after #435 landed the session, every send
failed server-side with `ProviderModelNotFoundError` and the chat silently
produced no reply until the user manually picked Kimi K3.

Three-part fix:
- `src/lib/config.ts` — `models.defaults.primary = "kimi/kimi-for-coding"`,
  first in `curatedDefaults` (matches `lib/ai/app-models.ts`, which already
  defaults every chat surface to Kimi for Coding).
- `src/lib/agents/agent-models.ts` — `getDefaultAgentModel()` synthesizes the
  Kimi option: `kimi/kimi-for-coding` is a virtual platform id absent from the
  generated gateway registry, so without this the lookup silently fell through
  the curated list back to `openai/gpt-5-mini`.
- `src/views/bots/BotChatSessionView.tsx` — dropped the
  `bot.provider/bot.model` composer-default fallback. With no explicit
  selection the picker falls back to the persisted choice and the send path
  resolves the local Kimi brain (`resolveAgentChatRuntimeModelId` →
  `kimi-cli/kimi-k3` = `LOCAL_DEFAULT_RUNTIME_MODEL`), the model proven to
  answer in the #435 live e2e.

## Verification

- `tsc --noEmit` clean.
- vitest `src/lib/agents`: 191 tests / 23 suites green, incl. new
  `agent-models.test.ts` (asserts the default is `kimi/kimi-for-coding`).
- Live e2e of the exact default path: previous session (botmode-0912) proved
  `kimi-cli/kimi-k3` replies render; this session removes the only route that
  still defaulted bot chats to the unprovisioned OpenAI model.

## Notes / deferrals

- Existing agent rows (incl. the seeded Gizzi) still carry
  `openai/gpt-5-mini` in the DB; the view no longer routes sends through it.
  A data migration of existing rows was judged unnecessary for this fix.
- Desktop rebuild: renderer-only change; DMG rebuilt reusing the b2370
  sidecars (no Rust changes since b2370 — verified via git log) and installed
  over `/Applications/Allternit Desktop.app`.
