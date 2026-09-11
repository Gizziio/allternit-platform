# Steering checkpoint — session/botmode-ui-0911

## Goal
Bot-mode shell cleanup in surfaces/ai.allternit.com, per approved plan (all 5 tasks implemented; verification done — see "Just did"):
1. Neutral bot-mode accent for LIGHT mode only (sand-500 #B08D6E; dark keeps teal).
2. Bot Hub only in the bot-mode shell rail (remove from home + code rails; stay in bot mode when selected).
3. Remove the legacy in-chat "Gizzi chat screen" (ChatView inline bot session) so bot sessions always land the dedicated BotChatSessionView (bot-chat-session).
4. Bot rail section order: Pinned Bots → Group Chats → Bots.
5. "+" New in bot mode opens the bot picker sheet (never navigates home).

## Just did
- Task 1: theme.css light `--accent-bot` → #B08D6E (derived color-mix tokens verified, no edit); agentModeSurfaceTheme bot surface now theme-aware via new `useAgentModeSurfaceTheme` hook (warm sand in light, teal in dark, live-switch reactive); AgentModeBackdrop/Sweep/ComposerHalo use the hook.
- Task 2: ShellRail — Bot Hub removed from home rail, code rail, code-rail More dropdown + its default-on flag; 'agent-hub' out of HOME_TAB_VIEWS/CODE_TAB_VIEWS (kept in BOT_TAB_VIEWS); ShellApp BOT_MODE_VIEW_TYPES += 'agent-hub' (bot rail no longer flips to chat; home/code deep-links land in bot mode).
- Task 3: bot rail reordered Pinned Bots → Group Chats → Bots (empty states + drag-to-pin drop zone moved with their sections; tabs row untouched).
- Task 4: ShellRail handleNewSession mode==='bot' branch dispatches 'allternit:open-bot-picker' (BotPickerHost is global in ShellApp; verified).
- Task 5: ChatView isBotSession chrome removed (context-card bot props, runtime-env memos, "← Back" bar, BotRuntimeConfigModal, ArrowLeft) + redirect guard (bot session active in home chat → openBotChatView('chat') / raw open-view fallback, render null, effect can't loop). ChatComposer requiresAgentSelection now excludes the home 'chat' surface (home composer can't steer into bot-binding flow; other surfaces keep the gate). BotPickerHost + start-bot-session doc comments de-staled. ViewRegistry bot-chat-session onBack clears the store-active chat session when heading back to 'chat' (otherwise the new ChatView guard would bounce Back straight to the bot view again).
- Entry-point audit: openBotSessionInChat does NOT exist on main anymore (zero matches — plan assumed it might); all live entry points (rail rows, Teammates, picker sheet, launchpad, top deck, BotHomeView, AgentHub tabs, inbox, activity toasts, HUD handoff, ShellApp handlers, RecentsView/rail recents which filter bots out) land bot-chat-session.
- VERIFY: `pnpm typecheck` → only 2 PRE-EXISTING errors in src/views/bots/BotChatSessionView.tsx(218) (showOlder used before declaration — file untouched, identical at base 81398dfd8); zero new errors. `pnpm vitest run src/shell src/views/bots src/views/chat src/components/bot-chat src/lib/bots` → 68 files, 605 passed, 1 skipped, 0 failed.
- LIVE SMOKE (vite :3013 + headless Chrome via Playwright, no backend; bots seeded through a routed GET /api/v1/agents; bot sessions via the app's own local temp-session fallback) — ALL 5 PASS, screenshots in /tmp/smoke-*.png:
  1. light `--accent-bot=#B08D6E` (probe resolves rgb(176,141,110)); dark theme keeps `#2DD4BF` teal.
  2. Bot rail order Pinned Bots → Group Chats → Bots (with a pinned bot present).
  3. Bot Hub in bot rail only (absent from home + code rails); selecting it in bot mode keeps the bot rail (no flip to home/chat).
  4. "+" New in bot mode opens the bot picker bottom sheet, mode stays bot.
  5. Starting a session from the picker lands the dedicated BotChatSessionView (header/composer chrome renders; streaming untested — no backend).
- BUG FOUND + FIXED (pre-existing on base, NOT from my changes): BotChatSessionView.tsx TDZ crash — `showOlder` was used by a useEffect (~:218) before its useState declaration (~:233), crashing the whole dedicated view at runtime ("Cannot access 'showOlder' before initialization", caught by its ErrorBoundary). Moved the useState above the effect. After fix: typecheck is fully CLEAN (the 2 pre-existing errors are gone) and vitest stays 68 files / 605 passed.
- Smoke harness notes: shell boot always starts in chat mode (mode↔view sync effect) even with persisted mode 'bot' — entered bot mode via the composer's real "Bots" toggle. OnboardingPortal overlay requires `allternit-platform-mode` to exist. Dev server stopped; scratch scripts removed.

## Next
- Parent/orchestrator: live smoke (`pnpm dev` + bot e2e scripts), PR, attest, desktop rebuild (plan Tasks 6-live + 7).

## Open questions
- Neutral accent: warm sand #B08D6E (owner can swap to cool gray at review).
- "All teammates" overflow in home rail still deep-links Bot Hub (now lands in bot mode) — per plan, left alone.
- Known consequence of the approved ChatView guard: while a bot session is the store-active chat session, clicking the Home mode tab bounces to the dedicated bot view (bot sessions are only viewable there; use the view's Back button to leave). Flagging for the live smoke.
- AGENT_IN_CHAT_ROADMAP.md left as-is (it documents regular agents-in-chat, which still exist via the context strip, not bot sessions).
