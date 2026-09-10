# Steering checkpoint

**Goal:** P3 ao Fabric node (spec: Allternit Brain/Research/specs/ao-fabric-node.md, spike: Research/drafts/spike-p3-clerk-device-auth.md). Make `ao` a Fabric Transport node: `ao fabric pair|serve|status`. Binding: own 3-leg Ed25519 pairing (NOT Clerk OAuth), node never holds Clerk token; loopback axum shim on 127.0.0.1:8014 translating /v1/remote-control/* + /v1/{session,permission,question} to the engine socket API (session `ao`); line-faithful Rust port of cmd/agent-daemon relay client. Worktree allternit-ao-fabric-node, branch ao/fabric-node.

**Just did:** Server enum PR #220 open (ao/runtime-type-ao-enum). Fabric modules implemented + committed (gate-approved 6a5777398) + keep-alive pooling fix (c9aa10578): live pairing proved create works but the first exchange poll died on a reused dead keep-alive connection — `pool_max_idle_per_host(0)` fixed it; poller now runs the full 10-min window. Build clean, 16/16 fabric unit tests, detect::manifest parallel flakes confirmed as the documented pre-existing class (59/59 serial).

**Next:** Live pair code 798G-BU8F (expires 06:18:16Z 2026-09-10) awaiting Eoj's browser approval at https://ai.allternit.com/pair?code=798G-BU8F. FOUR codes expired unapproved today (NNGP-4CE9, VNHK-DAAA, D32B-9CBE, 262T-VAG6) — deployed approve page verified current (chunk has the approve call), so the click never lands; needs Eoj at the keyboard. Live ao session `ao-hardgate-demo` spawned + alive for the hard gate. NOTES skeleton written (docs/AO_FABRIC_NODE_NOTES.md). After approval: `ao fabric serve` → shim curl → relay connect → PWA hard gate → finalize NOTES + node PR + ledger.

**Open questions:** runtimeType "ao" needs PR #220 deployed; until then pair with --runtime-type desktop (D2 fallback).

---

<!-- merged checkpoint from ao/runtime-type-ao-enum + P3 checkpoint above; session/3a37a822 checkpoint below -->

**Goal:** Fix three Allternit Desktop bot-session UI bugs in `surfaces/ai.allternit.com`: (1) nav trap — no way home from a bot session, "New" bounces back; (2) two competing bot session views — route everything to the Gizzi in-chat view (`ChatView` embedded bot session) and decouple `BotChatSessionView` so it can be deleted later; (3) "local-only (backend unavailable) / Cannot stream before a live session exists: temp-…" on send, despite the bundled allternit-api running on :8013.
>>>>>>> origin/main

**Just did:** Phases 1–4 complete, all three bugs verified fixed in the live dev app (vite :3013 + dev Electron CDP 9225). Bug 3 root-caused live: Gizzi never registered with the bundled API (renderer sent `avatar` as an object → create 4xx; even if it succeeded the API minted a fresh uuid while the renderer kept the local id, so the `agent_allowed_on_surface` gate 403'd every `POST /api/v1/agent-sessions` → temp session → sendMessageStream throws). Fixes: API `CreateAgentBody` accepts optional client-stable `id` and `create_agent` is idempotent (`agent_routes.rs`, `cargo check`/`build` green); renderer `createAgent` stringifies object avatars and passes `id`; new `lib/bots/start-bot-session.ts` core with `ensureBotRegisteredWithApi` (warns on failure, no longer silent); `useStartBotSession` thinned to the core. Bug 2: new `openBotSessionInChat`/`openChatView` in bot-canonical-chat.service; all entry points repointed (ShellRail, BotPickerSheet, BotLaunchpad, BotTopDeck, BotHomeView, AgentHub, toasts, ShellApp, HUD handoff, BotHubSessionsTab, SearchView); legacy `openBotChatView` deleted; `bot-chat-session` removed from nav.types/nav.policy/ViewRegistry/watermark set (BotChatSessionView.tsx stays on disk unreferenced per owner decision). Bug 1: canonical-chat guard in ShellRail `handleNewSession` deleted ("New" always opens a fresh home chat); ChatView gained a slim persistent "← Back | <bot>" bar rendered for EVERY bot session — first version gated on `!showAgentCard` was hidden exactly when the Gizzi context card is open; fixed by dropping that condition and rendering the bar alongside (not `??`-behind) the agent context strip. Live verification (CDP-driven, screenshots in /tmp/3a37a822-*.png): Bot Hub → Gizzi → Chat opens the single in-chat session view; Back bar visible with card open; Back → home; rail New inside a session → home (no more bounce-back); `openBotSessionInChat` returns real `ses_*` id (not temp-); `sendMessageStream` resolved (no "Cannot stream before a live session exists"). Bonus fixes found during live verification: (a) PRE-EXISTING main breakage — `/desktop-templates/by-ref/{*ref}` (bot_desktop_templates.rs:28, 97a4b39f3) and `/computers/:id/proxy/{*path}` (computer_ws.rs:240, 64a464257) use axum-0.8 brace catch-all syntax on axum 0.7/matchit 0.7.3 → API panics at startup on ANY fresh build from main; fixed to `*ref`/`*path` (installed .app works only because its binary predates both commits). (b) Duplicate Gizzi tiles — bootstrap cold-start timeout created an API gizzi with server-minted uuid while the stale localStorage row merged back; fixed by same-lowercase-name dedupe in `mergeAgentCatalog` (remote wins, 2 new tests) + stable `id: 'gizzi-packaged-assistant'` in GIZZI_SEED. Store now shows exactly one gizzi. Phase 4 re-check after final edits: typecheck clean, 14/14 touched-file tests pass (full-suite 3 pre-existing failures verified identical at base).

**Next:** Phase 5 — commit logical units, sync to origin/main (at f3e176648), `node scripts/release-preflight.mjs` safety check, push, PR with verification evidence, merge (--merge), ledger attestation on main checkout (STEER_GUARD_OFF=1), cleanup worktree + scratch cdp scripts + /tmp pngs, kill vite/electron dev tasks, relaunch user's installed app.

---

# Steering checkpoint (prior: session/webmcp-playback)

**Goal:** Rebuild the Create Bot wizard (session/create-bot-wizard, 2026-09-09): Allternit-branded, 4-step click-through with a live Bot Hub card preview rail, real gating, single real template catalog (`BOT_TEMPLATES`), visible desktop provisioning, and an optional describe-to-prefill accelerator. Approved plan: `.steering/plan-create-bot-wizard.md`.

**Just did:** Milestone 5 + polish committed as `5e5a3e20b`: `describeBot.ts` (one call on the platform's existing `/api/chat/completions` route — playground request shape, `getDefaultAgentModel().id`, forced JSON + defensive validation; null on any failure incl. 20s abort), Start-step "Describe the bot you want" prefill box (suggested template defaults underneath, blank card otherwise, silent fallback), Job-step "Refine from my description" (same call, replaces systemPrompt on success). Polish: identity auto-focus, Esc-closes-only-when-idle, copy Register 1 sweep. Verified: typecheck:fast = exactly the 15 pre-existing errors; vitest src/lib/bots 431/432 (same 1 pre-existing vm-operator failure); create-bot tests 29/29 (12 new). Two commits on `session/create-bot-wizard`, not pushed.

**Next:** PR + merge + ledger attestation per session ritual (owner drives merge); milestones 1–6 all landed.

**Open questions:** None — plan approved by owner.

---

<!-- merged checkpoint from origin/main (session/shell-rail-home-cleanup) below -->

# Steering checkpoint — session/shell-rail-home-cleanup

Goal: Home-mode shell rail cleanup in the Allternit desktop surface
(`surfaces/ai.allternit.com`): remove collapsed-rail mascot pill, move Groups
to a bot-mode-only tab, fold Inbox into the (renamed) Bot Activity widget, move
Remote peers into the Fabric Transport view, inline the New button with the
tabs, move "Continue CLI session" into Recents (home + code), sticky tab
highlights, rename Agent Activity → Bot Activity everywhere user-visible.

Just did: re-applied the full edit set on top of newer origin/main
(2c7d3c990) after an outside process checked out origin/main in this worktree
and wiped the first (never-committed) pass. Reconciled with upstream
effe862b5 (mascot pill had been folded into the 44px collapsed-controls row —
removed from there) and kept upstream's `aci-recordings` browser view type.
Verification: typecheck:fast clean except the pre-existing unrelated error set
(office-* asset declarations, UnifiedTerminal xterm css); 31/31 targeted
vitest pass. A packaged build of the first pass exists at
`surfaces/allternit-desktop/release/Allternit-Desktop-1.1.0-arm64.dmg`
(unsigned, arm64) and was bundle-verified.

Next: commit on `session/shell-rail-home-cleanup`; user decides on PR/merge.
Packaged binary from the first pass predates the rebase but is functionally
identical (re-application verified equivalent); rebuild after merge if wanted.

Open questions: whether to PR/merge per the normal ritual (user said
edits + binary only so far). Note: the vite.config.ts PREVIEW-ONLY univerjs
patch from the earlier preview session did not survive the checkout — the
build of this branch may need that path fix re-staged locally.
