# Checkpoint — session/botmode-0912: bot-mode local-only zombie sessions

## Goal
Make bot mode work end-to-end in Allternit Desktop (user-facing error: "This bot
session is local-only (backend unavailable)… Cannot stream a message before a
live session exists: temp-…") and land the session per the repo ritual.

## Root cause (diagnosed live via CDP against the running desktop)
When a bot chat's backend session create failed (older builds / offline), the
session store's catch marked the optimistic `temp-…` session
`executionPersistence: 'local'` with NO `agentModeId`. That combination:
1. survives the persist/rehydrate sweeps (they only checked `executionPersistence`),
2. can never send — `sendMessageStream` rejects non-backend ids without a local mode,
3. wins the bot-session lookup (most recently updated), so every later send fails
   forever with the temp- error. `BotChatSessionView.handleSend` also skipped
   recreating a session whenever ANY session id existed.

## Fix
- `mode-session-store.ts`: new exported `shouldRetainPersistedSession` (temp kept
  only when `executionPersistence==='local' AND agentModeId`), used by partialize +
  onRehydrateStorage; createSession catch only falls back to a local temp session
  when a real mode id exists (no more zombies).
- `BotChatSessionView.tsx` handleSend: a temp- session without a local mode is
  treated as absent → creates a real backend session and sends there.
- Tests: `mode-session-store.local-fallback.test.ts` (7 tests, all green).
- Adopted prior uncommitted WIP from the shared checkout (bot-chat inline artifact
  UI: SettledBubble/InlineArtifactRenderer/transcript/adapter + tests) — the
  desktop relay/fabric part of that WIP was already on main (94d779145).

## Verification
- typecheck (tsc --noEmit) clean; vitest: 7 new + 190 agents + 56 bot-chat + 15 bots pass.
- release-preflight 35/0.
- Live desktop e2e (rebuilt app from this worktree, real profile): Bot Hub → Gizzi
  → Chat → "Message Gizzi" composer → send → POST /api/v1/agent-sessions created
  ses_f67e94480ffe… (real backend id, "session open"), no local-only error; model
  switch to Kimi K3 → assistant replied "smoke-ok" and it rendered in the transcript.

## Incidents / notes
- Stale HTTP cache in the desktop profile served old chunks after rebuild; cleared
  Cache/Code Cache and relaunched.
- Preview app from the shared checkout held :8013 (singleton + port); quit with
  user approval.
- Reply only streams after picking a provisioned model (Kimi K3). The default
  openai/gpt-5-mini gives ProviderModelNotFoundError from gizzi — pre-existing
  provider-config issue, out of scope.
- `bot-e2e-desktop-flow.cjs` (stale WIP script targeting the old "Agent | Bot Hub"
  shell) intentionally NOT committed.

## Next
Commit, push, PR, merge, attest, rebuild desktop from merged main, cleanup.
