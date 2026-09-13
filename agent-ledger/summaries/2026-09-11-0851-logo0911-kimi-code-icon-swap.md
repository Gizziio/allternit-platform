# Session attestation — logo0911 (kimi-code) — cream-squircle icon swap

- **Session:** `session/logo0911` · worktree `allternit-session-logo0911`
- **Agent family:** kimi-code · **Date:** 2026-09-11 08:51 local
- **PR:** #320 · **Merge SHA:** `4a5c96218` · branch commit `8d188c02c`
- **Approved plan:** swap every Allternit AI-product web surface to the master
  icon `/Users/joe/Desktop/icon-candidates-v7/01-a-only-cream-squircle.png`
  (Eoj-approved scope; favicon.svg retirement in scope; docs gets a different
  icon later; platform/shell removal handled separately — sync export was
  already retired on main before this session).

## What was done

1. **Assets (Pillow, from the 1024×1024 master):**
   - `surfaces/ai.allternit.com/public/`: `favicon.png` (256, opaque on
     `#fdf8f3`), `icons/icon-{192,512}.png` overwritten, recreated
     `fabric-session-icon-{192,512}.png` + `fabric-session-splash-1170x2532.png`
     (both were referenced but missing on main — pre-existing breakage from
     the 2d798b1d1 identity commit; the splash never entered git because the
     repo ignored `*.png` until recently, so composition was replicated from
     the old remote-control splash: bg `(15,12,10)`, 293×293 icon at 50%,50%),
     new `brand/a-only-cream-squircle.png` (RGBA master copy for UI use).
   - `platform.allternit.com/public/favicon.png`, `office.allternit.com/public/favicon.png`,
     phone-remote `icon-{180,512}.png`, computer-embed inline data-URI favicon,
     desktop `build/icon.{png,icns,ico}` regenerated from master (previous
     icon.png was a near-match variant, ~6% of pixels differed — user believed
     it was already the new icon; it was not quite).
   - `.gitignore`: `!` exceptions for the new PNGs; dead remote-control exception removed.
2. **Reference swaps:** every `favicon.svg` deleted (ai/office/platform/
   phone-remote); HTML icon links, `sw.js` + `fabric-session-service-worker.js`
   precaches, `_redirects` pass-throughs, `prepare-fabric-session-pwa.mjs`,
   `services/remote-control-push/sw.js` now use `favicon.png`.
3. **Fabric session SW CACHE_NAME:** v28 → **v30** (main had moved to v30 in
   `ao/fabric-mode-switch` #321 during the rebase window; conflict resolved to
   v30 with our favicon.png precache). Also fixed the stale "Remote Control
   PWA" comment.
4. **UI mark:** `AProtocolWordmark.tsx` re-authored — cream-squircle PNG mark
   (`/brand/a-only-cream-squircle.png`, sized by the existing `height` prop,
   `borderRadius 22%`) + unchanged TERNIT/suffix pixel-letter SVG with the
   same cascade/collapse animation. Props API preserved; no test/snapshot
   referenced the old SVG internals. Decorative `MatrixLogo` and the rail
   config mark untouched (out of scope). Office + platform-console header
   wordmarks untouched per Eoj.
5. **Dead remote-control surface removed** (`remotecontrol.allternit.com`,
   domain unbound 2026-09-06 per Brain): `remote-control.html`,
   `remote-control.{webmanifest,service-worker.js,icon-192.png,icon-512.png,splash-1170x2532.png}`,
   `vite.remote-control.config.ts`, its rollup input + dev plugin in
   `vite.config.ts`, `.github/workflows/deploy-remote-control-cloudflare.yml`,
   desktop `unified-main.ts` `/remote-control.html` window-open override and
   the `ALLTERNIT_REMOTE_CONTROL_URL` env fallback. **Kept deliberately:**
   Pages project `allternit-remote-control` (serves fabrictransport), push
   worker (`services/remote-control-push/`, `deploy-remote-control-push.yml`),
   and the `shell:open-remote-control` IPC — still the fabric-session window
   opener called by the ai renderer (`open-fabric-session-window.ts`).
   The in-app Fabric Transport "remote control" view (ViewRegistry/nav) is an
   unrelated feature and was not touched.

## Verification evidence

- `pnpm --filter @allternit/ai... build` ✅ — dist: new icons present, zero
  `favicon.svg`/`remote-control` refs in html/manifest/sw.
- Fabric PWA: `vite build --config vite.fabric-session.config.ts` +
  `prepare-fabric-session-pwa.mjs` ✅ (staged `tmp/fabric-session-pwa` deployed).
- `tsc --noEmit` (ai) ✅ · desktop typecheck (main+preload) ✅ ·
  platform-console build ✅ · office build ✅.
- `node scripts/release-preflight.mjs` → **35 passed / 0 failed** (suite has
  grown past the 26 checks the AGENTS.md mentions).
- Rebase conflict with main (fabric-session SW) resolved: kept v30.
- Live verification after CI deploy (byte-identical shasums vs repo assets):
  `ai.allternit.com` favicon.png / icons / brand PNG; `platform.allternit.com`
  favicon.png (console dist); `office.allternit.com` favicon.png.
- Manual deploy: `wrangler pages deploy tmp/fabric-session-pwa
  --project-name=allternit-remote-control --branch=main` ✅
  (Eoj-approved). `fabrictransport.allternit.com` now serves the Fabric
  Session PWA (manifest name "Allternit Fabric Session", new icons, SW v30),
  replacing the live v31 `desktop-follow-0911` remote-control dashboard build.

## Incidents / honest deferrals

- PR #320 initially CONFLICTING (fabric-session SW cache bump raced #319/#321);
  resolved by rebase, no functional change lost.
- Vercel preview checks on the PR fail with "Deployment rate limited — retry in
  24 hours" — pre-existing infra condition, unrelated to this change.
- `favicon.ico` requests on ai.allternit.com now get favicon.png via `_redirects`.
- Deferred/out of scope: docs.allternit.com icon (different icon coming);
  platform/shell removal (handled before this session — sync-platform-export
  retired in d5ae72dce); splash for other device classes; phone-remote is not
  Pages-deployed (icons land with its next normal release);
  `services/remote-control-push/sw.js` favicon.png is staged but nothing in
  the repo currently serves that SW's static assets.
- Desktop binary rebuild (AGENTS.md step 8) follows this attestation.
