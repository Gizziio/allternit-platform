# Steering checkpoint — session/novnc-cpu-tame

## Goal
Stop the Allternit Desktop renderer from burning ~470% CPU on an embedded
noVNC stream, which starves the node daemon's terminal relay (Fabric
Transport terminals glitch while a bot-desktop watch or ACI computer view
is live). Production-quality lifecycle guards, not a throttle patch.

Worktree: this checkout (`allternit-icon-fix`) on `session/novnc-cpu-tame`.
Do not touch the shared checkout or the running desktop app.

## Just did
- Picked up the aborted Kimi subagent (quota 403 mid-typecheck) with
  uncommitted viewport/strip edits.
- `BotWatchStrip`: removed the 140×88 full-res RFB entirely. Thumbnail is
  screenshot-poll only, paused when offscreen or `document.hidden`.
- `BotComputerViewport`: keep `resizeSession: false`; pause RFB + screenshot
  poll when not visible (IntersectionObserver + visibilitychange); skip
  screenshot poll while RFB can connect; reconnect only when the ws URL
  actually changes (status poll no longer tears down the socket every 5s).
- Tests: `BotWatchStrip.test.tsx` (source forbids noVNC import; runtime
  asserts screenshot poll, no observe/status RFB path).

## Next
1. Typecheck + vitest the touched files.
2. Commit, rebase onto origin/main, push, open PR. Do not merge.
3. After Eoj approves: merge, then joint PWA daemon test (still pending
   from the parent Fabric Transport session).

## Open questions
- Live CPU re-profile of the packaged b2661 renderer is deferred until this
  lands in the platform UI the desktop loads from :8013. The diagnosis was
  already captured (CDP 6s profile: 26% rfb decode, 7% _allocateBuffers,
  30% GC, reconnect churn).
