# Session Attestation — session/bots-p05 (kimi) — Bot Teammates Phase 5

- **Date:** 2026-09-07
- **Branch:** `session/bots-p05` @ ecb197821 (fast-forwarded to `main`).
- **Spec:** `docs/BOT_TEAMMATES_SPEC.md` — Phase 5 (Polish).

## What was done

- **Bot Hub roster sections** (`lib/bots/bot-hub-sections.ts` + `BotHubHomeTab.tsx`): user-ordered collapsible sections; `botProfile.sectionId` (additive, zod schemas updated both places, category-seeded defaults); HTML5 drag-a-card-onto-heading (Esc cancels, membership persisted on the bot via updateAgent); custom sections create/delete (never deletes bots — falls to "All bots"); search/category filter → previous flat grid.
- **Group session naming**: sessions now named exactly `Group: <groupId>` (human name stays on the group record) — same-name room recreates can't resume stale sessions.
- **Test density** (+61 tests, no behavior changes beyond naming): mention-handoff attribution (14), capability-epoch drift gate `hasEpochDrifted` + exactly-one-rebuild, failure-classifier auth-precedence on realistic 401 body, routine canonical-chat delivery suite (11), pure teammates selection rule `bot-teammates-selection.ts` (10, mirror of ShellRail's inline logic — ShellRail untouched per ownership; drop-in delegation left as follow-up).

## Verification

- tsc clean on touched files (only known environmental univerjs/xterm errors remain); vitest 1379 passed; sole failure `fabric-session-kind.test.ts` = known pre-existing.

## Notes

- `PluginManager.flows.test.tsx` flaked once under full-suite load, passed in isolation (pre-existing timing sensitivity).
- If group rooms later get a server-side creation path, reuse the `Group: <roomId>` convention (now tested).
