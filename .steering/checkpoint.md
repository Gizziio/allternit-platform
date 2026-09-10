# Steering Checkpoint — session/3a37a822-p2 (phase 3)

## Goal
Owner feedback on the shipped desktop build: PR #223's consolidation of bot
sessions onto the generic `chat` view was the WRONG surface — starting any bot
(incl. gizzi) opens the chat start screen instead of a real bot session. Owner
wants the dedicated `bot-chat-session` view (BotChatSessionView) restored —
"the other one you removed". Keep #223's real fixes (temp-session send failure,
session-start core refactor in start-bot-session.ts, ChatView Back bar as a
safety net).

## Just did
- Restored pre-#223 versions of the 14 view-routing files (nav.types,
  nav.policy, ViewRegistry, ShellApp, ShellRail, handoff, bot-canonical-chat
  service, BotInboxContent, BotHomeView, BotLaunchpadView, BotPickerSheet,
  BotTopDeck, BotHubSessionsTab, SearchView) — verified no later main commits
  touched them before checkout.
- bot-activity-toasts.ts: replaced openBotSessionInChat (dead after revert)
  with openBotCanonicalChat + openBotChatView (bot-chat-session surface);
  updated its test mock.
- useStartBotSession doc comment corrected (session renders in
  bot-chat-session, not chat).
- Kept: ChatView bot Back bar, start-bot-session.ts core, all Rust/api fixes.
- Verification: `npx tsc --noEmit` clean; vitest lib/bots + lib/agents + nav
  600/601 — the 1 failure (vm-operator snapshot test) is pre-existing on main
  (verified by running same test in the shared main checkout).

## Next
Commit + push + PR + merge; rebuild platform UI only (no Rust changes),
repack app bundle + DMG, reinstall to ~/Desktop/Allternit-Desktop-fresh.app,
dedupe the gizzi DB rows again (packaged renderer re-seeded
gizzi-packaged-assistant next to the old uuid row), verify UI via screenshot,
ledger attestation, cleanup.

## Open questions
- Why the packaged app's renderer bootstrap dedupe (#224) didn't delete the
  old gizzi row on boot — code fix stays, but DB may need one more manual pass
  after this reinstall.
- Pre-existing vm-operator.test.ts snapshot failure on main — left alone per
  ritual (note as pre-existing, don't silently fix unrelated files).
