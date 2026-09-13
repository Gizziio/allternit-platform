# Session attestation — session/botmode-0912 (bot-mode desktop zombie-session fix)

- **Date:** 2026-09-12 (evening)
- **Agent family:** kimi-code
- **PR:** #435 → merge `3bb1fcdd1` (merge commit of `session/botmode-0912`, tip `cbe67cb3a`)
- **Topic:** "This bot session is local-only (backend unavailable)… Cannot stream a
  message before a live session exists: temp-…" — every bot chat in Allternit Desktop.

## What was done

**Diagnosis (live, via CDP against the running installed desktop).** The local
backend was healthy the whole time: `POST /api/v1/agent-sessions` with a fresh
Clerk token returns 201, and the renderer's `/api/*` calls are 307-redirected by
`unified-main.ts` into the `allternit-api://` protocol broker, which injects the
scoped desktop token. The actual failure was a **persisted zombie session**:
when a bot session's backend create failed (older builds / offline window around
2026-09-07/08), `createModeSessionStore.createSession`'s catch kept the optimistic
`temp-…` session with `executionPersistence: 'local'` and **no `agentModeId`**.
That combination (1) passes the persist/rehydrate sweeps (they only checked
`executionPersistence`), (2) can never send — `sendMessageStream` rejects
non-backend ids without a local mode — and (3) wins the per-bot "most recent
session" lookup in `BotChatSessionView`, so every later send failed forever.
`handleSend` also never re-created a session whenever any session id existed.
Reproduced exactly: Gizzi bot chat, `Message Gizzi` composer, send →
`local-only … temp-1788790439118-z4c8xw`.

**Fix (two layers + hygiene):**
- `mode-session-store.ts`: new exported `shouldRetainPersistedSession` — a temp
  session survives reloads only when it can actually execute locally
  (`executionPersistence === 'local'` AND `agentModeId`); applied in both
  `partialize` and `onRehydrateStorage`. The `createSession` local fallback now
  requires a real mode id (`localModeId`), so bot sessions without a mode no
  longer produce zombies — the real backend error surfaces instead.
- `BotChatSessionView.tsx` `handleSend`: a `temp-` session without a local mode
  is treated as absent → creates a real backend session and sends there
  (existing local-mode sessions keep working offline).
- Adopted the previously uncommitted bot-chat WIP from the shared checkout
  (inline artifact rendering: `SettledBubble` artifact parsing, new
  `InlineArtifactRenderer`, transcript/adapter/types support + tests). The
  desktop relay / fabric half of that WIP was already on main (`94d779145`) —
  applying the diff 3-way onto latest main produced zero net change there.
  Also fixed a WIP typecheck break (`part.content ?? ""` in SettledBubble).

## Verification evidence

- `tsc --noEmit` clean; re-verified on the merged-with-main branch.
- vitest: 7 new (`mode-session-store.local-fallback.test.ts`) + 190 lib/agents +
  56 bot-chat + 15 bots suites all green.
- `node scripts/release-preflight.mjs` → 35 passed, 0 failed.
- **Live desktop e2e** (app rebuilt from this branch, real user profile):
  Bot Hub → Gizzi → Chat → send → `POST /api/v1/agent-sessions` created real
  backend session `ses_f67e94480ffeZVHpp9gAH76N25` (header: "session open"), no
  local-only error. Default model `openai/gpt-5-mini` → gizzi
  `ProviderModelNotFoundError` (pre-existing provider-config gap); after picking
  **Kimi K3** the assistant replied `smoke-ok` and the reply rendered in the
  transcript. Screenshot: `/tmp/e2e-final-reply.png` (session evidence).

## Incidents / honest deferrals

- Stale HTTP cache in the desktop profile served pre-fix chunks after the first
  rebuild; cleared `Cache`/`Code Cache` and relaunched — new chunk
  (`mode-session-store-xrDnEe8M.js`) loaded.
- A preview app built from the shared checkout (`release/mac-arm64`, b2022)
  held the singleton + port 8013; quit with owner approval before the e2e.
- Sidecar binaries from the installed b2186 build are stale vs current main
  (Rust moved: computer-use batch dispatch, ao-engine, gizzi telemetry, console
  backend), so the desktop rebuild ran the full `build:electron:dmg` chain
  (fresh cargo release) rather than reusing them.
- **Deferred (pre-existing, unrelated to this fix):** gizzi has no
  `openai/gpt-5-mini` provider configured (bot default model) — chat silently
  produces no reply until the user picks a provisioned model; providers
  subconscious/tokengo/modelis are all unconfigured; memory_routes recall error
  (`no such column: summary`) logged by the API; cloud control-plane calls
  (`/api/v1/billing/subscription`, `/api/v1/agent-sessions/sync`) 401 from the
  renderer via `allternit-api://cloud`.
- Stale WIP script `bot-e2e-desktop-flow.cjs` (targets the removed
  `Agent | Bot Hub` shell) intentionally **not** committed.
- Seeded test agent `Botmode E2E` (`e676222f-…`) left in the DB (harmless);
  owner may delete it from Bot Hub.

## Desktop rebuild

Full `npm run build:electron:dmg` from merged main in the session worktree
(background build; installed over `/Applications/Allternit Desktop.app` after
verification, previous DMG kept until the new bundle was confirmed).
