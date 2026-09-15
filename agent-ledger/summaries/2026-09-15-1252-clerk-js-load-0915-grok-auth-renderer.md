# Session attestation — clerk-js-load-0915 — auth renderer Clerk JS load

- **Session:** `session/clerk-js-load-0915` + `session/clerk-js-proxy-0915` (grok)
- **PRs:** #550 (`d07b085e3`), #552 (`5dd567b0e`)
- **Date:** 2026-09-15 12:52 CDT

## What was broken

The installed Desktop auth renderer looped
`failed_to_load_clerk_js` / `failed_to_load_clerk_js_timeout` on
`https://allternit.com/__clerk/npm/@clerk/clerk-js@5/dist/clerk.browser.js`.
curl of that URL is 200. The hang was inside Electron.

`protocol.handle('https')` on the auth partition owns the whole scheme so
it can serve `https://accounts.platform.allternit.com/__desktop_auth__/`.
Other https — including clerk-js — was forwarded with `authSession.fetch()`,
which re-enters the same handler and deadlocks until Clerk's script timeout.

## What landed

- #550: forward with `net.fetch` + `bypassCustomProtocolHandlers`; copy
  Cookie / Set-Cookie onto the auth jar. First cut also staged a local
  `clerk.browser.js` via `clerkJSUrl`.
- #552: drop the local `clerkJSUrl`. clerk-js then requested
  `framework`/`vendors`/`ui-common` chunks next to that file (404,
  `ChunkLoadError`). The proxy URL is enough once net.fetch works.

## Verification (live, this machine)

- Patched `/Applications/Allternit Desktop.app` asar (unsigned local
  install). Backup:
  `app.asar.bak-before-clerkjs-0915`.
- After a clean relaunch: `/health` 200 `{db,jwks,gizzi:true}`.
- `[Auth] Clerk session token received from renderer` twice.
- No further `failed_to_load_clerk_js`.
- vitest 159/159 on #550; follow-up is a deletion.

## Honest deferrals

- Next notarized CI Desktop release still needs to ship this asar; the
  running app was patched locally.
- ACU/uvicorn still missing on this host; mesh 502s unchanged.
