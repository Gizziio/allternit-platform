# Session 3a37a822 — Desktop bot-session UI fixes (kimi)

**Date:** 2026-09-09 · **Branch:** `session/3a37a822` · **PR:** #223 (merge SHA `0d25be342`) · **Agent:** kimi-code

## What was done

Fixed the three Allternit Desktop bot-session UI bugs Eoj reported, plus two bonus bugs found during live verification. Worktree: `allternit-session-3a37a822` (per the session-worktree ritual).

### Bug 1 — navigation trap (no way home from a bot session; New bounced back)

- `ShellRail.handleNewSession` had a "canonical-chat guard" that rerouted the rail "New" button back into the bot flow (`onOpen?.('bot-home', { botId })`) whenever the active session was a bot's canonical chat — the direct cause of the bounce-back. Removed; New always clears the thread/session and opens a fresh chat.
- `ChatView` renders a slim persistent "← Back | \<bot\>" bar for every bot session (`aria-label="Back to home"`), clearing the active native session (`setActiveNativeSession(null)`) and returning to the chat home empty state. Two placement fixes during verification: (a) it must show even while the Gizzi context card is open (first version gated on `!showAgentCard`, hiding it exactly when the card is up), and (b) it must render *alongside* the agent context strip, not behind `embeddedAgentStrip ?? bar`.

### Bug 2 — two screens fighting to be the bot session view

Owner decision: the in-chat session view (ChatView rendering the embedded bot session) is canonical. Route-only — `views/bots/BotChatSessionView.tsx` stays on disk, unreferenced.

- `bot-canonical-chat.service` gained `openBotSessionInChat(botId, options?)` (cold start: prepare session → `ensureBotRegisteredWithApi` → set active → dispatch `allternit:open-view {viewType:'chat'}`) and `openChatView()`. Legacy `openBotChatView` deleted.
- All entry points repointed: ShellRail (bot rows + TeammatesRailRow), BotPickerSheet, BotLaunchpadView, BotTopDeck, BotHomeView, AgentHub `BotHubSessionsTab`, SearchView, bot-activity-toasts (+ its test mock), ShellApp bot hook callback, HUD handoff, and `BotInboxContent` (new on main from #219 — imported the deleted `openBotChatView`; repointed during merge).
- `bot-chat-session` removed from the `ViewType` union (`nav.types.ts`), `nav.policy.ts`, ViewRegistry (route + dead `ChatAgentSessionRouter`/`MultiBotGroupChatSession` wrappers), `bot-activity-watermark.ts` FOCUSED set, and `BOT_MODE_VIEW_TYPES` in ShellApp.

### Bug 3 — "local-only (backend unavailable) / Cannot stream a message before a live session exists: temp-…"

Root cause (diagnosed live against the bundled allternit-api on :8013): Gizzi was never in the API `agents` table, so `POST /api/v1/agent-sessions` 403'd at the `agent_allowed_on_surface` gate, leaving a `temp-` session that `sendMessageStream` (`mode-session-store.ts:1411`) rejects. Two causes: (a) renderer `createAgent` sent `avatar` as an object → API 4xx (expects string); (b) even a successful create minted a fresh server uuid while the renderer kept its local id, so the row that existed didn't match the id the renderer asked about.

- `cmd/allternit-api/src/agent_routes.rs`: `CreateAgentBody` gained `id: Option<String>` (≤64 chars); `create_agent` is idempotent — returns the existing row when the id is already present.
- `agent.types.ts` / `agent.service.ts`: `CreateAgentInput.id?: string` (+ zod optional); `createAgent` passes `id` through and stringifies object avatars.
- New `src/lib/bots/start-bot-session.ts`: `prepareBotSession` (core moved verbatim from the hook) + `ensureBotRegisteredWithApi` (getAgent → placeholder check → createAgent with stable id; logs a warning on failure, never blocks). `useStartBotSession` is now a thin wrapper — public API unchanged.

### Bonus 1 — main was unbuildable: allternit-api startup panic (pre-existing, landed in this PR)

`/desktop-templates/by-ref/{*ref}` (`bot_desktop_templates.rs:28`, 97a4b39f3, 11:20 today) and `/computers/:id/proxy/{*path}` (`computer_ws.rs:240`, 64a464257, 04:58) used axum-0.8 brace catch-all syntax; the crate is axum 0.7 / matchit 0.7.3, where catch-all must be the bare `*name` form and only at the end. matchit rejected the routes at Router build → **any fresh `allternit-api` build from main panicked before binding**. The installed desktop app worked only because its binary (03:40) predates both commits; the desktop-v1.1.1 tag source contains 64a464257, so a tag rebuild would have panicked too. Fixed both to `*ref` / `*path`. `office_engine_routes.rs` `{op}` routes (Aug 6) are static-segment to matchit — no panic, possibly never-matching semantics — **noted, deliberately out of scope**.

### Bonus 2 — duplicate Gizzi tiles (found in live verification)

Bootstrap (`useAgentBootstrap.ts`) runs `await fetchAgents()` then checks `gizziExists`; on cold start the store fetch can time out (`AGENT_FETCH_TIMEOUT`, dev-transform race) → store empty → bootstrap creates an API gizzi with a server-minted uuid → the stale localStorage fallback row (`local-agent-registry.v1`) merges back → two Gizzi tiles. Fixed two ways: (a) `mergeAgentCatalog` in `local-agent-registry.ts` treats same-lowercase-name bots as duplicates (remote wins) + 2 regression tests (5/5 in that file); (b) `GIZZI_SEED` has stable `id: 'gizzi-packaged-assistant'` so the now-idempotent API create can't mint fresh uuids. **Not fixed (pre-existing, out of scope):** the API `agents` table already contains same-name duplicates for other seeded bots (Deep Research ×2, Code Assistant ×2, Data Analyst ×2, Data Catalyst ×2, Architect ×2) — remote-vs-remote twins the merge intentionally doesn't touch; data cleanup is a separate task.

## How it was verified

Live, against the real bundled API (dev Electron + vite :3013, CDP 9225, playwright `connectOverCDP`):

- Bot Hub → Gizzi tile → "Chat" opens the single in-chat session view (`/tmp/3a37a822-i1-in-session.png` — "← Back | Gizzi" bar + CHAT BOT card).
- Back bar → home (`i2-after-back.png`, "Morning Ritual" home). Rail New from inside a session → home (`i3-after-new.png`) — no bounce-back.
- `openBotSessionInChat(gizziId)` returned `ses_f78bdb65affeKIboJyHqt00Ais` (real id, not `temp-`); `sendMessageStream` RESOLVED — the "Cannot stream before a live session exists" error is gone. (Reply body empty only because the dev LLM provider auth failed — orthogonal, pre-existing.)
- API DB `agents` table has gizzi with `enabled_modes`; renderer store shows exactly one gizzi.
- `pnpm typecheck` clean; touched vitest files 25/25 (local-agent-registry 5/5 incl. 2 new, bot-activity-toasts 9/9, bot-routine 11/11). Full suite: 1471 passed, 3 pre-existing failures (fabric-session-kind, vm-operator snapshot, recordings) verified byte-identical at base commit via stash — not chased.
- `cargo check`/`cargo build` green for allternit-api; dev run confirmed the API starts and serves (route panic gone).
- `node scripts/release-preflight.mjs` — 26/0 (desktop release path untouched per owner; run as a safety gate).

## Incidents / honest notes

- Verification drove the *dev* app only; the installed `Allternit-Desktop-fresh.app` still runs old binaries, so the bugs persist there until the next desktop release build (deliberate per owner: no release-path changes, dev-run verification only).
- Vite HMR in the dev shell caused stale-module artifacts mid-verification (store imports reading duplicate module graphs); every final claim is backed by fresh-reload re-tests and screenshots, not the flaky intermediate reads.
- Pre-existing dev-env noise observed and not treated as bugs: CORS errors for `127.0.0.1:8013/api/peers` and `api.allternit.com/v1/models`; the `AGENT_FETCH_TIMEOUT` cold-transform race leaving the store empty until a manual `fetchAgents()` (worth a follow-up — it delays bot visibility on cold dev starts).
- Merge conflicts with #219 (shell-rail-home-cleanup rewrote ShellRail; BotInboxContent imported the deleted `openBotChatView`) resolved by taking main's rail and re-applying this branch's six routing changes, plus repointing BotInboxContent.
