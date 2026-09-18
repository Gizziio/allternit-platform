---
doc: project
updated: 2026-09-15
status: active
---

# Plan — OpenMaus polish into Allternit Bot Mode

**Packet:** `~/Downloads/allternit-botmode-openmaus-handoff.zip` (2026-09-15).  
**Visual SoT:** `demo/demo-1080.mp4` + `demo/frame-01.png` … `frame-09.png`.  
**Code SoT (local clone, not vendored):** `/Users/joe/Desktop/allternit-workspace/OpenMausBot-ref` — `v0.1.81` (`bae192b1`). Apache-2.0 `src/` + `server/`. Do **not** copy `enterprise/`.  
**Build SoT:** `brief/AGENT_BRIEF.md` + `brief/BUILD_CHECKLIST.md` + fork-plan **§10**.

This document is the working plan after analyzing that packet. It supersedes: Shape D vendor, the static HTML mock, and fork-plan §9.

---

## 1. What the packet actually is

| Path | Role |
|---|---|
| `brief/AGENT_BRIEF.md` | **Winning brief.** Do not vendor. Cherry-pick polish into existing Bot Mode views. Ranked P0/P1/P2. Mount points. Acceptance. |
| `brief/BUILD_CHECKLIST.md` | Same list, checkbox form. |
| `demo/` | OpenMaus product tour (45s) + frames. **This is what “good” looks like.** |
| `docs/allternit-vs-openmaus-botmode-gap.md` | Gap analysis. **§7 correction** is current: slices A–C are mostly shipped; P0 is craft, not greenfield. |
| `docs/openmaus-allternit-fork-plan.md` | Architecture map of OM 0.1.80. **§9 is stale** (vendor `src/`+`server/`). **§10 is the correction** (cherry-pick). |
| `docs/openmaus-botmode-inventory.md` | Evidence-backed OM feature list (v0.1.80). |
| `docs/allternit-botmode-inventory.md` | Evidence-backed Allternit ships vs spec vs live shots. `live-04` = stale provider roster. |
| `docs/specs/` | Frozen contracts: `BOT_AGENT_CONTRACT`, brain bind, identity+computer. |
| `mocks/allternit-bots-fabric-ao/` | Allternit mocks + Sep-9 live Fabric. Phone bottom-nav in mocks **01–03 is rejected.** |

Internal contradiction in the zip: §9 says vendor the harness; the brief and §10 say do not. **Resolve to the brief + §10.** That matches Joe in this session.

---

## 2. Decision (locked)

| Do | Do not |
|---|---|
| Rewrite/extend **Allternit** `views/bots/*` to OpenMaus interaction + IA | Vendor `packages/openmaus-botmode` or run their Node harness |
| Keep Allternit tokens / name | OpenMausBot name, mascot, `enterprise/` |
| Shell stays **Chat · Bots · Code · ACI** | New primary rail or phone Bots/Sessions/Computers/Devices tab bar |
| Runtime SoT: `bot.brain`, Computer Cloud, canonical chat, `gizzi bot`, ao sidecar | ASCII Box / Orgo / Composio as required |
| Change shared views once (Desktop + Fabric) | Fabric-only fork of the tree |

**Integrate decision:** `reverse_engineer` of UI (and the smallest Allternit-side data for sub-threads / picker scope). Not `fork_reskin` of their app.

---

## 3. What Allternit already has (do not rebuild)

From packet inventories + Hub tree:

- Atomic Create Bot + persistent Computer Cloud (#190 / #195)
- `bot.brain` native / cloud / UHP (#293 / #300)
- Shared Bot Mode in Chat · Bots · Code · ACI (#285, #322, #326, rail PRs)
- Approvals + watch strip (#294)
- Groups, team import, routines, connector picker, policy chips
- CLI `gizzi bot` (parallel, not driven by this UI)
- Transcript grammar already ported (#285): streaming bubble, tool folding, approval cards

**Still the product gap vs the video:** Bot Mode does not yet *look or behave* like a messaging app of teammates. Roster is still thin (name + status), not sections / role / last message / threads. Model control is a session picker, not the OM rail. One canonical chat per bot, not `+ New thread`.

Sep-9 `live-04` (harness-provider list) is **stale** — do not treat it as current Hub. Re-shot after #322/#326 is required before claiming personified roster.

---

## 4. Visual contract (P0 = these three frames)

| Priority | Frame | What to match | Allternit files |
|---|---|---|---|
| **P0-1** | `demo/frame-03.png` | Model picker: provider rail, **Only this thread / Thread + bot default**, effort Default→Max, account + CLI version, dim unavailable **with reason** | `BotChatSessionView` header, `ModelPicker`, `bot-brain.ts`, `BotBrainBindFields` |
| **P0-2** | `demo/frame-01.png`, `frame-02.png` | Roster: collapsible **sections/folders**, avatar, **Name + role/CoS badge**, last-message preview, hover pin/… | `BotRailRows`, `FabricBotModeRail`, `ShellRail` bot list, `BotLaunchpadView` |
| **P0-3** | `demo/frame-01.png` | **Sub-threads** under one bot: expand, thread preview, **+ New thread**, independent context | `BotRailRows` + canonical chat / session store — new thread must not destroy others |

P1 frames (after P0): activity “Worked for Ns” + screen-control ask (`frame-01` chat), calendar automations (`frame-07`), plugins + per-bot Allow (`frame-09`).  
P2: team map (`frame-05`, `frame-06`). Overflow menu Team map / Automations / Connected apps (`frame-04`).

---

## 5. Implementation shape

OpenMaus is a **reference**. Cherry-pick interaction/CSS **into Allternit components**. Map OM `server/` behavior onto Allternit APIs. Do not boot `127.0.0.1:8799` as Bot Mode.

| OM reference (read) | Allternit destination |
|---|---|
| `Sidebar.tsx`, `SidebarThreadRow.tsx`, `SidebarSectionHeader.tsx` | `BotRailRows` + Fabric/Desktop rails |
| `ModelPicker.tsx`, `EnginesSettings.tsx`, `EngineSetup.tsx` | Bot header picker + `bot.brain` |
| `ChatView.tsx` activity chip, screen-control ask | `BotChatSessionView` / `bot-chat/*` |
| `ApprovalCard.tsx`, `ApprovalModeSelector.tsx` | existing approval bridge — later P1 |
| `RoutinesPage.tsx` / calendar | skin over Allternit routines — P1 |
| `PluginsPanel.tsx` | per-bot Allow on existing connectors — P1 |
| `TeamMapPage.tsx` | optional P2 |
| `server/` | **do not run**; copy *contracts* (thread-scoped model, paused routines, connecting ≠ Allow) |

**Do not touch:** `BottomDock.tsx`, `ModeDock.tsx`, chat `ChatView.tsx` modes, `FabricSessionPanel.tsx` chrome, `FabricAppChrome.tsx`.

**Runtime adapters (keep):** `useStartBotSession`, `resumeOrCreateBotBrain`, `ensureBotComputer`, `bot-canonical-chat.service`, ao visibility sidecar, `gizzi bot`.

---

## 6. P0 acceptance

- [x] In Bots mode, model picker matches frame-03 interaction (rail + scope + effort + unavailable reason). Maps to `bot.brain`. Unavailable engines dimmed, never crash. (`BotModeModelPicker` in `BotChatSessionView`; Chat/Cowork catalog picker unchanged.)
- [x] Roster is sectioned contacts: `Name` + role line + useful preview — not a bare harness-provider list. Frames 01–02. (`BotRailRow` + `ShellRail` hub sections; ModeSwitcher untouched.)
- [x] Each bot can have multiple sub-threads; **+ New thread** does not wipe the others. Frame-01. (`createBotThread` writes `botThreadOf`, leaves `canonicalChatIds` in place.)
- [ ] Chat · Bots · Code · ACI still switches.
- [ ] `bot.brain` + Computer Cloud bind still work on create/start.
- [ ] No OpenMausBot name/mascot.
- [ ] Evidence: Hub screenshots of the three P0 surfaces vs the three frames (not a standalone HTML mock).

---

## 7. What this session already did (and what to keep)

| Attempt | Verdict |
|---|---|
| Vendor OSS tree + iframe harness | **Rejected.** Unwound. |
| Static `preview/bot-mode-merge.html` | **Rejected.** Not the visual SoT. Do not use. |
| Hover “…” copy, long-paste collapse, rail byline | Tiny craft on transcript/rail. **Keep if it does not fight P0.** It is **not** P0. Roster still needs sections, role badges, last-message, threads. |

---

## 8. Build order (when execute starts)

1. **P0-1 Model picker** — highest visual delta; `bot.brain` already exists; work is the picker UI + thread vs bot-default scope.
2. **P0-2 Roster polish** — sections + `Name — Role` + last-message on `BotRailRows` / launchpad.
3. **P0-3 Sub-threads** — needs a real thread list under `canonicalChatIds` (one-to-many). This is the only P0 that may need a small store/API change.
4. Stop. Screenshot vs frames. Then P1 only if Joe says continue.

Deploys dry-run. No `confirm: true`.
