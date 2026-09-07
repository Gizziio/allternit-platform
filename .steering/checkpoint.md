# Steering checkpoint

## Goal
Phase 5 — "Polish" from docs/BOT_TEAMMATES_SPEC.md, in worktree
`/Users/joe/altw/allternit-session-bots-p05` (branch session/bots-p05, main
@ 4e39ecd4a which includes Phases 0–2). NO git commit/push (parent lands the
branch). Phase 3 (remote peers, src/lib/peers/) and Phase 4 (group rooms,
group-rooms-*.ts, ShellRail Inbox escalation) are being built by OTHER
agents in other worktrees — AVOID src/shell/ShellRail.tsx, src/lib/peers/,
cmd/ entirely. My surface: Bot Hub + group/session hygiene + colocated tests.

## Plan
- D1: Bot Hub roster sections — `botProfile.sectionId` (additive in
  agent.types.ts BotProfile + both botProfile zod schemas), pure section
  model in new `lib/bots/bot-hub-sections.ts` (seed from BOT_CATEGORIES,
  localStorage `allternit:bot-hub-sections`, in-memory fallback like p02),
  UI in `views/agent-hub/main/BotHubHomeTab.tsx`: collapsible headings,
  HTML5 drag-a-card-onto-heading to move (persist via updateAgent botProfile),
  per-section hide/show (search still finds hidden), delete section → bots
  fall to always-present "All bots" bucket. Search + category chips intact.
- D2: `startBotGroupChat.ts` — session NAME must be exactly `Group: <roomId>`
  (Hermes stale-resume rule). Currently the session name is the display
  name → FIX: group keeps display name, session name = `Group: <groupId>`.
  Colocated test with mocked stores.
- D3: Test-density pass (no behavior changes):
  - mention-handoff.service.test.ts — attribution string
    `Message from 🤖 Name (@handle):`, parse/resolve, handoff note.
  - bot-capability-epoch — extract pure `hasEpochDrifted` compare helper
    (used by useStartBotSession) + test exactly-one-rebuild gating.
  - failure-reasons.test.ts — add realistic 401-body classifier precedence
    (auth beats quota on fund-mentioning 401).
  - bot-routine.service.test.ts — routine delivery lands in canonical chat
    (prompt format, continuity cap, monitor no-change silent run).
  - bot-teammates-selection.ts (NEW pure module mirroring ShellRail's inline
    rule: presence≠idle OR unread OR attention; rank working<active<idle,
    lastActivityAt desc; cap 6) + tests. ShellRail NOT touched (Phase 4).

## Just did
- Read BOT_TEAMMATES_SPEC.md + AGENTS.md; set up 3 node_modules symlinks
  (root, surfaces, surfaces/ai.allternit.com → shared checkout; surfaces one
  dangles harmlessly, same pattern as p02 env).
- Scoped all touched files; confirmed failure-reasons tests mostly cover
  retry policy (gap: realistic 401 body precedence).
- D1 DONE: `agent.types.ts` — additive `BotProfile.sectionId` on the merged
  BotProfile interface + both botProfile zod schemas (api round-trip).
  NEW `lib/bots/bot-hub-sections.ts` — pure section model: category-seeded
  defaults in BOT_CATEGORIES order, `resolveBotSectionId` (explicit
  sectionId → category bucket → `all`), `groupBotsBySection` (always emits
  the "All bots" bucket), create/delete/update chrome helpers, localStorage
  persistence at `allternit:bot-hub-sections` with in-memory fallback +
  corrupt-JSON tolerance. 18 colocated tests green.
- D1 UI DONE: `BotHubHomeTab.tsx` rewritten — sectioned roster when not
  filtering (flat grid kept for search/chip filtering so hidden bots stay
  findable); collapsible headings (persisted); per-section hide/show;
  custom-section create (inline form) + delete (category sections can be
  hidden; deleted sections never orphan bots — membership stays on the bot);
  HTML5 drag-a-card-onto-heading with heading highlight, Esc cancels;
  drop persists via `updateAgent(bot.id, { botProfile: { ...sectionId } })`;
  "All bots" bucket always renders and accepts drops (clears custom
  membership back to the category bucket). Empty sections self-prune unless
  a drag is in flight (drop targets).
- D2 DONE: `startBotGroupChat.ts` — session name is now exactly
  `Group: <groupId>`; human-readable name stays on the group record.
  NEW `startBotGroupChat.test.ts` (6 tests, stores mocked): exact-name rule,
  group-vs-session naming split, recreate-mints-new-name (no stale resume),
  metadata tags, size guard.
- D3 DONE (tests): `hasEpochDrifted` pure gate added to
  bot-capability-epoch.ts and used by useStartBotSession.ts (behavior
  unchanged) + exactly-one-rebuild tests; NEW
  `bot-teammates-selection.ts` — pure mirror of the ShellRail teammates
  rule (presence≠idle OR unread OR attention; rank working<active<idle then
  lastActivityAt desc; cap 6 + overflowCount) + 10 tests, ShellRail NOT
  touched; `mention-handoff.service.test.ts` (14 tests: attribution string
  format, parse/resolve, executeMentionHandoff w/ mocked wakeBot +
  agent store); failure-reasons.test.ts + realistic fund-mentioning 401
  body precedence case; NEW `bot-routine.service.test.ts` (11 tests:
  canonical-chat delivery prompt, 2KB continuity cap, failure recording,
  monitor fail-closed/no-change silent/4KB delivery cap/hash stamp,
  calculateNextRun).

## Next
DONE — all Phase 5 items implemented and verified. Handing off report to
parent; no commit/push per instructions.

## Verification (final)
- `npx tsc --noEmit` (surface): clean beyond the known environmental
  univerjs errors in packages/@allternit/office-sheets-app (stale
  docs-ui@0.25.1 vs core@0.21.1 install) — nothing from touched files.
- `npx vitest run` (surface): 171 files passed, 1358 tests passed / 14
  skipped. 2 failed: fabric-session-kind.test.ts (KNOWN pre-existing, called
  out in the task) and PluginManager.flows.test.tsx (5s timeout under full
  load; passes in isolation 5/5 — same pre-suite timing sensitivity p02
  observed, unrelated to this phase).
- `bun run build`: fails on the known stale-univerjs MISSING_EXPORT
  (DEFAULT_DOCUMENT_PARAGRAPH_* via docs-ui@0.25.1 vs core@0.21.1 in the
  shared checkout) — environmental, NOT fixed per instructions. All modules
  transform; failure is link-time in node_modules.

## Open questions / notes
- node_modules symlinks untracked; must not be committed.
- jsdom localStorage throws in this env — section pref helpers carry an
  in-memory fallback (same as p02); persistence tests are env-tolerant.
- DEVIATION: `views/AgentHub.tsx` needed NO changes — all section UI lives in
  BotHubHomeTab; AgentHub only hosts the tab. Listed surface file untouched.
- Phase 4 collision note: ShellRail's inline teammates filter/sort/cap should
  eventually delegate to `selectTeammates` (bot-teammates-selection.ts);
  left for the Phase 4 owner since ShellRail is their exclusive edit.
