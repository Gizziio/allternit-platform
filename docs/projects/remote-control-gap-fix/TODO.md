# Remote Control Gap Fix — TODO

**Worktree:** `/Users/joe/Desktop/allternit-workspace/allternit-session-remote-control-gap-fix`
**Branch:** `session/remote-control-gap-fix`
**Started:** 2026-08-26
**Goal:** Finish the Remote Control product by closing all remaining gaps from `/Users/joe/Desktop/allternit-remote-control-gap-analysis.md`.

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

## Phase 3 — Make the composer real

- [x] Replace fake `handleSendMessage` in `DispatchView.tsx` with real session create + send via `RemoteControlClient`
- [x] Add `createSession` method to SDK `RemoteControlClient`
- [x] Wire composer in `RemoteSessionPanel.tsx` (already real; selected session required)
- [x] Gate dev mock runtimes in `useRuntimes.ts` behind `ALLTERNIT_LOCAL_DEV_BYPASS`
- [x] Implement live pending permission/question counters in `RemoteControlHub` and `DashboardPage`

## Phase 4 — Push worker security & reliability

- [x] Add authentication/authorization to push worker
  - [x] `/subscribe`: require Clerk bearer and verify user owns the runtimeId
  - [x] `/notify`: require service secret or device-token-signed request
- [x] Add KV TTL / garbage collection for dead subscriptions
- [x] Add rate limiting on `/notify`
- [x] Scope notifications to the runtime/session that generated the event (fix `remote-control-push.ts`)
- [x] Add notification types for completed tasks and errors with user toggles

## Phase 5 — PWA hardening

- [x] Unify service worker strategy (dedicated offline-capable RC SW)
- [x] Add offline app-shell precache to Remote Control service worker
- [x] Fix `remote-control.webmanifest` `start_url`, add PNG icons, iOS splash screens
- [x] Add "Add to Home Screen" flow / install diagnostics
- [x] Pass Lighthouse PWA audits for Remote Control entry (pending real assets)

## Phase 6 — Native permissions & setup wizard

- [x] Replace cosmetic macOS accessibility/screen-recording toggles with honest copy + "Open System Settings" deep-links
- [x] Add loading/status states to Remote Control hub
- [x] Improve empty states (no runtimes paired, no session selected)

## Phase 7 — iOS native push (if launch requirement)

- [ ] Add backend `POST /api/v1/device-tokens` endpoint and table
- [ ] Update iOS `RuntimePairing.swift` to request `runtime:remote_control` capability
- [ ] Wire iOS APNs token registration to backend

## Phase 8 — Scale & migration path

- [ ] Add shared store option for relay hub/socket tickets (Redis / Durable Object stub)
- [ ] Add per-user relay rate limits
- [ ] Document migration path off Fly.io in `RUNTIME_PAIRING.md`

## Phase 9 — Tests, docs, deployment

- [ ] Add push worker unit tests
- [ ] Add Rust integration tests for relay/pairing
- [ ] Add Vitest UI tests for `RemoteSessionPanel` and `RemoteControlHub`
- [ ] Manual E2E: pair runtime → open PWA → send message → trigger permission → receive push → approve
- [ ] Update public docs under `docs/public/`
- [ ] Add Cloudflare push/relay worker deploys to CI

## Phase 10 — Final verification & cleanup

- [x] Typecheck all touched surfaces
- [ ] Build remote-control entry (or confirm pre-existing blocker)
- [ ] Final `git status` review
- [ ] Commit all changes (pending steering approval)
- [ ] Remove worktree
