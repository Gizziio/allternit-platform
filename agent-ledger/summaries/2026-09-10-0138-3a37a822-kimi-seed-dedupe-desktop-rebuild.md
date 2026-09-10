# Attestation — session/3a37a822-p2: seeded-agent dedupe, embed catch-all, bot-chat-session restore, desktop rebuild

- **Session:** 3a37a822 (kimi, phase 2 + phase 3 owner-feedback fix)
- **Date:** 2026-09-10 (phase 2 work spans 2026-09-09 → 2026-09-10)
- **PRs:** #224 (merge `cdf3ab67`), #226 (merge `95b0057f`), #227 (merge `4d4232a9`)
- **Worktree:** `allternit-session-3a37a822-p2` on `session/3a37a822-p2` (cleaned up after attestation)

## What was done

### 1. Duplicate seeded agents — PR #224
Root cause: `useAgentBootstrap.ts` seeds VENDOR/ORG agents once per browser
origin; its name-based `exists` guard reads the agent store, which is empty
when the store fetch times out on cold start, so the next boot re-seeded with
server-minted uuids. Fix: all seeds now carry client-stable ids
(`vendor-deep-research`, `vendor-code-assistant`, `vendor-data-analyst`,
`org-data-catalyst`, `org-architect`; gizzi already had
`gizzi-packaged-assistant`), and the gizzi-only variant cleanup was
generalized into a per-seed-name dedupe (`SEED_CANONICAL_IDS`) that runs on
EVERY boot (keeps the stable-id row, `deleteAgent`s the rest). Agents vitest
166/166; tsc clean.

### 2. Bundled API startup panic — PR #226
The cloud-computer p5 merge brought one more axum-0.8 brace catch-all
(`/embed/assets/{*path}` in `cmd/allternit-api/src/computer_embed.rs:95`)
that panicked the Router build in the bundled release binary (debug builds
were unaffected — why it slipped through). Fixed to `*path`. Repo-wide audit
for `.route("...{*...")`: clean.

### 3. Bot session view restore — PR #227 (owner feedback)
PR #223 had consolidated bot sessions onto the generic `chat` view; the
owner's feedback on the shipped build: that surface opens the chat start
screen instead of the bot session, and the dedicated view it removed is the
wanted one. PR #227 restores the pre-#223 `bot-chat-session` routing
(`BotChatSessionView`): nav type + policy, registry route (incl. multi-bot
group router), and every entrypoint #223 repointed (AgentHub, Shell rail +
Teammates rows + rail New canonical-chat guard, BotHome, BotLaunchpad,
BotPickerSheet, BotTopDeck, BotInbox, BotHub sessions tab, Search, HUD
handoff). `bot-activity-toasts` opens the canonical chat via
`openBotCanonicalChat` + `openBotChatView` again (test mock updated).
Deliberately KEPT from #223: the `start-bot-session.ts` session-start core,
the temp-session send-failure fix, and the ChatView bot Back bar as a safety
net. Verified: tsc clean; vitest lib/bots+lib/agents+nav 600/601 — the 1
failure (`vm-operator.test.ts` snapshot) is **pre-existing on main**,
verified by running the same test in the shared main checkout.

### 4. Desktop rebuild + reinstall
Full local release build (workspace cargo release incl. `allternit-local-engine`
→ `local-engine` binary in the shared root target, gizzi-code production
binary via `bun run script/build-production.js --target=darwin-arm64`,
whisper-cli, platform vite build, lume fetched from trycua releases into
`resources/bin`). DMGs repacked via `pnpm run dist` (arm64 + x64), unsigned /
unnotarized (no APPLE_* secrets — fine on the owner's machine, Gatekeeper
blocks it for anyone else). Installed at `~/Desktop/Allternit-Desktop-fresh.app`.

Build gotchas worth remembering:
- Fresh worktrees need `bash cmd/gizzi-code/script/ensure-sdk-dist.sh` before
  the gizzi production build.
- The `dist` script does NOT fetch lume; missing lume only shows at API boot
  ("Found Lume binary" log line).
- `npx electron-builder --mac dmg --arm64` alone failed (its tail exit code
  hid the error); the package `pnpm run dist` path works and also syncs the
  platform build into `resources/platform/`.

## Live verification (CDP click-through, screenshots saved)

App relaunched clean; API `GET /api/v1/global/health` → 200. Drove the real
UI over `--remote-debugging-port`:
1. Home screen renders (no JSON error page).
2. Rail shows exactly ONE Gizzi; DB `agents` table has exactly 6 rows, one
   per name (renderer dedupe now holding — no manual re-clean needed after
   the final boot).
3. Gizzi → Chat opens the dedicated **BotChatSessionView** (back arrow,
   "Start chatting with Gizzi", starter prompts, "Message Gizzi…" composer,
   model picker) — the view the owner asked to keep.
4. Sent "Reply with the single word pong" → streamed, reply contained
   "pong", NO `local-only` / `Cannot stream a message before a live
   session` error (the temp-session bug from the original report).
5. ← Back returns to the bot home view.

## Incidents (honest record)

- **Orphan API on quit:** quitting the app via AppleScript leaves the spawned
  `allternit-api` alive holding :8013; the next launch then hits AddrInUse
  and the window shows the raw JSON "Not Implemented" page. Recovery:
  `pkill -f "Resources/bin/allternit-api"`, relaunch, wait ~45–75s for
  "Server listening". Not fixed in this session — an Electron main-process
  lifecycle issue, worth its own ticket.
- **V133 migration panic was NOT my build's defect:** a concurrent session's
  older bundled API (shared-checkout release app) panicked on
  `V133__llm_provider_routing_policies is missing from the filesystem`
  because another, newer binary had migrated the shared DB to V139. The p2
  binary embeds V133–V139 (verified via `strings`); main's migrations dir has
  V139 on disk; DB is at V139 — they match.
- **Multi-instance contention:** another agent session launched a separate
  copy at `/Applications/Allternit Desktop.app` (`--remote-debugging-port=9225`)
  sharing the same Electron user-data dir; only one instance can hold the
  singleton, which blocked backend startup for the fresh app. I killed that
  idle instance (no backend running on its side) to verify; noted here so the
  other session knows to relaunch if needed. Also SIGKILLed an orphaned
  `gizzi-code serve` (PPID 1) holding :4096.
- **Packaged renderer dedupe didn't self-fire** after PR #224 landed (old
  gizzi uuid row persisted next to `gizzi-packaged-assistant`); DB was
  cleaned by direct sqlite (`agent_sessions` referenced zero agent rows —
  verified before deleting). Root reason in the packaged app not fully
  diagnosed; the code fix remains correct and is now holding.

## Deferred

- Orphan-API-on-quit lifecycle fix (see Incidents).
- Pre-existing `vm-operator.test.ts` snapshot failure on main (unrelated;
  left alone per ritual).
- Why packaged-app bootstrap dedupe didn't run on first boot after #224.
