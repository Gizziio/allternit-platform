# Attestation — session/gizzi-tui-parity (P3): organized /model picker

**Date:** 2026-09-26 05:18 · **Agent:** kimi-code (coder subagent implemented; parent reviewed + landed) · **Session branch:** `session/gizzi-tui-parity` · **DAG:** dag_625298 / wih_8397

## What was done

P3 of the gizzi-code TUI parity program — ported the desktop/web model selector organizer (`ModelPickerPopover` in allternit-ai, branch `session/composer-parity`) to the Ink TUI:

- New pure-logic module `cmd/gizzi-code/src/cli/ui/ink-app/utils/model/modelPickerModel.ts`: `inferVendor()` (verbatim desktop port), `formatContext()` (200K/1.0M), `buildPickerRows()` (grouped sections: Allternit Cloud split by vendor → per-CLI provider → Local → Other; headers non-selectable; favorites top their section), `capabilityBadges()`, `quotaSummary()` (tightest ProviderQuotas window, hidden when unreported), scroll windowing.
- `components/ModelPicker.tsx` rewritten: owns list rendering/navigation via `useInput` + `useRegisterOverlay` (CustomSelect can't do non-focusable headers); type-to-filter (Esc clears filter before cancelling); Tab = ★ favorite persisted via new `modelFavorites` user setting (both settings schemas updated in sync); per-row context window + badges; lazy non-blocking quota fetch; effort row / fast-mode notices / `/model <name>` / MLX switch / `skipSettingsWrite` / NO_PREFERENCE / analytics all preserved.
- 17 unit tests in `test/components/ModelPicker.test.ts`.

**PR:** #746, merge commit `9502d8d41c9536ca059f88efc90bdfe76c4dca36`.

## Verification evidence

- 17/17 picker tests; `test/components/` 25/25; settings-schema consumers green (re-run by parent after subagent handoff).
- `bun run typecheck`: clean. `release-preflight.mjs`: 52/0.
- Live pty smoke by the implementer: `/model` opens the grouped picker; `f` → `Filter: f (1 of 1)`; Tab → `★` written to settings.json `modelFavorites`; Enter → model set. Scratch dirs cleaned, no stray processes.

## Honest deferrals

- Live quota rendering and Cloud vendor-split sections not exercised (sandbox has no Kimi/Allternit Cloud credentials) — hide-when-unreported and grouping covered by unit tests only.
- No `tools` capability badge: discovery carries no capability data; badges are positive-signal heuristics only, nothing fabricated.
- ProviderQuotas currently has only the kimi-cli fetcher; extending FETCHERS (claude-cli, codex) is shared follow-up benefiting desktop too.
- Desktop binary rebuild still deferred to program end.
