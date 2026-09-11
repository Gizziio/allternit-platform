# fabric-pwa-bot-mode-deferred — leftover #285 items + desktop rebuild

- **Date:** 2026-09-10
- **Agent:** grok
- **PR:** https://github.com/Gizziio/allternit-platform/pull/294 · merge `a421d0da2`

## What landed

Follow-up to `rq-20260910-007` / PR #285 leftovers:

- `replyBotApproval` / `useBotApprovalBridge`: approval cards call permission-store `replyPermission` (cowork POST or native permissions API). No invented `grantKey`.
- Fabric PWA **Watch computer** mounts `BotWatchStrip` so screenshots pull while chat is open.
- SW `CACHE_NAME` bumped to `allternit-fabric-session-v24`.
- Live 390×844 smoke: Bots section visible at `http://localhost:3013/fabric-session.html` (storageState `/tmp/botmode-e2e-state.json`). Screenshot: `~/.agent-orchestrator/evidence/fabric-pwa-bot-mode-ui/pwa-fabric-390x844.png`.

## Desktop rebuild

Unsigned local arm64 DMG from merged main after #294:

- `surfaces/allternit-desktop/release/Allternit-Desktop-1.1.1-b1960-arm64.dmg`
- buildVersion `1.1.1.1960`
- Packaged `fabric-session-service-worker.js` has `v24`
- Packaged assets include `replyBotApproval` (`BotChatSessionView-CKQmjwj1.js`, `fabric-session-BCla7hpJ.js`) and empty-state copy "No bots on this account yet"

Previous local rebuild `…-b1955-arm64.dmg` was #285-only (v23) and is superseded.

## Verification

- vitest: `bot-approval-bridge` + `bot-chat` → 55/55
- GitHub Actions on #294: check-sw-cache-bump, gitleaks, typography, desktop vitest — pass. Vercel rate-limited (ignored).
- PWA smoke: `botsSection: true`, no errors

## Honest leftover

- Fabric machine `streamAci` still only runs while `FabricSessionPanel` is mounted. PWA chat watch pulls the **bot** computer via `BotWatchStrip` / `getBotDesktopScreenshot`, not a paired-node ACI session the user has not opened.
- DMG is unsigned/unnotarized (no APPLE_* creds); Gatekeeper will block other machines.
