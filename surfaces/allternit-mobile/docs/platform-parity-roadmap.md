# Allternit Platform / iOS Parity Roadmap

> Snapshot as of 2026-08-16. This doc maps the user's latest polish list against what currently exists in the web platform (`surfaces/ai.allternit.com`) and the iOS app (`surfaces/allternit-mobile/ios`), then lists the parity work needed on each surface.

---

## TL;DR

- **Connector icons** are now fully mapped for Allternit's legacy 181-entry catalog (`cmd/allternit-api/assets/open-design/connectors.json`). The vendored **Open Connector** sidecar (`services/open-connector`) actually has **1,063 providers** in `catalog/apps/`, and the backend already merges those into `/api/v1/connectors` when the sidecar is running (`connector_routes.rs::list_connectors` + `sidecar_only_entries`). The reason many connectors still don't connect is usually one of: (1) the open-connector sidecar is not running, (2) the Allternit catalog id has no matching sidecar provider id and no alias in `assets/connector_id_aliases.json`, or (3) the provider's OAuth/API-key endpoints are not fully mapped in `connectors.meta.json`.
- **iOS is already closer to parity than expected**: it has Agent/Bot Hub, mode selector with pipe separators, Bot selection sheet, Code list + canvas, ACI browser/agent/chat, Mini Apps Store, read-only Office viewer, and a real Connectors client.
- **The biggest iOS gaps** are: Bot Home detail view (web's `BotHomeView`), native document signing, file-association deep links, Site API surface, polished mini-app rail defaults, and the same chat-composer polish (top-deck glass pills, Claude-style + sheet) that the web still needs.
- **The biggest platform gaps** are: chat composer + top-deck polish, code canvas multi-terminal UI polish, console/usage-card polish, Site API tab rail behavior, file associations for Office files, native DocuSeal signing, and the Bot Home / mode selector fixes the user already called out.

---

## 1. ACI / Browser / Mini Apps

| Item | Platform status | iOS status | Parity action |
|------|-----------------|------------|---------------|
| File association for md/doc/xls/pdf → open in Allternit Office | Missing. No registered file handlers / deep-link routing. | Missing. `OfficeDocumentView` only opens artifact ids; no `UTType` imports or deep links. | Add platform file-picker/URL handler + iOS `Info.plist` `CFBundleDocumentTypes` / `UTImportedTypeDeclarations` and route to `OfficeDocumentView`. |
| Native DocuSeal-style signing (no API key, no Docker) | Partial. `src/views/office/NativeSigningView.tsx`, `src/lib/native-signing.ts`, `src/pages/SignDocumentPage.tsx` exist, but user wants no dependency on DocuSeal server. | Missing. No signing UI. | Implement client-side PDF signing (pdf-lib + drawn signature) and save signed PDF to artifact library on both surfaces. |
| Site API tab moves shell rail to Home | Broken. Selecting Site API resets rail selection to Home instead of staying in ACI mode. | Missing. No Site API surface. | Fix web rail state; add iOS Site API view with CTA to create API + domain contracts. |
| Site API tab visual polish | Needs redesign. | Missing. | Redesign both with clearer cards + CTA. |
| Second Brain UI standard | `src/views/brain/BrainView.tsx` is the target standard. | `Features/Brain/BrainCaptureSheet.swift` exists; full Brain view parity unclear. | Audit iOS Brain view against web Second Brain and align spacing/colors. |
| Claw / Hermes / Oh My Pi / Vault Viewer polish | Exist but not at Second Brain standard. | Likely missing or stub. | Audit `src/views/{openclaw,hermes,omp,vault-viewer}` and either remove or polish to Second Brain standard; decide iOS inclusion. |
| Mini apps pinned in rail presentation | Pinned apps exist in rail but need better presentation / default-on-add behavior. | `MiniAppsStoreView` has pin; no rail integration shown. | Ensure every newly added mini app is pinned by default; polish rail iconography + tooltips on both. |
| Mini App Store catalogue polish | Pill tabs clip outside cards. | Basic grid exists; needs polish. | Fix web card clipping; bring iOS store to same visual standard. |
| Browser / Computer Agent chat polish (composer, Matrix logos, glowing orb) | Matrix logos oversized/unscaled; composer needs polish. | ACI tab has browser/agent/chat but uses generic SF Symbols. | Fix web logo scaling; replace iOS ACI/agent glyphs with Matrix logo; polish composer. |

---

## 2. Code

| Item | Platform status | iOS status | Parity action |
|------|-----------------|------------|---------------|
| Usage card polish | `src/views/code/CodeUsageDashboard.tsx` has horizontal primary row but user wants cleaner. | `Features/Chat/Views/UsageLimitViews.swift` / `BudgetDashboardView` exist; not integrated into Code. | Redesign usage card (reference screenshot); make it horizontal-first on both surfaces. |
| Chat top-deck pills glass/see-through | Pills are solid background color, text not dark. | Unknown / likely same solid style via shared composer. | Change top-deck pill backgrounds to glass (`backdrop-blur` / `.ultraThinMaterial`) and text to dark/primary on both. |
| Composer + button Claude-style UX | `ChatComposer.tsx` has a simple `PLUS_MENU_ITEMS` dropdown. | `ComposerPlusSheet.swift` exists but may not match Claude parity. | Rewrite + sheet to match Claude desktop: context-aware attach/project/style/connectors with submenus. |
| ACI dev server / terminal sideline offline | `src/views/code/CodeTerminalCanvas.tsx` references sideline; backend no longer uses mux. | `TerminalSessionView`/`PtySession` talks to gizzi-code instance; works when paired. | Remove/replace dead sideline UI on web; iOS already uses instance-based pty. |
| Console branding/polish | Console has tan coloring; needs Allternit branding. | Terminal uses theme colors but may need brand pass. | Apply Allternit color tokens; remove tan on web. |
| Codex code-session research | Not implemented. | Not implemented. | Research Codex sessions; add parity features (session plan, checkpoints, etc.) behind design. |
| Code canvas / multi-terminal organization | `CodeCanvasView.tsx` has infinite canvas + overlay pop-over. | `CodeCanvasView.swift` exists as a sheet. | Polish web canvas (user said current console attempt is wrong); ensure iOS canvas supports tile/overlay/multi-terminal organization. |
| Agent hub in code mode → rename agents & bots | Web rail still says "Agent \| Bot Hub" in some places but code-mode integration unclear. | `AgentHubView` renamed; code surface uses agent pill. | Decide if code-mode needs a separate agent hub or if composer pill is enough; rename everywhere. |

---

## 3. Home / Agent-Bot Hub

| Item | Platform status | iOS status | Parity action |
|------|-----------------|------------|---------------|
| Agent hub rename to "agent \| bot hub" | Rail label is updated, but other surfaces still say "Agent". | `AgentHubView` title is "agent \| bot hub". | Sweep platform + iOS for remaining "Agent Hub" labels. |
| Bot Home view page | `src/views/bots/BotHomeView.tsx` exists with Home/Tasks/Artifacts/Runtime/Automation tabs. | Missing. `AgentDetailView` likely partial. | Build full Bot Home view on iOS matching web: hero, stats, sessions, runtime, automation. |
| Workspace view standardized | Web BotHomeView workspace/runtime/automation tabs need deep audit. | `AgentHubView` has Sessions/Workspace/Config tabs; workspace just lists agents. | Standardize web Bot Home spacing/branding; build real workspace inspector on iOS. |
| Bot on/off pill + modal placement | Exists in `HomeView.tsx`/`ChatComposer.tsx`; user says modal badly placed. | `AgentHubView.botTogglePill` opens `BotSelectionSheet`; placement okay. | Fix web modal placement/anchoring; ensure iOS sheet uses polished presentation. |
| Populate bots / restore 9 modes / pipe separator | Web mode selector lost modes and now uses dot. | `AgentHubView.modeSelector` already uses `\|` separators and `AgentModeTile.visibleTiles`. | Fix web mode selector to restore all modes and pipe separators; share tile definitions with iOS. |
| Start real bot session (not home chat) | `useStartBotSession` + `ChatComposer` try to start bot session. | `AgentModeStore` + composer pill handle bot binding. | Verify both actually create `sessionMode=agent` sessions with correct `agentId`. |
| Gizzi mascot replaced by bot avatar | `AgentModeGizzi.tsx` uses Gizzi mascot. | `AgentAvatarView` exists; mascot replacement likely partial. | When bot mode is on, replace Gizzi with selected bot's avatar on both surfaces. |
| Home view session scoping | `HomeView.tsx` filters bot/code sessions but user wants stricter scope. | `MainWorkspaceView` routes by tab; code sessions only in Code tab. | Ensure Home/web shows only chat/cowork sessions; bot sessions in Bot Home; code in Code. |
| Rail: Recents + Bots on same line with `\|` toggle | Currently separate collapsible sections. | Unknown / not implemented. | Redesign rail so Recents and Bots share a toggled line on both web and iOS sidebar. |
| Forward/back arrows by expand/collapse widget icon | Missing. | Missing. | Add nav arrows between light rails, visible collapsed and expanded. |

---

## 4. Connectors

| Item | Platform status | iOS status | Parity action |
|------|-----------------|------------|---------------|
| Connector brand icons | **Fixed for the legacy 181.** `connector-logo.ts` uses the local manifest. Sidecar-only providers fall back to a favicon service. | Uses initials/generic glyphs. | Port icon manifest to iOS `ConnectorsListView` for the legacy 181; decide icon strategy for the ~882 sidecar-only providers. |
| Connector connect actually works | Backend already merges 1,063 sidecar providers. Connect failures are usually: sidecar down, missing alias (`assets/connector_id_aliases.json` only has 22 mappings), or unmapped OAuth/API-key endpoints. | Same real `ConnectorsClient`; same backend limitation. | Ensure open-connector sidecar is running in all envs; expand `connector_id_aliases.json`; finish OAuth/API-key mappings in `connectors.meta.json` for curated providers. |
| Connector category grid vs vertical list | `BotRuntimeConfigModal` shows vertical single-item lists per category. | Not applicable (no runtime config UI). | Fix web runtime config to show connectors in a proper multi-column grid by category. |

---

## 5. Office / Documents

| Item | Platform status | iOS status | Parity action |
|------|-----------------|------------|---------------|
| Office file association / open files | Platform has Office apps but no OS-level file association. | Read-only `OfficeDocumentView` + `OfficeEditorWebView`; no import from Files app. | Register file types on web (PWA file_handlers) and iOS; route opened files into artifact library. |
| PDF signing saved to artifact library | Signing view exists but user wants native no-server. | No signing. | Build client-side PDF signing on both; save signed doc to artifact library with share/export. |

---

## 6. Cross-surface design tokens / components

| Item | Platform status | iOS status | Parity action |
|------|-----------------|------------|---------------|
| Matrix logo scaling | Multiple oversized logos in Browser Computer Agent chat. | Uses SF Symbols / custom assets; verify sizes. | Scale all Matrix logos to icon size on web; align iOS sizes. |
| Modal overlay colors (dark grey) | Some bot modals use dark grey (`--shell-overlay-backdrop`). | iOS uses `BgSecondary` etc. | Ensure all modals use light/glass themed surfaces matching mode. |
| Glass surfaces / Allternit branding | Mixed; some surfaces use tan/old console. | Uses asset catalog colors; mostly aligned. | Standardize console, usage, runtime config to Allternit tokens. |

---

## 7. Recommended order of attack

1. **Quick wins (web + iOS)**
   - Fix Matrix logo scaling in Browser/Computer Agent chat.
   - Fix chat top-deck pill backgrounds to glass and text color.
   - Fix Mini App Store card clipping and set mini apps pinned-by-default.
   - Fix Bot Home modal overlay colors.
   - Fix web mode selector: restore 9 modes and pipe separators.

2. **Web-only fixes**
   - Site API tab rail state.
   - ACI dev server/terminal sideline cleanup.
   - Console/usage card polish.
   - Composer + button Claude-style rewrite.
   - Bot runtime config connector grid.

3. **iOS parity builds**
   - Port connector icon manifest to `ConnectorsListView`.
   - Build full `BotHomeView` equivalent (home/tasks/artifacts/runtime/automation).
   - Add Site API surface.
   - Add native PDF signing + artifact-library save.
   - Add file-association deep links for Office files.
   - Align chat composer + top-deck pills with polished web design.

4. **Backend dependency**
   - Keep the open-connector sidecar running in dev/prod so the full 1,063-provider catalog is exposed.
   - Expand `connector_id_aliases.json` so legacy Allternit ids map to sidecar provider ids.
   - Finish connector auth mappings so the **Connect** button actually works across the catalog.

5. **Research**
   - Codex code sessions → define parity scope before building.

---

## 8. Bot parity update (2026-08-19, branch `session/ios-bot-parity`)

The Aug 17–18 web bot work (webhook triggers `b7655b34f`, OpenMausBot Phase 2 bot ops state `c690648cd`, bot hub `6673a8b78`/`1ad05d965`, bot desktop VMs `4441da4fe`, cowork day-of-week selector) was ported to iOS:

| Web feature | iOS landing |
|-------------|-------------|
| `BotHubHomeTab`/`BotHubCard` bot grid (bots from `GET /api/v1/agents` filtered `isBot`, accent color, category filter, session counts) | `AgentHubView` home tab bot grid; `Core/API/Models/BotProfile.swift` (`BotProfile`, `BotCategory`, `AgentRecord.isBot/botProfile/…` over the `config` bag — the backend merges `isBot`/`botProfile` into `config`, there are no wire columns) |
| Bot operational status (`bot-operational-state.store.ts` taxonomy + precedence) | `Core/API/Models/BotOperationalState.swift` + `Core/BotStatusStore.swift`; status pill in hub + detail. Fed by `GET /api/v1/agents/:id/events` SSE via new `Core/API/AgentEventsClient.swift` (the web's `bot-event-store` is browser-localStorage and not portable). Note: the stream only emits `agent.run.started/completed/failed` + `agent.created`, so `waiting_approval`/`waiting_input`/`blocked` have no event source yet |
| Bot activity feed (`bot-activity-api.ts`) | `AgentDetailView` "Activity" section rendering the SSE-derived recent-events feed (live while subscribed; no server-side history exists yet) |
| `WebhooksSettingsPanel` CRUD + deliveries | `Features/Settings/WebhooksSettingsView.swift` (+ row in `SettingsView` agent section); `Core/API/WebhookTriggersClient.swift` + `Core/WebhookTriggersStore.swift`. Secrets are never displayed (server never returns them) |
| `BotHomeView` Webhooks status card | `AgentDetailView` "Webhooks" card ("N triggers wake this bot") linking to the settings panel |
| `BotDesktopView` VM status + observe/take-over/hand-back | `AgentDetailView` "Desktop" section; `Core/API/BotDesktopClient.swift` + `Core/BotDesktopStore.swift` (`/api/v1/bots/:id/desktop*`) |
| `DayOfWeekSelector` cron dow editing | `Core/CronDays.swift` (`parseCronDays`/`applyCronDays` port) + `Features/Automation/Views/DayOfWeekSelector.swift`, wired into `CreateRoutineSheet` and `CreateAutomationTaskSheet` (latter only for cron-shaped input, since it also accepts plain-language schedules) |

**Follow-ups — resolved 2026-08-19 (same branch):**
- ~~Server-owned bot event ledger~~ — **done**: `cmd/allternit-api/src/bot_event_routes.rs` + migration `V93__bot_events.sql` (`POST/GET /api/v1/bots/:id/events` with cursor pagination + idempotent append, `GET /api/v1/bots/:id/operational-state` computed on read). Web reconciled: `bot-events-api.ts` client, `GoalLoopRecorder` dual-writes server + localStorage replica, `BotActivityAPI` reads from the server, `bot-operational-state.store` fetches the server projection. iOS: `BotEventsClient` + `BotStatusStore` bootstrap (server snapshot first, SSE live after).
- ~~Approval/input-request events~~ — **done**: allternit-api `POST /api/v1/agents/:id/events/ingest` (allowlisted `agent.run.waiting_approval/approval_resolved/waiting_input/blocked`); `agent_chat_bridge`/`run_agent` pass `x-allternit-agent-id`/`x-allternit-run-id` to gizzi-code; gizzi-code `agent-event-bridge.ts` maps permission/question bus events onto the ingest route; iOS `BotStatusStore` folds them into `waiting_approval`/`waiting_input`/`blocked`.
- ~~VNC desktop streaming~~ — **done (native)**: `Features/Agents/Desktop/` — a native RFB 3.8 client (`RFBClient`/`RFBProtocol`/`RFBDecoder`: Raw + CopyRect + ZRLE, incremental parsing, keysym input) over `URLSessionWebSocketTask` with bearer auth on the upgrade (WKWebView can't set WS headers), plus the fullscreen `BotDesktopView` viewer. Observe mode is view-only on both sides: the iOS viewer disables input in observe mode, and `cmd/allternit-api/src/bot_desktop_stream.rs` now drops observer WebSocket input messages server-side so the VNC server never receives them.
- Also fixed: web `vm-operator.ts` built control URLs as `desktop?sandbox_id=X/observe` (verb inside the query value → 405); now `/desktop/observe?sandbox_id=…`.

**Still open:** server-side search for bot activity (`BotActivityAPI.search` is local-only); VNC live verification needs `OPEN_SANDBOX_URL` configured.
