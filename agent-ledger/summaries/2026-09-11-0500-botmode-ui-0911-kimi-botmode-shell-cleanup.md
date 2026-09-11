# Bot-mode shell cleanup — session/botmode-ui-0911

- **Date:** 2026-09-11 (late CDT)
- **Agent:** kimi (Kimi Code session `11d747a7`, resumed coder subagent for implementation + smoke)
- **PR:** https://github.com/Gizziio/allternit-platform/pull/307
- **Merge commit:** `4502326be6f774d9d057e7efde5c067eee122fc2`
- **Branch:** `session/botmode-ui-0911` (4 commits from `81398dfd8`)

## What landed

Owner-reported bot-mode UI fixes in `surfaces/ai.allternit.com`:

1. **Neutral bot-mode accent, light mode only** — light `--accent-bot` `#2E9E97` (read as blue) → `#B08D6E` (sand-500). Dark theme keeps teal. `agentModeSurfaceTheme` gained `useAgentModeSurfaceTheme` (theme-store reactive); BotLaunchpadView backdrop is neutral in light, teal in dark. Derived `--shell-mode-bot-*` / `--view-bot-bg` recompute via color-mix.
2. **Bot Hub is a bot-mode rail feature** — removed from home rail + code rail (items, code-rail More dropdown entry + default-on flag, HOME/CODE sticky-tab sets). `agent-hub` added to `BOT_MODE_VIEW_TYPES` (ShellApp), so opening it anywhere lands in bot mode instead of flipping to chat rail.
3. **Bot rail order: Pinned Bots → Group Chats → Bots** (pinned capability unchanged; empty states moved with sections).
4. **"+" (New) in bot mode opens the bot picker sheet** (`allternit:open-bot-picker`, globally hosted BotPickerSheet) — never navigates. Home mode tab clears a store-active bot chat session before landing so home can't bounce back into the bot view.
5. **Legacy in-chat "Gizzi chat screen" removed** — the floating "Hey, I'm Gizzi" bot window (bot session rendered inline in ChatView) is gone; bot sessions have one surface: `BotChatSessionView` (`bot-chat-session`). ChatView stripped of all `isBotSession` chrome + redirect guard; home composer lost the bot pill / "No bots are available yet" trap (`requiresAgentSelection` now excludes the `chat` surface). Reverses the direction of `ccdfa4d6b` per owner decision (dedicated view is canonical).
6. **`showOlder` TDZ crash in `BotChatSessionView` fixed** (pre-existing at base) — a `useEffect` read `showOlder` before its `useState`; the dedicated view crashed into its ErrorBoundary at runtime. Pure declaration reorder; clears 2 pre-existing typecheck errors.

## How it works (key mechanics)

- Bot session landing: all entry points (rail rows, Teammates rows, picker sheet, launchpad, top deck, BotHomeView, AgentHub tabs, inbox, toasts, HUD handoff, ShellApp starters) call `openBotChatView` → dispatches `allternit:open-view` `bot-chat-session`. `bot-chat-session` ∈ `BOT_MODE_VIEW_TYPES`, so mode stays bot.
- Residual-path safety: ChatView effect — if a bot session is ever store-active in the home chat surface, it hands off to `bot-chat-session` and renders `null` (deps only on the active session; cannot loop). ViewRegistry `onBack` clears the store-active chat session when origin is `chat` so Back can't loop either.
- "+" in bot rail: dispatches the same event BotLaunchpadView uses; BotPickerHost (ShellApp-level) owns the sheet.

## Verification

| Check | Result | Evidence |
|---|---|---|
| `pnpm typecheck` | ✅ 0 errors | clears 2 pre-existing BotChatSessionView errors |
| vitest (shell, bots, chat, bot-chat, lib/bots) | ✅ 605 pass / 0 fail | 68 files |
| Live smoke (vite :3013 + Playwright, no API backend) | ✅ 5/5 owner checks | `/tmp/smoke-*.png`: neutral light accent (dark teal kept), rail order, Bot Hub bot-rail-only + mode kept, "+" opens picker in-mode, session lands dedicated view |
| Message streaming | ⏱ not tested | no API backend in smoke env; landing/rendering only |

CI: GitHub checks green at merge; Vercel jobs fail on account build-rate-limit (pre-existing, unrelated — same as PR #288).

## Incidents / honest deferrals

- The previous desktop symptom "work didn't land" was partly a stale binary; this session's changes ship via the step-8 desktop rebuild below.
- Shell still boots into chat mode even with persisted mode `bot` (pre-existing boot sync; noted, not changed).
- `useAgentBootstrap` still creates a default "Gizzi" bot on boot (expected; the removed thing was the in-chat *surface*, not the bot).
- Desktop-UI e2e with a live backend (bot-e2e-desktop.cjs) not re-run here — the running desktop app rebuild is the next verification surface for the owner.
