# Attestation — Fabric Transport: full ACI interface + app-mode sync (PR #375)

- **Session:** `ao/fabric-mode-aci-0911` (kimi)
- **Date:** 2026-09-11 19:03 local
- **PR:** https://github.com/Gizziio/allternit-platform/pull/375 — merged as `c13f511ac`
- **Live:** https://fabrictransport.allternit.com/ — SW cache **v37** (was v36)

## What was done

Follow-on UX to PR #358 (fabric bot hub + ACI live view), fixing two gaps Eoj reported against desktop parity:

### 1. ACI mode = the full desktop ACI computer interface; runs land in the ACI rail

- New `surfaces/ai.allternit.com/src/components/dispatch/FabricAciModeCanvas.tsx`: mounts the desktop `ACIComputerUseView` viewport (top status strip, live screenshot, element highlights, idle/error/connecting states) with a goal composer bar underneath (brain picker, watch toggle, run button). Replaces the raw-screenshot `FabricAciDrive` chrome in the fabric session surface.
- `FabricSessionPanel.openComputer` now routes a started run the way the desktop shell lands an ACI run in browser mode: `setDriveKind('aci')` + `pickSession(run.sessionId)` + auto-watch when watching was off.
- Selecting an existing ACI session seeds the viewport from `latestComputerFrame(detail, events)` (base64, data-URI prefix stripped) instead of showing the blank idle state.
- `ACIComputerUseView` gained an `engineHint` prop (default `true`). The fabric surface passes `false`: the engine runs on the paired node and `engineHealthy` defaults to `false`, so the stock idle copy wrongly claimed the local engine was unreachable.
- `FabricAciDrive` and `FabricLiveEventLog` removed from `FabricSessionDriveViews.tsx` (no remaining consumers). `handleSend` no longer special-cases ACI; the generic chat composer is not rendered in ACI mode (the canvas has its own goal bar).

### 2. Bot-mode composer stuck on Chat

- Root cause: the fabric PWA's `ModeProvider defaultMode="chat"` was never updated when entering the Bots rail, so `ChatCoworkToggle` in the bot composer dock highlighted Chat; clicking Bots dispatched `allternit:switch-mode` into the void.
- Fix: `FabricSessionPanel` mirrors `driveKind` into the platform app mode via new pure mappings in `src/lib/fabric-session-kind.ts` — `fabricKindAppMode` (chat/bot/code/aci+desktop→browser) and `fabricAppModeKind` (reverse, cowork→chat). A panel-level listener handles `allternit:switch-mode` and switches the fabric rail, so the dock toggle is live.
- The fabric drive kind remains the source of truth; the mode sync is one-directional (kind → mode).

Unchanged per the fabric constraints: Bots rail still uses `getBots(agents)` packaged bots only (no `mergeNodeBots`/`useUnifiedRoster` in the rail); Chat/Code/ACI keep `listBrains()`; Shell header URL untouched (`VITE_ALLTERNIT_WEB_URL || https://ai.allternit.com`).

## Verification

- `pnpm --filter @allternit/ai typecheck` — clean. Repo-wide `pnpm typecheck` has a **pre-existing** failure in `packages/@allternit/office-pptx-engine/src/slide-transfer.ts` (`replaceAll` vs `lib` target) untouched by this diff.
- `vitest run src/components/dispatch src/capsules/browser` — 27/27, including new `FabricAciModeCanvas.test.tsx` (5 tests: viewport+composer render, trimmed-goal submit + clear, empty-goal guard, watch toggle, host fallback) and extended `fabric-session-kind.test.ts` (mode↔kind mappings).
- `vite build --config vite.fabric-session.config.ts` + `scripts/prepare-fabric-session-pwa.mjs` — OK from the worktree at merged main (`c13f511ac`).
- Deployed via wrangler from that worktree: `pnpm exec wrangler pages deploy tmp/fabric-session-pwa --project-name=allternit-remote-control --branch=main --commit-hash=c13f511ac --commit-dirty=true`. Live `https://fabrictransport.allternit.com/fabric-session-service-worker.js` serves **v37**.
- CI on PR #375: Desktop unit tests, Typecheck and build desktop, gitleaks, validate-typography, check-sw-cache-bump, Cloudflare Pages — all pass. Vercel checks fail fleet-wide (account build-rate-limited ~24h, pre-existing).

## Incidents / notes

- Mid-session, `/Users/joe/allternit-main` (a secondary clone this session had created its first worktree from) was deleted by an external cleanup, and macOS TCC briefly blocked `~/Desktop`. The in-flight worktree was re-homed: a fresh worktree was created from the shared checkout at `~/Desktop/allternit-workspace/allternit` (forward-only, shared checkout untouched), the 8 changed files copied over (verified zero upstream drift on them), and the orphaned directory removed. A first commit accidentally swept `dist-fabric-session/` build output in; amended out and force-pushed before PR creation (branch had no other consumers).
- Phone users must hard-refresh / clear Fabric Transport site data to pick up SW v37.
- Deferred: desktop app rebuild to bundle this (b2095 predates PR #375). Offered separately; not started.

## Addendum (19:15 local) — desktop rebuild from merged main

- Rebuilt the desktop app from main `2c94dbb51` (includes PR #375): `Allternit-Desktop-1.1.1-b2186-arm64.dmg`, unsigned (no APPLE_* creds), `release-preflight.mjs` 35/0 before building.
- Bundle verified: SW `allternit-fabric-session-v37`, `data-aci-goal-composer`/`Run a task on` (FabricAciModeCanvas), `fabricKindAppMode`, `mode-provider` chunk, all six `resources/bin/` sidecars; `CFBundleVersion 1.1.1.2186`.
- Replaced `/Applications/Allternit Desktop.app` (was a parallel session's timestamp-versioned build `1.1.1.1789151397293`, installed ~14:30 local) after quitting it; quarantine cleared; app relaunched and running (main + GPU helper processes).
- Canonical DMG copied to `allternit-desktop-preview/surfaces/allternit-desktop/release/`; superseded DMGs removed per Eoj's standing instruction: b2095 (this session's earlier build), b2138 and `local` (parallel session's, both superseded by b2186).
- Worktree `desktop-rebuild-0911` removed after the install verified.
