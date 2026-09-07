# 2026-09-06 — roster-cleanup (kimi) — desktop bot UX: remove Bot Roster, opaque create box, template-first onboarding

**Branch:** `session/roster-cleanup` · **Commit:** `9c2e2e3b6` · **Merged to main:** NO — awaiting owner review/merge
**Worktree:** `~/altw/allternit-session-roster-cleanup` (kept until merge)

## What was done (3 tasks, one commit)

1. **Removed the dead Bot Roster view + the second left rail it created.**
   - `ShellRail.tsx`: deleted the collapsible "BOTS SECTION" that nested `<BotRoster nested/>` inside the home shell rail; moved the Groups rail item into the home tabs so group chats stay reachable. Removed dead code: `botsExpanded` state/toggle, `handleCreateBot`/`handleStartBot`/`handleOpenBotHome`, `useStartBotSession` hook block, and the zero-caller `BotRailItem`/`BotMailBadge` components + their orphaned imports.
   - `ViewRegistry.tsx`: deleted the `bot-roster` registration + import; `BotChatSessionView` back-fallback now targets `agent-hub`.
   - `nav.types.ts` (ViewType union) and `nav.policy.ts`: removed `bot-roster` entries.
   - `AgentHub.tsx`: removed the header "Bot Roster" button.
   - Deleted `views/bots/BotRoster.tsx` (1269 lines), `BotRosterContextMenu.tsx`, `BotRosterItem.tsx` (verified zero importers outside BotRoster).
   - **Kept:** `lib/bots/bot-roster.store.ts` (still consumed by `useStartBotSession.ts` + `bot-canonical-chat.service.ts` for the canonical-chat map; header comment updated), `GroupChatRosterItem.tsx` (used by GroupsListView), the `groups-list`/`group-chat` views.

2. **Fixed the transparent create box.**
   - `CreateAgentForm.tsx` root was `bg-transparent` and rendered inline (AgentView, Settings → Agent Ops) → now `bg-[var(--bg-elevated,#fff)]` (+ fallbacks on sticky footer/summary panels).
   - `AgentView.tsx` create-mode wrapper got the same opaque background.
   - `CreateBotForm.tsx` modal card: `bg-[var(--bg-elevated,#fff)]`; backdrop now `bg-[var(--shell-overlay-backdrop,rgba(0,0,0,0.4))]` (comma fallback — two stacked bg classes would NOT reliably fall back when a var fails).

3. **Template-first, skippable bot-creation onboarding** (`CreateBotForm.tsx`, ~480 lines changed), modeled on Hermes Agent / Nous Portal onboarding (zero-config defaults, templates over blank forms, skip-anything-optional):
   - New step 1 "Start": template gallery (Research / Coding / Writing / Data / Ops / Blank) prefilling tagline, welcome message, 3 starter prompts, accent color, `botCategory`. Local `START_TEMPLATES` constant — existing `BOT_TEMPLATES` in bots.manifest.ts are heavyweight agent-factory defs, not prefill-shaped, so not reused.
   - Identity step now leads with display name only; handle/tagline/category/purpose/welcome/accent/starter-prompts moved into a collapsible "Advanced details".
   - Runtime step relabeled "Runtime (optional)", auto-selects first available brain + model on load.
   - "Create bot" CTA in the footer on every step, enabled at displayName ≥2; per-step gating removed; stepper clickable in any order. Live preview + checklist side panel kept.
   - `BotHubHomeTab.tsx` empty-state copy updated.
   - **Latent bug fixed:** `agent.store.ts` validates the RAW payload via `validateAgentCreationChecklist` before `agentService.createAgent` normalizes — so the old form (which never set `characterLayer`) failed the client-side gate; `normalizeCreateAgentInput`'s default could never rescue it. The new `handleCreate` builds the default character layer client-side (`buildDefaultCharacterLayer()`) and synthesizes a compliant description, so name-only quick-create passes every checklist item. The old form's name≥2/description≥3 gating also never matched the checklist's name≥3/description≥10 — also fixed (handle auto-derived, padded `-bot` if <3 chars).

## Verification

- `bun run typecheck`: zero errors in touched files; 12 pre-existing errors remain in untouched files (FabricSessionDriveViews 6, AppsExtensionsView 4, platform-auth-client 1, NativeSessionPicker 1).
- `bun run build`: ✓ built in 11–23s, exit 0 (run after each task).
- No tests reference BotRoster anywhere in the repo (verified by grep) — typecheck + build is the safety net.
- **Not done:** interactive browser smoke of the new flow (dev-server click-through). Recommend a quick manual pass on the template gallery + quick-create before merging.
- **Not done (out of scope):** re-running `prepare-platform-static.cjs` / rebuilding the packaged Electron desktop — the desktop ships the frozen web build, so this change only reaches desktop users after that rebuild.

## Known follow-ups / judgment calls

- Runtime auto-selection flips the default from "Platform model" to routing through `brains[0]` whenever brains are discovered (users can still switch manually).
- `.steering/checkpoint.md` updated for this session (steering hook state).
- Install note: worktree needed `pnpm install` (workspace repo; plain `bun install` doesn't link workspace packages). Lockfile churn was reverted; only the 16 task files are in the commit.
