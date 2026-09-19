# 2026-09-19 — Post-launch readiness sweep (kimi-code orchestrator, direct-to-main by owner directive)

## What was done

Direct commit `ef2e4ce51` on main (no PR — Eoj explicitly ordered commit-and-deploy for the
post-launch readiness sweep; shared-checkout work, orchestrator escape `STEER_GUARD_OFF=1`).
This repo's slice of a fleet-wide audit that covered the desktop app, all product surfaces,
and all marketing sites.

### Changes (13 files)

- **`resources/company.json`** — removed duplicate `clerkJwksUrl`/`clerkIssuer`/
  `clerkPublishableKey` keys whose empty-string last-wins copies shipped broken auth
  config into every packaged app. Correct key is the `clerk.allternit.com` prod key
  (verified against `cmd/gizzi-code/src/constants/allternit-auth.ts:13`, the iOS project,
  and commit f706faea1). Generator (`scripts/generate-company-config.cjs`) structurally
  cannot emit dupes; they were hand-committed in e406b5f63. Known footgun left documented:
  generator's preserve-existing fallback would re-propagate empty values from a broken file.
- **Desktop dead IPC wiring removed** — `startOAuth` preload exposure (no handler anywhere;
  renderer never calls it; OAuth works via real navigation/setWindowOpenHandler 3586cf112);
  `gizzi-daemon:*` handler group + subscriber-less `webContents.send('gizzi-daemon:status')`
  in onboarding (zero consumers in renderer, tests, `resources/platform` export, and the
  live allternit-ai source). Kept `gizzi-daemon-manager.ts` itself and the **load-bearing**
  `ipcMain.on('app:get-platform-url')` sendSync variant — the audit's "fully dead" claim was
  wrong for that one; only the invoke variant was removed.
- **`isUrlReachable`** (both copies) — 2xx/3xx only; 404/401 no longer reports healthy on
  the splash screen. Call sites verified to expect 2xx/3xx.
- **Hygiene** — deleted stray tracked compiled root `index.js` (zero refs; wrapped
  long-deleted `native/vm-manager/`); removed duplicate `packageManager` key;
  `repository.url` → `https://github.com/Gizziio/desktop` (matches updater feed at
  unified-main.ts:214-219 and build.publish).
- **Docs refresh** — KNOWN-ISSUES (3 of 4 items already fixed, verified against code; kept
  voice + reframed mesh item), README (release feed EXISTS: Gizziio/desktop hourly poll;
  install via install.allternit.com; unsigned/Gatekeeper caveat), CHANGELOG (restructured:
  empty Unreleased on top, 1.1.1 current, hardening notes moved to dated 1.1.0), AUDIT.md
  (test count + 4115 LOC, two surgical edits only).
- **platform.allternit.com favicon.png** — regenerated 256px from canonical cream-squircle
  A master (`/Users/joe/Desktop/icon-candidates-v7/01-a-only-cream-squircle.png`).
- **cloud-api** — `GET /health` (exact) added to public routes as alias of
  `/api/v1/health` (cmd/allternit-cloud-api/src/lib.rs:425). Root /health was returning
  401 to conventional probes. Takes effect on next Contabo deploy.

## Verification evidence

- `node scripts/release-preflight.mjs` — **52 passed, 0 failed** (desktop release path touched)
- `pnpm run typecheck` (desktop main+preload) — PASS
- `pnpm run test` (vitest) — **24 files / 163 tests, all pass**
- Console: `tsc --noEmit` + `pnpm run build` — green; dist favicon md5 matches new asset
- `cargo check -p allternit-cloud-api` — exit 0 (7 pre-existing warnings, none new)

## Honest deferrals

- **Desktop v1.1.1 release publish to Gizziio/desktop — NOT done (human gate).** CI build
  with all 11 assets already exists on this repo's `desktop-v1.1.1` release. Checklist
  prepared for Eoj: tag `v1.1.1` (leading v — install.sh parser), attach the 11 CI assets,
  do NOT upload the unsigned `-local` DMG, mark unsigned/unnotarized in notes. Until then
  install.allternit.com `releases/latest` still resolves v1.0.0 (install.sh fallback now
  1.1.1 if API unreachable — websites repo commit 1daa196b).
- **Signing certs appear NOT completed** — no codesigning identity on the Mac, no
  APPLE_*/CSC_* secrets in CI, notarize.cjs still warn-and-skip. Eoj to confirm Apple cert review.
- `/health` alias unverifiable live until deploy-cloud-api-contabo runs on this push.
- Desktop rebuild (lifecycle step 8) skipped: no desktop src change affects the bundled
  workspace UI or sidecars beyond what the next tagged release will pick up; owner
  prioritized the release-publish gate instead.

## Sibling-repo landings (same sweep)

- `Gizziio/allternit-websites` `1daa196b` — quote CTAs, docs dead-domain links, favicon
  rollout, email unification, media wiring (104 files), webp conversion, sitemaps,
  install-page versions.
- `Gizziio/allternit-ai` — index.html title, Manufacturing Coming Soon CTA disabled.
