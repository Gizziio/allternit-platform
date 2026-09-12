# 2026-09-12 — Fabric Transport: hosted web-proxy, PWA brand assets, code-mode UX

- **Session:** ao (Kimi Code), worktree `fabric-aci-fixes-0911`
- **PRs:** #402 (`85d95982f`, merged), #403 (`8b822baf9`, merged)
- **Deployed:** fabrictransport.allternit.com PWA SW **v39** (wrangler pages deploy from the worktree at merged main, commit-hash `85d95982f`); zone worker `allternit-fabrictransport-api` version `4b3859be` (wrangler deploy from the worktree)

## What was done

1. **ACI "Unauthorized" loading websites (root cause fixed).** The browser capsule iframes a relative `/api/web-proxy?url=...` (`getWebProxyUrl` in `src/lib/platform.ts`). On the hosted PWA, two broken paths existed: the static Pages host has no proxy (SPA fallback → app auth error in the iframe), and `api.allternit.com`'s proxy is behind the bearer-only cloud-api, which iframe subresource requests cannot reach (no `Authorization` header possible). First attempt (#402) shipped the proxy as a Cloudflare **Pages Function** — verified live that it was unreachable: the zone worker `allternit-fabrictransport-api` (`infrastructure/fabrictransport-api-proxy`, route `fabrictransport.allternit.com/api/*`) answers before Pages Functions and kept returning the cloud-api 401. Final fix (#403): serve `/api/web-proxy` **in the zone worker**, a port of the public `cmd/allternit-api/src/web_proxy_routes.rs` — no auth by design (parity), http/https only, private/loopback/link-local hosts blocked, upstream HTML rewritten (iframe/frame/form/a proxified) with the injected `allternit-navigate` postMessage bridge. The Pages Function copy stays for hosts without the zone worker (`surfaces/ai.allternit.com/fabric-session-pwa-functions/api/web-proxy.js`); keep the two in parity.

2. **Missing Allternit logos in ACI.** `public/brand` (matrix logo used by `BrowserChatPane` etc.) was never copied into the PWA deploy output. `prepare-fabric-session-pwa.mjs` now copies `brand/` into the output and passes `/brand/*` through `_redirects`. (The `/api/web-proxy*` `_headers` override added in #402 is inert on fabrictransport — the zone worker bypasses Pages `_headers` — but harmless and needed if the Pages Function ever serves the path on another host.)

3. **SW cache v38 → v39** (`check-sw-cache-bump` gate).

4. **Code-mode UX.** Replaced the confusing Terminal/Sessions/Chat 3-tab pill with a single **Chat ↔ Terminal** toggle. Default view = the regular session conversation (looks like a session, per Eoj). Terminal = the Termius-style multi-session terminal (`fabric-terminals:${runtimeId}`), now also reachable session-free from a real **code-mode home screen** (Code greeting + Start session / Terminal actions; `FabricCodeDrive`'s `session` prop became optional when a `terminalSessionId` override is set).

## Verification

- `pnpm --filter @allternit/ai typecheck` ✅ (after rebase onto current main too)
- `vitest run src/components/dispatch` — 12 passed ✅
- Vite fabric-session build + `prepare-fabric-session-pwa.mjs` ✅ — output contains `brand/matrix/matrix-logo.svg`, `functions/api/web-proxy.js`, `/api/web-proxy*` `_headers` override, SW v39
- Live after deploy: `GET /api/web-proxy?url=https://example.com` → 200 with injected proxy script; `192.168.1.1` / `localhost:8013` → 403; missing `?url=` → 400; `/api/v1/me` still 401 without bearer (forward/auth intact); `/brand/matrix/matrix-logo.svg` → 200; SW live = v39

## Honest deferrals

- **Bots-on-node architecture:** agreed with Eoj that bots run on the platform (desktop) backend; a node without the desktop backend registered has no platform runtime to host bot sessions — no code change this pass. If bare-node bot sessions are wanted later, that is a platform-runtime-on-node project, not a rail tweak.
- **ai.allternit.com hosted surface** has the same relative web-proxy gap (separate Vercel surface, no zone worker) — out of scope.
- **Desktop app binary rebuild** not done (nothing in this session is bundled by the desktop app; offer stands if Eoj wants a fresh preview build anyway).
- iframe-level framing of the proxied page could not be exercised headlessly; verified at the HTTP level. If the capsule still misbehaves, next suspects are the capsule's `allternit-navigate` message listener and the iframe sandbox attrs.
