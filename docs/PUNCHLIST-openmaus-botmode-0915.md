# Punch list — Allternit Bot Mode vs OpenMaus (2026-09-15)

**Owner ask:** A + C — fix hub/open-bot so P0 is reachable, and leave a coding punch list.
**Live repro:** Safari `http://127.0.0.1:3014/shell` on Joe’s Mac, Vite from worktree `allternit-session-openmaus-botmode-0915` (`surfaces/ai.allternit.com`).
**Repo:** `https://github.com/Gizziio/allternit-platform`
**Branch note:** Local worktree is on `session/openmaus-botmode-0915` with **~53 dirty files (uncommitted)**. That branch was **not** on `origin` at review time. Do **not** assume remote has BotModeModelPicker / bot-threads / BotRailRows polish. Implement cleanly from this list + brief; treat local WIP as optional reference only if you can see it.

**Visual SoT:** OpenMaus demo frames (handoff zip) — messaging app of bots, not Chat launch lobby.
**Do not:** Vendor OpenMausBot; change Chat · Bots · Code · ACI shell; invent phone bottom-nav.

---

## What Joe sees (broken product)

1. Center canvas = old **BotLaunchpadView** = Chat launch clone:
   - Greeting “Always on. Always ready.” (`BOT_LAUNCH_GREETING` / `LaunchHeader`)
   - `ChatComposer` + ModeDock Chat / Cowork / Bots
   - Agent Swarm / template gallery energy
   - Bot cards grid under it
2. Left rail shows BOTS with some contact-style lines (role / CoS), but **clicking a bot does not open bot chat**. Canvas stays on hub. No `New thread`, no frame-03 model picker.
3. P0 UI that exists only inside `BotChatSessionView` is **unreachable**.

Hypothesis (verify, don’t lock): `FabricBotModeRail.handleOpenBot` → `startSession` / `prepareBotSession` returns null or never calls `openBotChatView`; CustomEvent `allternit:open-view` with `bot-chat-session` never fires on rail click.

---

## P0 — must ship (acceptance)

### P0-A — Open bot always opens chat
- [ ] Clicking a bot in Fabric Bot Mode rail opens `bot-chat` canvas (`BotChatSessionView`).
- [ ] Opening must not depend on ao running, VM boot, or cloud session id shape; local/temp session is OK with a non-blocking warning.
- [ ] Hub “Bot Hub” still returns to hub; back from chat returns to hub.
- [ ] Evidence: Hub screenshot after click shows chat transcript chrome, not Agent Swarm lobby.

### P0-B — Hub is messaging-first (replace launchpad metaphor)
- [ ] `BotLaunchpadView` must stop being a Chat launch twin. Remove / demote:
  - “Always on. Always ready.” as the primary Bot Mode home identity
  - Agent Swarm / Featured template gallery as the Bot Mode home body
  - Chat/Cowork/Bots ModeDock as the primary Bot Mode home control
- [ ] Home should feel like a **roster / inbox**: empty state or selected-bot prompt that pushes into chat; optional compact “message a bot” that requires a selected bot and then opens that bot’s chat.
- [ ] Keep Allternit tokens / Gizzi mascot; no OpenMausBot branding.
- [ ] Shell ModeDock / Chat drive unchanged.

### P0-C — Roster (frames 01–02)
- [ ] Rail rows: avatar, name, role/CoS badge, last-message or status preview, expandable threads, hover pin/…
- [ ] Sections/folders if already sketched (`bot-folders.store`) — wire visibly; don’t leave dead stores.

### P0-D — Sub-threads (frame 01)
- [ ] Expand bot → thread list; **+ New thread** creates another session without wiping others.
- [ ] Switching threads swaps `BotChatSessionView` sessionId.

### P0-E — Model picker (frame 03)
- [x] In bot chat header: provider rail, Only this thread / Thread + bot default, unavailable engines dimmed with reason. (2026-09-17: picker now consumes the live platform catalog — `allternit-engine-catalog.ts` adapter over `useModelDiscovery` + `useAvailableBrainModels`; cli-status is enrichment only; Connect → `ProviderGallery`; usage/account slots real-or-omitted; save failures restore + surface. 39/39 picker tests pass.)
- [~] Effort: chips **hidden** — traced send path carries no effort to any driver (gizzi PromptInput strips it), so showing chips would be fake. Effort persists on pin/brain for when the backend path lands.
- [x] Maps to `bot.brain` / existing brain bind — do not invent a parallel catalog for Chat/Cowork. (Adapter reuses the Chat catalog; bot-scope pick no longer touches the global Chat/Cowork `selectModel` default.)

---

## P1 (after P0 green in Safari)

- [ ] Activity “Worked for Ns” chip + screen-control ask
- [ ] Calendar automations UI over existing routines
- [ ] Plugins + per-bot Allow

## P2

- [ ] Team map optional; overflow menu Team map / Automations / Connected apps

---

## Files to touch (Allternit destinations)

| Area | Paths |
|---|---|
| Hub | `surfaces/ai.allternit.com/src/views/bots/BotLaunchpadView.tsx` (+ drop Chat launch coupling) |
| Open path | `FabricBotMode.tsx` (`handleOpenBot` / `useStartBotSession`), `start-bot-session.ts`, `bot-canonical-chat.service.ts` (`openBotChatView`) |
| Canvas routing | `FabricBotModeCanvas`, `FabricSessionPanel` (`driveKind === 'bot'`) |
| Roster / threads | `BotRailRows.tsx`, `bot-threads.ts`, `bot-folders.store.ts` |
| Picker | `BotModeModelPicker.tsx`, `BotChatSessionView.tsx`, `bot-brain.ts` / `bot-mode-model.ts` |

**Do not touch:** `BottomDock`, `ModeDock` (chat), `FabricAppChrome`, Chat `ChatView` modes, phone bottom-nav mocks.

---

## Done when

1. Safari Bot Mode: hub ≠ Agent Swarm lobby.
2. Click Accountant / Kiwi → chat opens every time (even if ao offline).
3. Expand bot → New thread works; model picker matches frame-03 interaction.
4. Chat · Bots · Code · ACI still switches; `bot.brain` + Computer Cloud bind still work on create/start.
5. PR with Hub screenshots of the three P0 surfaces (not a static HTML mock). `preview/bot-mode-merge.html` is rejected — do not revive.

## Explicit non-goals

- Vendoring OpenMaus `server/` or booting `:8799` as Bot Mode.
- Replacing the Fabric shell.
- Marking P0 complete in docs without Hub evidence.
