# Goal

P0-E model picker (saved plan: OpenMaus chrome, Allternit catalog) — resumed 2026-09-17 by Kimi Code picking up a Codex session that was cut off before implementing. Plan of record: `~/.grok/sessions/%2FUsers%2Fjoe/01a0a605-20d7-79f2-8d5e-18548d77bca1/plan.md`. No git mutations; do not commit unless Joe asks.

# Just did

Implemented the plan's P0 in this worktree (uncommitted):
- NEW `src/lib/bots/allternit-engine-catalog.ts` (+ 17 tests) — pure adapter merging `useModelDiscovery` auth status + registry `ProviderInfo[]` + `useAvailableBrainModels` `ModelOption[]` + cli-status enrichment into `BotModeProvider[]`. Alias fold by canonical id with executable provider ids kept on model rows; status semantics mirror `model-picker.tsx getEffectiveStatus`; stale/failed discovery degrades to unknown, never "ready"; CLI-status can no longer dim a discovery-authenticated Gizzi/cloud provider.
- `bot-mode-model.ts` — `BotModeProvider` extended (`transport`, `usage`, per-model executable `providerId`); `mergeCurrentProvider` no longer fabricates `installed/available: true` for unknown saved providers (marks clearly unavailable instead).
- `BotModeModelPicker.tsx` — container now consumes the live platform catalog; Connect button on blocked rows; usage footer (omitted when `meteringAvailable === false`); runtime model applied only after a successful store write, with restore + error banner on failure; effort chips REMOVED (see Open questions).
- `BotChatSessionView.tsx` — mounts `ProviderGallery` (initialProvider from picker Connect; refetch discovery/cli-status/usage on close); `pickerRuntimeModelId` resets on session AND bot change; removed the `ModelSelectionProvider`/`selectModel` coupling (bot picks no longer rewrite the global Chat/Cowork default; removed fallback was redundant with the store's internal runtime-model fallback).

Verified: `vitest run` on the three picker files → 39/39 pass. `typecheck:fast` → no errors in touched files (42 pre-existing errors elsewhere from prior-session dirty work, untouched).

# Next

Joe to smoke-test in the app (pick a Gizzi/cloud/CLI model Chat already shows; confirm next bot send uses it; bot default persists after reload). Packaged-Desktop proof still open (needs a release build — out of bounds here). Then commit/push `session/openmaus-botmode-0915` when Joe says so.

# Open questions

1. Effort chips hidden, not gated: traced handleSend → `SendMessageOptions` (mode-session-store.ts:174, no effort field) → `native-agent-api.streamChat` (:783 body has no effort). The Rust bridge reads a top-level `effort` (v1_routes.rs:1064) but gizzi's `/session/:id/message` PromptInput (gizzi-code prompt.ts:109) strips it. So NO engine receives per-send effort on this path — showing chips would have been a fake. Effort still persists (`threadPin.effort`, `bot.brain.effort`, `config.reasoningEffort`). Follow-up if wanted: map bridge effort → gizzi PromptInput, then re-enable chips.
2. `ModelSelectionProvider` removed wholesale from BotChatSessionView instead of just the `selectModel` call — flag if the provider should be kept.
3. cli-status endpoint ships no version field, so `BotModeProvider.version` stays unpopulated (same as before).
