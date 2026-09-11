# Agent Work Attestation — Fabric Bot Hub fix + ACI live viewport

**Date:** 2026-09-11 13:10
**Session ID:** `ao/fabric-hub-aci-0911`
**Branch:** `ao/fabric-hub-aci-0911`
**Agent:** kimi (Kimi Code)
**PR:** https://github.com/Gizziio/allternit-platform/pull/358
**Merge commit:** `d191bcfd2`
**Ledger entry:** [../LEDGER.md](../LEDGER.md)

## What was done

Two Fabric Transport (fabrictransport.allternit.com) fixes, reported live on SW v35.

### 1. Bot Hub not rendering — missing ModeProvider

Reproduced by rendering `BotLaunchpadView` under the exact
`fabric-session/main.tsx` provider stack in a new vitest
(`BotLaunchpadView.pwa-stack.test.tsx`): `ChatComposer` → `BottomDock`
(`ChatCoworkToggle`) → `useMode` threw *"useMode must be used within a
ModeProvider"*. Desktop wraps the app in `ModeProvider`; the Fabric Session
PWA never had one — PR #328's Voice/Tooltip/Dropzone fix left ModeProvider
as the next missing provider, and the hub ErrorBoundary caught it (panel
survived, hub showed the component error).

- `fabric-session/main.tsx`: `ModeProvider` added (defaultMode `chat`).
- `vitest.config.ts`: `esbuild.jsx: 'automatic'` — aligns the test transform
  with the app build so components that omit the React import stop failing
  with "React is not defined" in tests.

### 2. Desktop-style live ACI viewport in the Fabric ACI drive

Fabric ACI was a bare screenshot pane; desktop ACI is `ACIComputerUseView`
(status strip, live screenshot, element highlight boxes, scanline glass)
fed by `browserAgent.store`. The fabric ACI stream (`streamAci` on
`FabricSessionClient`) relays the same `/api/aci/stream` envelope
(`state`/`screenshot`/`trace`/`done`), so the view is reusable as-is:

- `browserAgent.store`: the EventSource `onmessage` parsing extracted into a
  shared exported `applyAciStreamEvent()`; new `ingestAciStreamEvent()`
  action lets external streams feed the same state (marks the engine
  reachable on first frame). Desktop `runGoal` behavior unchanged — it now
  calls the same function.
- `FabricSessionPanel`: injects every `streamAci` frame into the store via
  `ingestAciStreamEvent`; seeds goal/status on "Open computer"; resets
  store view-state on session switch.
- `FabricAciDrive`: new `liveView` slot — `ACIComputerUseView`
  (`agentBarHeight={0}`) renders in place of the raw screenshot while
  watching with a frame; idle state, watch toggle, and event log unchanged.
- SW `CACHE_NAME` v35 → **v36**.

## How it works

The paired node's allternit-api maps ACU frames into the stream envelope
(`map_acu_frame` in `cmd/allternit-api/src/aci_routes.rs`); the fabric
relay proxies that stream to the PWA; the PWA feeds the shared store
parser, and the same component desktop ACI uses renders the live view with
element highlights scaled to the displayed image.

## Verification

- `pnpm typecheck`: 0 errors.
- vitest: dispatch + bots + capsules 37/37, incl. new
  `browserAgent.store.test.ts` (state→action/bounding-box mapping,
  WaitingApproval derivation, screenshot/trace, done→status Done, ingest
  engine-health). Re-ran after rebase onto main (composer-area session
  b569de1d landed mid-flight): 14/14 in touched areas, typecheck 0.
- `vite build --config vite.fabric-session.config.ts` +
  `prepare-fabric-session-pwa.mjs`: OK; bundle carries SW v36 + the
  ACIComputerUseView chunk.
- CI on PR #358: check-sw-cache-bump, Desktop unit tests, gitleaks,
  validate-typography pass; Vercel fails are the fleet-wide rate limit
  (pre-existing), ai-allternit Cloudflare Pages check pending/fails as on
  all recent PRs (pre-existing).

## Known gaps / remaining work

- **Deploy pending Eoj go-ahead** — PWA NOT deployed. From the
  `fabric-hub-fix-0911` worktree: vite build (fabric-session config) →
  prepare-fabric-session-pwa.mjs → `wrangler pages deploy tmp/fabric-session-pwa
  --project-name=allternit-remote-control --branch=main --commit-hash=d191bcfd2
  --commit-dirty=true`. After deploy: hard-refresh / clear site data
  (v35 → v36).
- Phone runtime verification of both changes needs a signed-in session.
- Desktop binary rebuild from merged main deferred (both changes are in the
  platform bundle; previous build b2095 predates them).
