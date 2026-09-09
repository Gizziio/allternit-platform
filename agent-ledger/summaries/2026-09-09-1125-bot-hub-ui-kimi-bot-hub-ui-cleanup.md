# Attestation — session/bot-hub-ui (Bot Hub UI cleanup)

- **Date:** 2026-09-09
- **Session:** `allternit-session-bot-hub-ui`, branch `session/bot-hub-ui`
- **Agent family:** kimi (Kimi Code CLI)
- **PR:** #217 (merged, merge SHA `2e94fee33`; change commit `c54dd2e42`)

## What was done

Owner-reported UI defects in the allternit desktop Bot Hub
(`surfaces/ai.allternit.com/src`, accessed via the `ui` symlink):

1. **Two "Create bot" buttons on screen simultaneously.** The `AgentHub` page
   header (next to *Continue CLI*) had one, and `BotHubHomeTab`'s toolbar had a
   duplicate; the empty-state added a third. The header button is now the single
   entry point. Removed the toolbar button and the empty-state CTA, and dropped
   the `onCreate` prop from `BotHubHomeTab` → `AgentHubContent` → `AgentHub`.
2. **"New section" add-new control.** Removed the dashed *New section* button
   and its inline naming form at the bottom of the sectioned roster, plus the
   `addingSection`/`newSectionName` state and the now-unused `Plus` /
   `createCustomSection` imports.

## How it works

- Section rendering is untouched: category buckets, collapse/hide/delete,
  drag-to-move membership all still work. `createCustomSection` and
  `deleteBotHubSection` remain exported from `bot-hub-sections.ts` so custom
  sections already persisted in a user's `allternit:bot-hub-sections`
  localStorage entry still render and resolve.
- `AgentHub.tsx` still owns `isCreateOpen` and renders `CreateBotForm`; only the
  redundant inner triggers were removed.

## Verification evidence

- `pnpm exec vitest run src/lib/bots/bot-hub-sections.test.ts` — 18/18 passed.
- `pnpm run typecheck:fast` (surface) — 15 errors, all pre-existing
  missing-module/asset errors in `office-pdf-app` / `office-sheets-app` /
  `office-slides-app` / `UnifiedTerminal.tsx`. Verified identical to HEAD by
  stash-and-diff (`diff` of sorted error sets: empty).

## Incidents / honest deferrals

- None. Scope was UI-only; no behavioral logic changed.
- Note: the running `allternit-desktop-preview` worktree is a detached-HEAD
  checkout and does not yet contain this fix until it is refreshed/rebuilt from
  main — owner asked to start here, preview refresh was not in scope.
