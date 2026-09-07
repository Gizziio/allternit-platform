# Steering checkpoint

## Goal
Phase 1 — "Teammates rail + routines wired" from docs/BOT_TEAMMATES_SPEC.md, in
worktree `/Users/joe/altw/allternit-session-bots-p01` (branch session/bots-p01).
Phase 0 was completed and verified earlier in this session. Parent lands the
branch — DO NOT git commit/push.

## Phase 1 status: CODE COMPLETE, verification running
- D1 DONE: `lib/bots/bot-presence.ts` — pure `deriveBotPresence(sources, now)`
  + `useBotPresence(botId)` hook; ACTIVE_WINDOW_S=90_000; working=streaming,
  active=session/routine activity within window; attention excluded.
- D2 DONE: `src/shell/ShellRail.tsx` — `TeammatesRailSection` (membership:
  presence!=='idle' OR unread mail OR visible attention; sorted
  working>active then lastActivityAt desc; cap 6; self-prunes; "All
  teammates" → onOpen?.('agent-hub')) rendered above HOME PINNED in home mode;
  `TeammatesRailRow` (BotAvatar 24px + presence dot, status priority
  Working…>attention hint>⏰ ran routine>last message, unread pill, hover Play,
  row menu Open chat/Bot home/Start session); teammatesExpanded persisted at
  'allternit:rail:teammates-expanded'.
- D3 DONE: `lib/bots/bot-routine.service.ts` — frequencies
  startup/once/hourly/daily/weekdays/weekly/monthly/interval;
  intervalHours/scheduleText/monitor/simple/lastMonitorHash fields;
  calculateNextRun exported + tested (weekdays Fri→Mon +3d, Sat→Mon +2d —
  a Saturday +1d bug was caught by the new tests and FIXED);
  persist schemaVersion 2 (migrations 0/1 identity); recordRun opts
  {monitorHash}; executeBotRoutine continuity prepend (2KB cap) + monitor
  branch (isToolsApiEnabled guard → fail 'Monitor requires local API';
  api.executeTool('shell'); fnv1aHex hash → silent 'no change' run, else
  deliver capped 4KB); routinesInFlight Set guard;
  runDueBotRoutines({includeStartup?}) + runStartupRoutines().
  `lib/bots/routine-scratchpad.ts` (16KB value / 64KB routine caps).
  `lib/bots/use-routine-timer.ts` (60s tick + mount sweep) mounted in
  ShellApp.tsx after useStackProviders().
- D4 DONE: `src/views/bots/BotHomeView.tsx` — `SimpleRoutineComposer` above
  AutomationTasksView in AutomationTasksTab: NL textarea, optional title,
  schedule select (…/Interval N hours/Advanced→scheduleText w/ 'daily'
  fallback), monitor checkbox+command, Create → createBotRoutine(simple:true);
  lists simple routines w/ pause/resume/delete + next-run relative + last-run
  status.
- D5 DONE (comments only, no behavior change): `agentToCreateAgentInput`
  docstring now documents the Hermes rule (indirect secretRefs inherited,
  value redacted, history stripped); `AgentGalleryCard.handleDuplicate`
  comment documents identity-only inheritance.
- NOTE: team-import.ts `TeamImportRoutine.frequency` widened to
  `BotRoutineFrequency` (was the only tsc regression from the frequency
  union extension).
- Tests DONE (all passing): `lib/bots/bot-presence.test.ts` (6),
  `lib/bots/__tests__/bot-routine-delivery.test.ts` (continuity caps,
  monitor suppress/change/local-API guard/cmd failure, freq mapping,
  startup inclusion), `lib/bots/__tests__/use-routine-timer.test.tsx`
  (mount sweep, tick, unmount), `bot-profile.test.ts` appended
  share-auth/duplicate-strip describe; existing
  `bot-routine.service.test.ts` updated for the new startup-exclusion
  contract.

## Verification (final)
- `npx tsc --noEmit`: all touched files clean. One regression from this phase
  was found and FIXED: team-import.ts TeamImportRoutine.frequency widened to
  BotRoutineFrequency. Pre-existing ENVIRONMENTAL errors remain, NOT from this
  phase: (a) xterm/xterm-addon-* not installed in the shared checkout (3
  terminal files, xterm IS in package.json); (b) univerjs dual-version type
  errors in the shared checkout's packages/@allternit/office-sheets-app
  (pulled in via tsconfig path mapping). Both predate Phase 1 (files untouched
  here); the shared checkout needs a `pnpm install`.
- `bun run build`: FAILS at chunk-render on @univerjs MISSING_EXPORT — same
  environmental root cause: the shared checkout's install is stale
  (require.resolve('@univerjs/core') from office-sheets-app returns
  core@0.21.1 while its package.json demands ^0.25.1; the surface vite alias
  then pins the wrong instance). All 25,617 modules including every Phase-1
  file transformed successfully — the failure is link-time, in node_modules.
  Phase 0's green build predates whatever disturbed the shared checkout's
  install.
- `npx vitest run` full suite: 1263 passed, 0 failed, 14 skipped. The only 2
  failed SUITES are UnifiedTerminal.test.ts and CodeCanvas.test.tsx, which
  fail to LOAD (xterm not installed) — pre-existing, environmental. All 32
  tests in the 5 Phase-1 test files pass, including the 3 test-time bug
  catches: weekdays Sat→Mon math, startup-exclusion contract in the old
  routine test, and hoisting-safe api-client mock.

## Open questions / notes
- agent.store.attention is in-memory only (Phase 0 decision, flagged already).
- node_modules symlinks (3) are untracked; must not be committed.
- AgentGalleryCard.handleDuplicate passes secretRefs unredacted into the
  draft (agentToCreateAgentInput redacts them). Behavior unchanged per
  "comments only" scope; flagged as a possible follow-up hardening.
