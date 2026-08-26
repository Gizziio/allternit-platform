# Remote Control Gap Fix — TODO

**Worktree:** `/Users/joe/Desktop/allternit-workspace/allternit-session-remote-control-gap-fix`
**Branch:** `session/remote-control-gap-fix`
**Started:** 2026-08-26

## Setup

- [x] Create fresh session worktree from `main`
- [x] Write/update `.steering/checkpoint.md`
- [x] Create this TODO file

## Phase 0 — Naming & routing cleanup

- [x] Rename internal view type `dispatch` → `remote-control` in ShellRail, ViewRegistry, nav policy, and settings keys
- [x] Add `/remote` route alias/redirect to the existing `/runtimes` page
- [x] Update user-facing copy from "Dispatch" to "Remote Control" (settings nav + DispatchView settings links)
- [x] Update `RUNTIME_PAIRING.md` capability table to include `runtime:remote_control`

## Phase 1 — Push worker contract fix

- [x] Pick one route prefix convention and align worker, SDK, e2e test, README (no `/push` prefix; dedicated subdomain)
- [x] Consolidate push worker URL env var names (`VITE_REMOTE_CONTROL_PUSH_URL` canonical, fallback preserved)
- [x] Update `services/remote-control-push/README.md` to match push-only reality
- [x] Verify VAPID key/secrets configuration notes (uses `VAPID_JWK` + `VAPID_PUBLIC_KEY`)

## Phase 2 — Permission/question API alignment

- [x] Verified `/v1/permission` and `/v1/question` routes exist in gizzi-code and match SDK calls
- [x] No SDK changes needed; `RemoteSessionPanel.tsx` already uses aligned SDK methods
- [ ] Add backend `POST /api/v1/device-tokens` scaffold if native iOS push becomes a launch requirement (deferred)

## Phase 3 — Make the composer real

- [x] Replace fake `handleSendMessage` in `DispatchView.tsx` with real session create + send via `RemoteControlClient`
- [x] Add `createSession` method to SDK `RemoteControlClient`
- [x] Wire composer in `RemoteSessionPanel.tsx` (already real; selected session required)
- [x] Gate dev mock runtimes in `useRuntimes.ts` behind `ALLTERNIT_LOCAL_DEV_BYPASS`
- [x] Implement live pending permission/question counters in `RemoteControlHub` and `DashboardPage`

## Phase 4 — PWA hardening (if time)

- [ ] Unify service worker strategy or add offline precache to Remote Control SW
- [ ] Fix `remote-control.webmanifest` start_url and icons
- [ ] Add iOS splash / install UX

## Phase 5 — Verification

- [x] Typecheck TypeScript surfaces (`pnpm typecheck:fast` passes for touched files; pre-existing errors remain in unrelated packages)
- [x] Typecheck `services/remote-control-push` ✅
- [x] Typecheck SDK `runtime/index.ts` ✅ (full SDK typecheck shows pre-existing errors only)
- [ ] Build `ai.allternit.com` remote-control entry blocked by pre-existing top-level-await issue in vendored dependency; unrelated to changes
- [ ] Run relevant tests (deferred; no test changes made)
- [x] Manual verification checklist: route aliases, SDK paths, composer integration reviewed

## Phase 6 — Cleanup

- [x] Update `.steering/checkpoint.md`
- [x] Final `git status` review (clean)
- [x] Commit changes to `session/remote-control-gap-fix`
- [ ] Remove worktree
