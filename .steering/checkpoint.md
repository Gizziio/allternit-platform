# Steering checkpoint

Goal: Desktop bot UX cleanup — (1) remove dead Bot Roster view + the second left rail section it created in the shell rail, (2) fix transparent bot/agent "create box" (make it opaque white), (3) redesign bot-creation onboarding to be template-first and skippable (Hermes/Nous Portal patterns: zero-config defaults, templates over blank forms, skip-anything-optional).

Just did: Tasks 1+2 complete in worktree `altw/allternit-session-roster-cleanup` (branch `session/roster-cleanup`, uncommitted). Removed BOTS SECTION + BotRoster view registration + nav/policy entries + AgentHub button; deleted BotRoster.tsx / BotRosterContextMenu.tsx / BotRosterItem.tsx; kept bot-roster.store.ts, GroupChatRosterItem, Groups rail item (moved into home tabs). CreateAgentForm/CreateBotForm/AgentView now render opaque white (`bg-[var(--bg-elevated,#fff)]`, backdrop fallback `rgba(0,0,0,0.4)`). Typecheck clean on touched files (12 pre-existing errors elsewhere), `bun run build` passes.

Next: Task 3 — template-first onboarding redesign of CreateBotForm (template gallery step, name-only quick create, preselected runtime, always-available Create CTA), then re-run typecheck + build, then commit via steering gate.

Open questions: None. Out of scope: re-running prepare-platform-static / rebuilding the packaged Electron installer (needed before this ships in desktop).
