# Deployment Readiness Audit — ai.allternit.com (web) + allternit-desktop

> **Audit date:** 2026-09-03 ~18:45–18:54 CDT
> **Audited HEAD:** `88baa91abdfdf5b0107c143b318883d6efb7b210` on `main`, working tree clean
> **Repo:** `/Users/joe/Desktop/allternit-workspace/allternit` (GitHub `Gizziio/allternit-platform`)
> **Method:** five independent investigation passes — (1) web architecture deep-read, (2) web build/test verification with real command runs, (3) web deployment/CI/CD audit, (4) agent-ledger trustworthiness audit, (5) desktop architecture+security audit, (6) desktop build verification with real command runs. Every claim below carries its evidence; Appendix A lists the exact commands to reproduce each finding.
> **Bottom line:** Web is **deployable tomorrow after ~2–4 hours of fixes**. Desktop is **not deployable**; same-day unsigned internal arm64 build is feasible after fixing committed merge damage. Live credentials are committed in git and need same-day rotation.

---

## 1. Grades at a glance

| Area | Grade | One-line reason |
|---|---|---|
| Web — production build at HEAD | **F** | `vite build` deterministically fails: duplicate `submitMessage` in `ChatComposer.tsx` (hidden from tsc by `@ts-nocheck`) |
| Web — CI/CD pipeline | **F** | Last two `deploy-cloudflare-pages.yml` runs failed today at `pnpm install --frozen-lockfile` (lockfile/override mismatch); HEAD still broken |
| Web — live runtime / infra | **B+** | Cloudflare Pages serving (HTTP 200 verified), Clerk proxy Worker healthy, DNS + `_headers`/`_redirects` correct |
| Web — tests | **C** | 1157/1174 vitest pass; 3 failures; no lint script; `guard:no-drift` failing |
| Web — docs accuracy | **F** | `DEPLOYMENT.md` describes a Next.js/Vercel app that no longer exists |
| Web — hygiene/security | **D** | Plaintext password + TOTP seed committed; fake knip reports; live Clerk key committed |
| Desktop — compiles at HEAD | **F** | Merge damage in `unified-main.ts` (9 TS errors) + duplicate preload keys (2 errors); stale `dist/` still launches, masking it |
| Desktop — tests | **A−** | 94/94 vitest pass; real e2e specs exist |
| Desktop — security posture | **B+** | Uniform sandbox hardening, safeStorage OAuth vault, sha256-pinned driver; but unvalidated `shell:open-external`, token-injecting CORS-* protocol, no `will-navigate` guard |
| Desktop — packaging pipeline | **D** | Cannot run from clean checkout; cross-arch targets embed single-arch binaries; empty checksums for 4/5 platforms in download manifest |
| Desktop — existing artifact | **F** | `release/mac-arm64/Allternit Desktop.app` is not an app: no Info.plist, no executable, no asar |
| Desktop — docs accuracy | **F** | README/ARCHITECTURE describe a "~50 MB dumb client"; the code builds a 600 MB+ fat client with 5 bundled services |
| Desktop — auto-update | **D** | Unsigned build cannot self-update (Squirrel.Mac requires signing); no published releases exist |
| Agent-ledger trustworthiness | **B** | Every spot-checked attestation held up; but merge commits swept scratch + credentials into `main` ungated |

---

## 2. Web surface — what the app actually is

**Claim:** `surfaces/ai.allternit.com` is **not a Next.js app anymore**, despite `next.config.mjs`, `next-env.d.ts`, a stale `.next/` dir (Aug 6), and `DEPLOYMENT.md` all saying otherwise.

**Evidence:**
- `surfaces/ai.allternit.com/package.json` — `"build": "vite build"`, dev server `vite --port 3013`. `next` is not installed anywhere in `node_modules`.
- No `src/app` or `pages/` directory exists. `src/main.tsx` boots a plain React SPA with `react-router-dom` 7.
- `vite.config.ts:141` documents the migration: "This surface was migrated from Next.js and intentionally keeps its NEXT_PUBLIC_* deployment contract."

**Stack (verified from installed deps):** React 18.3.1 (pinned via Vite aliases to avoid workspace React 19 duplicates), Vite 8.0.12 (rolldown), TypeScript 5.9.3, Tailwind 3.4.19, react-router-dom 7, zustand 4.5.7 + Redux Toolkit, TanStack Query, antd 5.29, Radix, Vercel AI SDK v6 (`ai` 6.0.73) with ~40 provider packages, Clerk (`@clerk/clerk-react` 5.61) via `src/lib/platform-auth-client.tsx` with a `__clerk` proxy and `ALLTERNIT_SELF_HOSTED` desktop bypass.

**Functionality:** a Claude-Desktop-style multi-mode AI workbench shell — Chat / Code / Cowork session modes (`SESSION_ARCHITECTURE.md`), agent hub/studio, AI design studio, built-in browser, office document apps (docs/sheets/slides/pdf), bots, swarm, marketplace, ACI mini-apps. Routing in `src/routes.tsx` with 44 lazy pages in `src/pages/`; `src/nav/nav.types.ts` defines ~70 `ViewType`s; `src/shell/ViewRegistry.tsx` registers ~100 lazy views.

**Scale:** `src/` = 1,863 non-test ts/tsx files, ~562k LOC (views 189k, lib 114k, components 110k, generated/prisma 66k). 147 unit test files; 44 Playwright specs in `tests/`.

**Backend coupling:** pure frontend. `/api` traffic is proxied in dev by `vite.config.ts:218-274` to the Rust backend (`allternit-api` :8013, gizzi runtime :4096). There are no API routes in this surface.

---

## 3. Web surface — build & verification reality (commands actually run)

### 3.1 Production build — FAILS

Command: `pnpm run build` (in `surfaces/ai.allternit.com`). Result: exit 1 after transforming 25,015 modules (~4–6 s). Reproduced twice; deterministic.

```
[PARSE_ERROR] Error: Identifier `submitMessage` has already been declared
    src/views/chat/ChatComposer.tsx — `const submitMessage = useCallback(...)` declared at :1028 and again at :1197
```

- Both declarations sit at the same function-body scope of the file's only component (`ChatComposer`, lines 329–2762). No intervening scope boundary.
- **Why tsc is green:** `src/views/chat/ChatComposer.tsx:1` is `// @ts-nocheck`. It is one of **84 source files under `src/` carrying `@ts-nocheck`** — so the passing typecheck does not parse them; rolldown does, and dies.
- Blame: commit `020203a9e` "feat(desktop-cloud): production-hardened Linux Desktop Cloud MVP" (Aug 25), confirmed an ancestor of `main`. The duplicate is committed, not a dirty-tree artifact. Both `useCallback` blocks implement the same "core send path" — this looks like a bad-merge double-insert; diff them and delete one.
- Other build noise (non-fatal): dozens of rolldown "Module X has been externalized for browser compatibility" warnings from `undici@5.29.0`; Tailwind warnings about `duration-[0.18s]`-style arbitrary values.

### 3.2 Typecheck — passes, misleadingly

- `pnpm typecheck` (default `tsconfig.json`, `tsc --noEmit`): **PASS, 0 errors** — confirmed with a fresh non-incremental run (`tsc --noEmit --incremental false`), so it is not stale-cache luck.
- `pnpm typecheck:fast` (`tsconfig.typecheck.json`): **FAIL, 14 errors — every one in sibling workspace packages**, pulled in via tsconfig `paths` mappings to source, none in this surface:
  - `packages/@allternit/office-pdf-app/src/renderer/ai/AiPanel.tsx:9-11` — TS2307 missing `send-enter-on.png`, `send-enter-off.png`, `send-stop.png`
  - `office-pdf-app/src/renderer/App.tsx:7` — TS2307 `pdfjs-dist/legacy/build/pdf.worker.min.mjs?url`
  - `office-sheets-app/src/renderer/ai/AiChatPanel.tsx:10-13` — TS2307 ×4 missing .png assets
  - `office-slides-app/src/main/shaped-metrics.ts:15-16` — TS7016/TS2307 `harfbuzzjs/hb.js`, `harfbuzzjs/hb.wasm?url`
  - `office-slides-app/src/renderer/ai/AiPanel.tsx:27-30` — TS2307 ×4 missing .png assets
- **HANDOFF.md claim check:** it claims the only remaining TS errors are pre-existing ones in `DocumentEditorPack.tsx` / `SheetEditorPack.tsx`. **Not reproducible today** — both packs exist at `src/views/documents/packs/` and type-check clean under the default program. The claim was plausible when written; it is now outdated in the "better than claimed" direction.
- **Caveat that matters for deploy:** the green typecheck is not trustworthy evidence of health because of the 84 `@ts-nocheck` files. The build is the only gate that parses them.

### 3.3 Lint

**There is no lint script.** Closest guard scripts:
- `guard:ai-elements`: PASS (no legacy ai-elements imports).
- `guard:no-drift`: **FAIL** — `'as any' found in rust-stream-adapter.ts` at `src/lib/ai/rust-stream-adapter.ts:769,799,863,1082,1618`.

### 3.4 Unit tests — 3 failures

Command: `pnpm test` (vitest). 147 files: **144 passed, 2 failed, 1 skipped**. 1174 tests: **1157 passed, 3 failed, 14 skipped** (37.8 s).

- `src/lib/bots/vm-operator.test.ts` × 2 — `createSandbox` returns `ok: false`, expected `true` (fetch-mock/env-dependent).
- `src/components/settings/ComputeBillingPanel.test.tsx` — timed out at 5000 ms.
- Playwright specs under `tests/` correctly excluded from vitest; not run.

### 3.5 node_modules state

Healthy. Root install present (~8.6 G), `.modules.yaml` from Sep 2 13:59, **0 broken symlinks** at repo root and surface. Node v26.5.0, pnpm 10.28.0. Package manager is **pnpm** (root `packageManager: pnpm@10.28.0`; `pnpm-lock.yaml` updated Sep 3 12:00). A stale root `bun.lock` (Aug 26) exists but is not what the surface uses.

---

## 4. Web surface — deployment & CI/CD

### 4.1 The real deploy target is Cloudflare Pages, not Vercel

- **Authoritative:** `.github/workflows/deploy-cloudflare-pages.yml` — trigger: push to `main` touching `surfaces/ai.allternit.com/**`; build: `pnpm --filter "@allternit/ai..." build` (Node 20, `pnpm install --frozen-lockfile --ignore-scripts`, `pnpm prisma generate` first); deploy: `wrangler pages deploy surfaces/ai.allternit.com/dist --project-name=ai-allternit --branch=main`.
- **Manual path:** `scripts/build-cloudflare-ai.sh` — stashes `src/app/api`, builds with `CLOUDFLARE_PAGES=1`, loads Clerk key from `.env.production`, zips to `~/Desktop/allternit-websites/projects/ai.allternit.com/deploy.zip`.
- **Config conflict:** root `wrangler.toml` has `name = "ai-allternit"`, `pages_build_output_dir = "surfaces/ai.allternit.com/dist"` — correct. But `surfaces/ai.allternit.com/wrangler.toml` has `name = "allternit-platform"`, output `out`, vars pointing at `platform.allternit.com` — **stale leftover; wrong project name and wrong output dir. Delete it.**
- `DEPLOYMENT.md` (2026-07-22) is fully obsolete: describes Next.js 15.5.14, `pnpm next build`, Vercel dashboard fixes, `.next` output. None of it applies.

### 4.2 CI is broken at HEAD — hard blocker

`gh run list` for `deploy-cloudflare-pages.yml`:
- ✅ Success today 15:10Z (BYOK inference deploy went live).
- ❌ Failure today 19:09Z and ❌ failure today 19:27Z — both fail at `pnpm install --frozen-lockfile`:

```
ERR_PNPM_LOCKFILE_CONFIG_MISMATCH — The current "overrides" configuration
doesn't match the value found in the lockfile
```

Root cause: `pnpm-workspace.yaml:83` adds `better-sqlite3: 13.0.3` to `overrides`, but `pnpm-lock.yaml` at HEAD does not contain it (verified via `git show HEAD:pnpm-lock.yaml`). **HEAD is broken for CI. Any push/deploy fails at install until the lockfile is regenerated and committed.**

### 4.3 Build output freshness — STALE

- `dist/` was built **Sep 2 21:21** and contains Cloudflare Pages `_headers`/`_redirects`/`_routes.json`.
- `src/`, `vite.config.ts`, and `public/` have **11 commits since then** (through HEAD Sep 3 17:18 CDT: cloud API token auth, billing guards, merge fixes, typography). **Rebuild `dist/` from HEAD before any deploy.**
- `out/` (Aug 26, only `images/`) and `.next/` (Aug 6) are dead Next.js-era remnants.
- Active-development signals: 4.5 MB `.tsbuildinfo` regenerated Sep 3; `.env.production` edited Sep 3 12:05.

### 4.4 Environment variables

Required (from `.env.example` and `src/lib/env.ts`): `DATABASE_URL`, `ENCRYPTION_KEY`; Clerk set `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` (+ server-side `CLERK_SECRET_KEY`, `CLERK_JWKS_URL=https://clerk.allternit.com/.well-known/jwks.json`, `CLERK_ISSUER`, `CLERK_WEBHOOK_SECRET`); service URLs default to `https://api.allternit.com` in CI.

- `src/lib/env.ts:89` reads `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` (Vite `envPrefix: ['VITE_', 'NEXT_PUBLIC_']`); CI passes exactly that. Consistent.
- **`surfaces/ai.allternit.com/.env.production` is committed to git and contains a live `pk_live_…` Clerk key.** It is a publishable (non-secret) key, but a committed live key warrants a rotation policy check. The file also has duplicate Clerk URL vars where the later block wins — works, but messy.
- CI secrets needed: `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`, `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `ENCRYPTION_KEY`, `VITE_REMOTE_CONTROL_PUSH_URL`. Existence not verifiable from the repo; the 15:10Z success implies they are set.

### 4.5 Live site — verified up

- `curl -sI https://ai.allternit.com` → HTTP/2 200, `server: cloudflare`, security headers present (`x-content-type-options: nosniff`, `referrer-policy`).
- Body is the Vite SPA shell (`<title>Allternit Platform</title>`, manifest + theme-color PWA meta). JS-rendered, so HTML-only fetchers see a blank shell.
- `curl https://ai.allternit.com/__clerk` → 200 (Clerk proxy Worker live; routes in `infrastructure/clerk-proxy/wrangler.toml`, zone `5ebf34…`).
- Custom-domain binding on Pages couldn't be verified locally, but the 15:10Z deploy + `build-cloudflare-ai.sh` referencing "Custom domain: ai.allternit.com" indicate it is attached.

### 4.6 Post-deploy verification prescribed by TESTING.md (Aug 31)

- `node surfaces/ai.allternit.com/scripts/clerk-e2e-verify.mjs` (Clerk smoke; `CLERK_TARGET_ORIGIN=https://platform.allternit.com`, secondary `https://ai.allternit.com`).
- `node surfaces/ai.allternit.com/scripts/clerk-stress-test-v4.mjs` (sign-in/out, cross-subdomain sessions, OAuth, token refresh).
- Both scripts present and runnable.

---

## 5. Desktop app — what it actually is

**Package:** `surfaces/allternit-desktop`. Entry `package.json` `"main": "dist/main/unified-main.js"` (ESM, `"type": "module"`), compiled from `src/main/unified-main.ts` — **a single 3,621-line / 136 KB file** containing window management, IPC wiring, boot orchestration, and inline HTML. 46 non-test main-process modules + 4 workers; preload `src/preload/index.ts` (806 lines) exposes ~158 channels on `window.allternit.*`; **161 `ipcMain.handle` registrations**.

**Boot modes** (`unified-main.ts:706-739`): `bundled` (default) boots a full local stack — gizzi AI runtime (:4096, `gizzi-manager.ts`) → connector sidecar (:8014) → office-engine sidecar (:8099) → Rust API (:8013, `backend-manager.ts`) → main window; `remote` (user VPS); `development`.

**Windows:** main shell (:481), mini quick-chat, **HUD** (frameless transparent always-on-top panel, global hotkey ⌘⇧H, :2182), annotation overlay (:2444), remote-control (:2556), design (:2129), office editors per Office target (:2606), detached code sessions (:2715). All load `${activePlatformUrl}/…` routes.

**Serving the platform surface:** **the main window `loadURL`s a remote URL** (`https://platform.allternit.com` / `https://ai.allternit.com` family; `unified-main.ts:234,879`). A local static export (`resources/platform`) is preferred only if it contains `index.html` (`resolveLocalPlatformStaticPath`, :116-141). **Currently `resources/platform` has no `index.html` — only `images/templates/` — so every build today loads the remote site.**

**Custom protocols** (:1704-1904): `allternit-api://` proxies any path to the loopback Rust API **with the user's Clerk access token injected in main**; `allternit-gizzi://` proxies to the gizzi runtime injecting its auth header. `webRequest.onBeforeRequest` (:514) rewrites `${platformOrigin}/api/*` → `allternit-api://`.

---

## 6. Desktop — build & artifact verification (commands actually run)

### 6.1 HEAD does not compile

`pnpm run typecheck` (desktop package) → exit 2. **All 9 main errors are merge damage in `unified-main.ts`** from merge commit `ea89a5fdb` ("Merge branch 'session/desktop-cloud-mvp'"):

```
src/main/unified-main.ts(210,5): TS2451 Cannot redeclare block-scoped variable 'hudWindow'
src/main/unified-main.ts(212,5): TS2451 'remoteControlWindow'
src/main/unified-main.ts(215,5): TS2451 'remoteControlWindow'
src/main/unified-main.ts(232,5): TS2451 'hudWindow'
src/main/unified-main.ts(732,14): TS2304 Cannot find name 'effectiveMode'
src/main/unified-main.ts(1436,10): TS2393 Duplicate function implementation
src/main/unified-main.ts(1523,10): TS2393 Duplicate function implementation
src/main/unified-main.ts(2182,10): TS2393 Duplicate function implementation
src/main/unified-main.ts(2287,10): TS2393 Duplicate function implementation
```

Preload tsconfig (run separately since main short-circuits): 2 errors in `src/preload/index.ts:399-400` — TS1117 duplicate object-literal keys.

**The agent-ledger summary `2026-09-03-1400-desktop-cloud-mvp-kimi-merge.md` claims desktop typecheck was "clean except pre-existing errors." That is inaccurate** — these errors are at HEAD and unaccounted for in the ledger.

### 6.2 dist/ is stale but launchable — which is why nobody noticed

- `dist/main/unified-main.js` exists (133 KB, built **Aug 30 09:23**); newest dist file anywhere is Aug 30.
- `src/main/unified-main.ts` last changed **Sep 3 12:12** (committed); `permission-guide.ts`, `config.ts`, `voice-manager.ts`, `backend-manager.ts` also touched today.
- `node --input-type=module --check < dist/main/unified-main.js` → **exit 0, valid ESM**. So `pnpm run dev`/`start` launches the stale pre-breakage build while `tsc` cannot rebuild. Source and artifact have silently diverged.

### 6.3 Tests — pass

`pnpm run test` (vitest 1.6.1, 11 files under `src/main/**/*.test.ts`): **94/94 passed, 0 failed** in 659 ms. Suites cover mini-app sandbox, OAuth broker, policy, release installer, office addin/engine/programs — genuinely thoughtful. 4 Playwright specs in `tests/` (`hud-electron-smoke`, `docs-window`, `office-windows`, `api-capture-headless`) + HUD smoke config with env bypass. `test:e2e` wired. Nothing requiring a display was run.

### 6.4 Electron toolchain — intact

Installed `node_modules/electron` = **41.10.3** (satisfies `^41.10.3`, single copy at root `.pnpm/electron@41.10.3`); `node_modules/electron/dist/Electron.app` present — binary downloaded, `electron .` can launch.

### 6.5 resources/ payloads — mostly missing/incomplete

| Payload | State | Notes |
|---|---|---|
| `resources/platform/` | **INCOMPLETE** | Only `images/` (132 K, Aug 26). No `index.html`. Source `surfaces/ai.allternit.com/dist` exists, built Sep 2 21:21 — newer than what's staged. |
| `resources/bin/` | **MISSING** | `prepare-platform-static.cjs:72-102` hard-fails without `gizzi-code` + `allternit-voice-service`; produced only by `scripts/build-desktop.sh` (needs bun, cargo, python3.11+pyinstaller, Go, network). |
| `resources/lima/` | **MISSING** | Lima 2.1.2 Darwin-only tarball never downloaded. Breaks `build:electron` on Linux/Windows. |
| `resources/computer-use/` | **PARTIAL** | `VERSION.json` (cua-driver 0.20.1-nightly.20260818), README, LICENSE — binary absent. |
| `resources/office-engine/` | Present | 31 MB; dist/ Aug 7, node_modules/ Aug 13. Stale-ish; native `canvas` binding matches only the build host. |
| `resources/vm/` | Present | README + darwin/linux/win32 dirs, Aug 17. |
| mesh-node / api-binary | **MISSING** | No dirs on disk; scripts exist. |
| `native/dictation-helper/` | **SOURCE ONLY** | `DictationHelper.swift` + README; no compiled binary (extraResources filter expects it). |

### 6.6 The only release artifact is a hollow non-app

```
$ codesign -dv release/mac-arm64/Allternit\ Desktop.app
Allternit Desktop.app: bundle format unrecognized, invalid, or unsuitable
```

The bundle (608 MB, Aug 26) contains **only** `Contents/Resources/{connector-sidecar 576 MB, office-engine 31 MB, platform 132 KB}`. No `Contents/MacOS/`, no `Info.plist`, no `app.asar` — an aborted `electron-builder --dir` run that copied extraResources and nothing else. Not launchable, not signable. **Delete it.** No dmg/zip/`.yml` update metadata anywhere in `release/`.

### 6.7 Packaging pipeline — cannot run from a clean checkout

`build:electron` chain (`package.json:27`): `config:company` → `prepare:platform-static` → `prepare:office-addins` → `prepare:cua-driver` → `download:lima` → `prepare:mesh-node` → `prepare:office-engine` → `prepare:api-binary` → `build` → `verify:packaged-resources` → `electron-builder --mac`.

| Step | Reality |
|---|---|
| `prepare:platform-static` | **Fails fast on a clean checkout** unless `resources/bin/{gizzi-code,allternit-voice-service,allternit-api}` already exist (`prepare-platform-static.cjs:72-102`). Builds ai.allternit.com with `NEXT_PUBLIC_ALLTERNIT_DESKTOP_AUTH=1`. |
| `prepare:cua-driver` | Downloads pinned trycua/cua nightly darwin tarball, **sha256-verified** (`prepare-cua-driver.cjs:10`). Nightly URL can rot; macOS-only. Binary currently absent. |
| `download:lima` | Lima **2.1.2 Darwin-only** from GitHub. macOS-only; breaks the chain on Linux/Windows. Never run here. |
| `prepare:mesh-node` | vendor copy (`cmd/gizzi-code/vendor/mesh-node/`) → `go build` → GitHub release download from `Gizziio/allternit-platform`. Needs Go or network; absent. |
| `prepare:office-engine` | tsc+esbuild bundle of `services/office-engine` + full `node_modules` copy including host-compiled `canvas` → **host-machine-specific binary**. |
| `prepare:api-binary` | Copies `target/{release,debug}/allternit-api` else downloads from manifest URL. **`require('tsx')` is not a desktop dependency** — resolves only via hoisted root `node_modules`. Manifest checksums are **empty strings for 4 of 5 platforms** (`manifest.ts:32-38`) → unverified downloads. |
| `verify:packaged-resources` | Fails unless `resources/bin/{allternit-api,gizzi-code,allternit-voice-service}` + `resources/platform/index.html` exist. **Would fail right now on all four.** |
| `electron-builder --mac` | dmg+zip × arm64/x64. **Cross-arch lie:** staged binaries (lima/lume/cua-driver/mesh-node) are single-arch but both arches are targeted — an x64 dmg would embed arm64 binaries. Unsigned (`identity: null`), `gatekeeperAssess: false`. Win NSIS/zip + Linux AppImage/deb configs exist but are untested. |

---

## 7. Desktop — security findings (ranked)

**Baseline (uniformly good):** every `BrowserWindow` and the `will-attach-webview` hook (`unified-main.ts:654-673`) sets `contextIsolation: true, nodeIntegration: false, sandbox: true, webSecurity: true, allowRunningInsecureContent: false`; webview preloads are stripped; no `webSecurity: false` anywhere. OAuth tokens live in main via `safeStorage` (`mini-app-oauth-broker.ts`) and never cross IPC. The mini-app sandbox is genuinely careful (sandbox-exec profile validation with code-signature check at `mini-app-sandbox.ts:253-275`, loopback-only network, Windows AppContainer helper with Authenticode check). No secrets hardcoded in main-process code; Clerk key comes from `resources/company.json` (publishable).

| # | Severity | Finding |
|---|---|---|
| 1 | **High** | `shell:open-external` IPC with no validation (`unified-main.ts:2118-2120`): any renderer code (or XSS in the loaded remote origin) can open any URL (`file://`, custom schemes) through the OS handler. Same pattern in secondary windows' `setWindowOpenHandler` — :595 origin-checks, but :2148, :2255, :2496, :2575, :2625, :2746 do **not**. |
| 2 | **High** | Custom-protocol auth injection with `Access-Control-Allow-Origin: *` (`unified-main.ts:1792-1864`): `allternit-api://` injects the user's bearer token into any request; any content that can reach the privileged scheme (webview guests share the session) can hit the loopback API authenticated. |
| 3 | Medium | No `will-navigate` / `setPermissionRequestHandler` handlers anywhere — top-level navigation and permission requests (media, geolocation) have no allowlist. |
| 4 | Medium | Unauthenticated localhost TCP bridge (`startExtensionBridge`, port 3011, :1228): any local process can connect and inject messages into the renderer (`extension:message`) or answer pending relays. |
| 5 | Medium | `hyperframes:render` executes `npx hyperframes` (:3463) on renderer-supplied HTML written to /tmp — supply-chain/arbitrary-exec surface, no path pinning. |
| 6 | Medium | `miniApps:installRelease` takes a renderer-supplied `registryUrl` (:3548) → main downloads and installs code (partially mitigated by the sandbox above). |
| 7 | Low | Dev bootstrap token: `isDev` injects hardcoded `desktop-dev-bootstrap` identity (:1829); dev-session credentials written plaintext to `~/.allternit/gizzi-dev-session.json` (:931, cleaned on quit). |
| 8 | Low | Generic store/state IPC (`store:get/set` :2085, `state:get/set/patch` :3252) lets the renderer read/write arbitrary persisted keys. |
| 9 | Design | **Auto-update cannot function unsigned** (`update-electron-app` polls GitHub `allternit/desktop` hourly, :151): Squirrel.Mac requires a valid Apple-signed app to update at all. Windows side has `verifyUpdateCodeSignature: false` (`package.json:356`). No published releases exist at `allternit/desktop`. |

**Broken channel:** `auth:oauth-start` is invoked from preload (`src/preload/auth.ts:23`) but has **no `ipcMain.handle` anywhere** — the OAuth popup flow from the auth renderer is broken. ~9 main-side handlers aren't in the main preload (gizzi-daemon:*, app:quit, mini-window:*, auth:start-google-login) — some used by the startup window, some genuinely unexposed.

---

## 8. Desktop — docs vs reality

| Doc | Claims | Reality |
|---|---|---|
| `README.md:11`, `ARCHITECTURE.md` | "~50 MB dumb client" connecting to a user-hosted backend; "No Bundled Services" key decision; file tree with `src/main/index.ts` | Code builds a **600 MB+ fat client** bundling Rust API, gizzi-code, voice service, office engine, 576 MB connector-sidecar, Lima/Lume VM tooling, computer-use driver. `src/main/index.ts` doesn't exist. |
| `BUILD.md` | Next.js standalone server copied to `resources/platform-server/`; cloudflared into `resources/bin/`; "upload to install.gizziio.com" | Platform is now a Vite static export (`scripts/build-desktop.sh:42-46`); no `platform-server` path consumed anywhere; install.gizziio.com is another product. |
| `AUDIT.md` (2026-07-03) | typecheck PASS, ~2,440 LOC | Today typecheck FAILS (11 errors); `unified-main.ts` is 3,621 LOC. |
| `package.json` repository/publish/auto-update | `github.com/allternit/desktop`; backend downloads from `github.com/allternit/platform/releases/v1.0.0` | Release artifacts/checksums almost certainly don't exist publicly. |
| `docs/SIGNING.md` | Documents the notarize hook | Consistent: `afterSign: scripts/notarize.cjs` runs only when `APPLE_ID*` env vars exist; `identity: null`, `notarize: false` — unsigned by default. |

**Dead code:** `hud-cursor.ts`, `hud-game-overlay.ts`, `hud-geometry.ts`, `hud-snap.ts`, `windows-terminal-integration.ts` — zero imports. (`hyprland.ts`, `window-below.ts` are wired.) 2 TODO/FIXME in non-test source — low density.

---

## 9. Hygiene / security issues affecting both surfaces

1. 🔴 **Plaintext credentials committed to git:** `surfaces/ai.allternit.com/capture-e2e-auth.mjs:3-6` contains a **plaintext ProtonMail password and TOTP seed** (Playwright sign-in capture script, committed via desktop-cloud session commits). **Rotate both credentials and scrub from history.** Sibling scratch: `capture-signin-debug.mjs`, `capture-signin-state.mjs`, `capture-e2e-auth.mjs`, `capture-final-verify.mjs`.
2. 🔴 **CI broken at HEAD** (web): lockfile/override mismatch (`better-sqlite3: 13.0.3` in `pnpm-workspace.yaml:83` not in `pnpm-lock.yaml`). Fix: `pnpm install --lockfile-only` at repo root, commit, push.
3. 🔴 **Web production build broken at HEAD** (web): duplicate `submitMessage` in `src/views/chat/ChatComposer.tsx:1028,1197` under `@ts-nocheck`.
4. 🔴 **Desktop main process broken at HEAD** (desktop): 9 TS errors in `src/main/unified-main.ts` + 2 in `src/preload/index.ts:399-400` from merge `ea89a5fdb`.
5. **Fake reports committed:** all four `knip-report*.json` files (web surface root) are 71 bytes containing the literal npx prompt `Need to install the following packages:\nknip@6.13.1\nOk to proceed? (y)` — knip never ran. Committed Aug 17. No real dead-code analysis exists. Do not trust any dead-code claims based on them.
6. **Live Clerk key committed** in `surfaces/ai.allternit.com/.env.production` (`pk_live_…`, `git ls-files` confirms tracked). Publishable, not secret — but policy-worthy.
7. **Committed scratch pollution** (web surface root, all tracked, tree clean): `verify_stream.ts`, `parse_doctor.py`, `react-doctor-full.txt` (1198 a11y issues dump), `desktop-cloud-demo.html`, `remote-control.html` + dangling `vite.remote-control.config.ts` (no package.json script references it), `prototypes/`, `src/nav/nav.policy.ts.new` (17 bytes), `src/FOLDER_ANALYSIS.md` (Aug 17 analysis note), stale `.next/`, `next.config.mjs`, `next-env.d.ts`. Three tsconfigs (`tsconfig.json` canonical, `tsconfig.typecheck.json` narrowed fast variant, `tsconfig.v2.json` — a 17-line scratch experiment still wired to `typecheck:v2`).
8. **Stale surface `wrangler.toml`** (web): `allternit-platform` / `out` — wrong project name + wrong output dir vs root config (`ai-allternit` / `dist`).
9. **Stale surface `package.json` fields** (web): `"main": "electron/main.cjs"` points to a nonexistent file; Tauri deps (`@tauri-apps/api` 2.10) present with **no `src-tauri`** — dead leftovers from abandoned approaches.
10. **Hollow desktop artifact** in `release/mac-arm64/` (608 MB non-app) — delete.

---

## 10. Agent-work audit (claim vs reality)

Ledger index `agent-ledger/LEDGER.md` and newest summaries reviewed. **Verdict: the ledger is trustworthy in what it attests; the surfaces are not kept clean.** Prior agents verified their code honestly, but nothing gated what got committed — desktop-cloud merges swept session scratch and credentials into `main` wholesale.

| Session (from ledger) | Claim | Spot-check result |
|---|---|---|
| `ba9de8f8` cloud backend hardening (09-03 17:16) | Auth unification, scoped `alt_` tokens, 5 billing guards, pool broker, BYOK, Tailscale CI/CD deployed; "168/168 release tests, soak 12/12, sweep 5/5, scope check 8/8 all green" | Not independently re-verified (backend outside this audit's scope); claims are specific and consistent with `.steering/checkpoint.md`. |
| desktop-cloud-mvp merge (09-03 14:00) | Big merge; `tsc --noEmit` "clean except pre-existing errors" | ❌ **Inaccurate.** Merge `ea89a5fdb` introduced the 11 desktop typecheck errors now at HEAD. The web-side merge (`020203a9e`, Aug 25) introduced the `ChatComposer.tsx` duplicate that fails production builds. |
| cacb228c / 72ac1efa / omb / model-picker merges (09-03 14:00) | Merged ✅ with attestations | Merge attestations flagged `env.ts:88` + DispatchView missing components as pre-existing breakage; commit `c1875af69` (09-03 14:26) repaired exactly that. Claims were real at the time; now fixed. Full surface `tsc --noEmit` exits 0 today. |
| Worktree cleanup ×4 (09-03 11:41) | 4 worktrees removed, WIP on pushed `wip/*` branches | ✅ **Verified.** All four cited SHAs (`e310b5689`, `c55c15758`, `ec0b7b500`, `3dd921673`) exist on origin exactly as claimed. |
| Typography fix (09-03 08:16) | Font CI exemption, hardcoded monospace replaced, "TYPOGRAPHY VALIDATION: PASS" | Plausible; not independently re-run. |
| HANDOFF.md (committed 2026-07-26 via `2bda61382`) | Recents rail + Agent Studio cleanup done; only pre-existing TS errors in DocumentEditorPack/SheetEditorPack | ✅ Work is real (`src/shell/ShellRail.tsx:1774` `RecentItemMenu`, used at :1360,:1560; `RecentsView.tsx` exists). ⚠️ But it's a **month-old handoff still sitting in the surface root**, and its error claim is stale — both packs type-check clean today. Written on a different machine (`/Users/macbook/…` paths). |

**Orphaned worktree:** `git worktree list` shows 2 worktrees. `allternit-session-os-console-20260902` on `session/os-console-20260902` — working tree clean, **1 commit ahead / 153 behind main**; tip `bc1397f14` ("AllternitOS Fabric console page") is **local-only: not pushed, not merged**. It touches `surfaces/platform.allternit.com` (not the ai surface) and adds a `package-lock.json` (3,334 lines) into a pnpm/bun workspace — a lockfile conflict waiting if merged naively.

**`.steering/checkpoint.md` last entry:** session `ba9de8f8` FINAL handoff (09-03); origin/main = `97ecec0bb` + one local attestation commit (`88baa91ab`, pushed). Owner actions pending: Tailscale `tag:ci` key, $10 Stripe purchase, DeepSeek/Kimi keys; goal milestones 5 and 8 unproven.

---

## 11. Fix checklists

### 11.1 Web — deploy tomorrow (in order)

1. Fix `src/views/chat/ChatComposer.tsx`: diff the two `submitMessage` useCallback blocks (:1028, :1197), delete one. ~15 min.
2. Repo root: `pnpm install --lockfile-only` → commit → push. Unblocks CI. (Hard blocker.)
3. Audit the other 83 `@ts-nocheck` files — the green typecheck is misleading; at minimum grep for duplicate-declaration smells. The build is the only real parse gate.
4. Rebuild `dist/` from HEAD (11 commits stale): `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=… CLOUDFLARE_PAGES=1 pnpm --filter @allternit/ai build`, or `scripts/build-cloudflare-ai.sh`.
5. Delete stale `surfaces/ai.allternit.com/wrangler.toml`.
6. **Rotate the ProtonMail password + TOTP seed committed in `capture-e2e-auth.mjs`; scrub from git history.** Also review the committed `pk_live_` Clerk key policy.
7. Post-deploy: run `scripts/clerk-e2e-verify.mjs` and `clerk-stress-test-v4.mjs` against production per `TESTING.md`.
8. Optional but recommended: rewrite/mark-superseded `DEPLOYMENT.md` (actively misleading); delete junk `knip-report*.json` and scratch files from the surface root; fix the 3 failing unit tests; decide what `guard:no-drift` enforcement means.

### 11.2 Desktop — same-day unsigned internal arm64 build

1. Fix merge damage in `src/main/unified-main.ts` (dedupe `hudWindow`/`remoteControlWindow` decls :210–232, define `effectiveMode` :732, remove 4 duplicate functions :1436/:1523/:2182/:2287) + duplicate preload keys `src/preload/index.ts:399-400`. ~1 hour. Then `pnpm run build` (tsc both configs) must pass.
2. **Decide the payload.** Full `scripts/build-desktop.sh` needs bun + cargo + Python/pyinstaller + Go + multiple network downloads. Cutting Lima, cua-driver, voice service, and mesh-node from v1 collapses the pipeline dramatically. If full stack is kept, run `scripts/build-desktop.sh` on the target Mac (long, scripted).
3. Stage the platform export: rebuild `ai.allternit.com/dist` (requires web item 1) into `resources/platform/` with `prepare-platform-static.cjs`.
4. Build arm64 only: `electron-builder --mac --arm64 -c.mac.identity=null` (unsigned is the configured default). Do not ship the x64 target — it would embed arm64 binaries.
5. Delete the hollow `release/mac-arm64` artifact before rebuilding.
6. Gate anything public on: Apple signing + notarization (creds absent; `scripts/notarize.cjs` hook ready), URL validation on `shell:open-external` + secondary-window `setWindowOpenHandler`, a `will-navigate` allowlist, and fixing the missing `auth:oauth-start` handler.

### 11.3 Not deployable tomorrow under any circumstances

- Desktop public distribution (signing/notarization + update story + security pass needed).
- Anything relying on `/api/design/connectors/*` and `/api/design/composio/*` (referenced by `src/lib/design/direct-connectors.ts`): the `DESIGN_MODE_APLUS_HANDOFF.md` (2026-05-09) says these are Next.js routes under `src/app/api/design/connectors/*` — **there is no `src/app` anywhere post-migration and no equivalent under `src/api/`**. Verify they exist on the backend (:8013) or those features 503 in production.

---

## Appendix A — corroboration commands

Run from `/Users/joe/Desktop/allternit-workspace/allternit` unless noted. HEAD under test: `88baa91ab`.

**Identity / stack**
- `grep '"build"' surfaces/ai.allternit.com/package.json` → `vite build`
- `ls surfaces/ai.allternit.com/node_modules/next` → does not exist
- `sed -n '141p' surfaces/ai.allternit.com/vite.config.ts` → Next→Vite migration note

**Web build failure**
- `cd surfaces/ai.allternit.com && pnpm run build` → PARSE_ERROR duplicate `submitMessage`
- `grep -rn "@ts-nocheck" src --include="*.ts*" -l | wc -l` → 84
- `git log --oneline -1 020203a9e` → desktop-cloud feat (Aug 25); `git merge-base --is-ancestor 020203a9e HEAD && echo ancestor`

**Web typecheck**
- `pnpm typecheck` → exit 0; `pnpm exec tsc --noEmit --incremental false` → exit 0
- `pnpm typecheck:fast` → 14 errors, all in `packages/@allternit/office-*` (TS2307 missing .png/.mjs assets, harfbuzzjs)

**Web tests / guards**
- `pnpm test` → 1157 passed / 3 failed / 14 skipped
- `pnpm guard:ai-elements` → pass; `pnpm guard:no-drift` → fail (`as any` ×5 in `rust-stream-adapter.ts`)

**CI**
- `gh run list --workflow=deploy-cloudflare-pages.yml --limit 5` → success 15:10Z, failures 19:09Z/19:27Z
- `grep -n "overrides" pnpm-workspace.yaml | head`; `git show HEAD:pnpm-lock.yaml | grep -c "better-sqlite3.*13.0.3"` → 0

**Live site**
- `curl -sI https://ai.allternit.com` → 200, cloudflare; `curl -s -o /dev/null -w "%{http_code}" https://ai.allternit.com/__clerk` → 200

**Deploy config**
- `cat wrangler.toml | head` (root: ai-allternit / dist) vs `cat surfaces/ai.allternit.com/wrangler.toml | head` (stale: allternit-platform / out)
- `cat .github/workflows/deploy-cloudflare-pages.yml`

**Env / credentials**
- `git ls-files surfaces/ai.allternit.com/.env.production` → tracked; contains `pk_live_…`
- `sed -n '1,10p' surfaces/ai.allternit.com/capture-e2e-auth.mjs` → plaintext password + TOTP seed
- `head -c 100 surfaces/ai.allternit.com/knip-report.json` → npx install prompt

**Desktop compile failure**
- `cd surfaces/allternit-desktop && pnpm run typecheck` → 9 errors in `src/main/unified-main.ts` + 2 in `src/preload/index.ts:399-400`
- `git log --oneline -3 -- src/main/unified-main.ts`; `git show --stat ea89a5fdb | head`

**Desktop dist divergence**
- `ls -la dist/main/unified-main.js` (Aug 30) vs `git log -1 --format=%ci -- src/main/unified-main.ts` (Sep 3)
- `node --input-type=module --check < dist/main/unified-main.js` → exit 0

**Desktop tests / toolchain**
- `pnpm run test` → 94/94
- `node -p "require('electron/package.json').version"` → 41.10.3; `ls node_modules/electron/dist/Electron.app` → present

**Desktop artifact hollowness**
- `find release/mac-arm64/Allternit\ Desktop.app -maxdepth 2` → only Contents/Resources
- `codesign -dv release/mac-arm64/Allternit\ Desktop.app` → "bundle format unrecognized"
- `ls release/` → no dmg/zip/.yml

**Desktop resources gaps**
- `ls resources/bin resources/lima resources/computer-use resources/platform 2>&1`
- `sed -n '72,102p' scripts/prepare-platform-static.cjs` (fails fast without bin/)
- `sed -n '32,38p' scripts/manifest.ts` (empty checksums 4/5 platforms)

**Desktop security spot-checks**
- `grep -n "shell:open-external" src/main/unified-main.ts` → :2118-2120 no validation
- `grep -n "Access-Control-Allow-Origin" src/main/unified-main.ts` → :1792-1864 `*`
- `grep -rn "will-navigate\|setPermissionRequestHandler" src/main/` → no matches
- `grep -rn "auth:oauth-start" src/` → preload invoke only, no `ipcMain.handle`

**Docs vs reality (desktop)**
- `head -15 README.md` ("50 MB dumb client") vs `du -sh release/mac-arm64 2>/dev/null` and `grep -c "" src/main/unified-main.ts` (3,621)

**Worktree / unmerged work**
- `git worktree list` → 2 worktrees; `cd ../allternit-session-os-console-20260902 && git status -sb` → 1 ahead / 153 behind, clean
- `git log origin/main..session/os-console-20260902 --oneline` → `bc1397f14` local-only; adds `package-lock.json`

**Ledger spot-checks**
- `git branch -r --contains e310b5689` etc. for the four wip/* SHAs → all on origin
- `sed -n '1774p' surfaces/ai.allternit.com/src/shell/ShellRail.tsx` → `RecentItemMenu`
- `git show --stat c1875af69 | head` → DispatchView repair commit

---

*Audit produced by deep-read investigation passes (architecture, security, packaging, docs, ledger) plus hands-on verification (typecheck, build, tests, artifact inspection, live HTTP checks). No source files were modified; no commits made; no worktrees created.*


---

# Addendum — Cross-Agent Corroboration (2026-09-03 ~19:40 CDT)

Five independent agent reports were reconciled against this one. Sources:

- **R1** — this report (web + desktop deep audit, `agent-ledger/summaries/2026-09-03-1854-main-kimi-deployment-audit-web-desktop.md`)
- **R2** — repo-wide production readiness gap analysis (`reports/2026-09-03-production-readiness-gap-analysis.md`, session d2315f8d)
- **R3** — desktop-only production readiness audit (session da7b70f4)
- **R4** — gizzi-code master plan + audit (session 237dc49a, `cmd/gizzi-code` plan `lightray-jay-garrick-tempest.md`)
- **R5** — all 15 marketing website surfaces vs live deployments (`Allternit Websites/docs/audits/production-launch-gap-analysis-2026-09-03.md`, session 423a858e)

## A. Corroborated — findings confirmed by ≥2 independent reports

| Finding | Reports | Status |
|---|---|---|
| Web `main` doesn't build (`ChatComposer.tsx` duplicate `submitMessage`, committed in `020203a9e`, masked by `@ts-nocheck`) | R1, R2 | ✅ independently found |
| Desktop `main` doesn't compile (merge `ea89a5fdb`: dup `hudWindow`/`remoteControlWindow`, dup `createHudWindow`/`toggleHudWindow`, undefined `effectiveMode`) | R1, R2, R3 | ✅ independently found by all three (R1+R2 count 9 main errors; R1 separately verified 2 more in `src/preload/index.ts:399-400` → **11 total**) |
| Stale `dist/` masks desktop breakage (Aug 30 build launches while fresh builds crash) | R1, R3 | ✅ |
| No shippable desktop artifact (`release/mac-arm64/` = Resources-only hollow bundle, no executable/Info.plist/asar) | R1, R3 | ✅ |
| Desktop docs contradict code ("50 MB dumb client" vs 600 MB+ fat client; AUDIT.md stale) | R1, R3 | ✅ |
| Unsigned/unnotarized; auto-update impossible unsigned; `github.com/allternit/desktop` release feed missing | R1, R3 | ✅ (R3 additionally probed the repo: 404) |
| mac/Windows/Linux configs write-only: single-arch Mach-O binaries staged into all targets, no Linux CI job | R1, R3 | ✅ |
| `shell:open-external` unvalidated (`unified-main.ts:2118-2120`) | R1, R3 | ✅ |
| Web CI red at HEAD (lockfile/override mismatch, `better-sqlite3: 13.0.3`) | R1, R2 | ✅ |
| Committed plaintext credentials in `capture-e2e-auth.mjs` (ProtonMail password + TOTP seed) | R1, R2 | ✅ |
| Stale `DEPLOYMENT.md` / docs describing the pre-Vite Next.js app | R1, R2 | ✅ |
| Electron 41 past security-support window | R3 (R1 noted version 41.10.3 installed) | ✅ |

## B. Corrections to R1 (this report) — verified by direct re-check 2026-09-03

1. **`scripts/build-desktop.sh` does not exist.** R1 §6.5/§11.2 referenced it as the toolchain entry point. Verified: `ls surfaces/allternit-desktop/scripts/build-desktop.sh` → No such file. R3's B4 is correct: the script is referenced by `verify-packaged-resources.cjs:73`, `SIGNING.md`, and `BUILD.md` but is absent — the staging pipeline is **broken by a missing file**, worse than R1 described. Fix: recreate it or fold staging into `prepare:*` steps.
2. **"Every BrowserWindow sets `contextIsolation: true`" has an exception.** R3's M1 verified: `src/main/startup-window.ts:305-306` — the Clerk startup/auth window sets `nodeIntegration: true, contextIsolation: false`. XSS in that window = main-process RCE. R1's blanket claim was wrong; the exception is the highest-severity window in the app.
3. **`allternit-voice-service` has no source.** R3's B5 verified: no `services/voice/package.json`; nothing in the repo produces the binary that `verify-packaged-resources.cjs:43-46` hard-requires. Build it or drop it from the required-resources check.

## C. New findings from R2–R5 that R1 missed (verified where noted)

**From R2 (repo-wide):**
- 🔴 **Dev backdoors on the production auth path (code-verified):** `dev-api-token` → `dev-user` resolution exists in `cmd/allternit-cloud-api/src/auth/resolve.rs:241` (comment at :9 acknowledges it). Production reachability depends on VPS env config — must be config-gated off before launch. Companion: `x-allternit-desktop-access-token: gizzi-local-token` fallback in gizzi-code (`allternitApi.ts:83-87`).
- Web-app→backend route mismatch beyond the design connectors (§11.3) — corroborates R1's gap; R2 enumerates further contract breaks.
- Grading lens differs: R2 scored the web surface **D+** as a *product* (distribution, update, cloud integration), R1 graded *deployability of the build*. Both are true: the build is fixable in hours; the product surrounding it is not launch-grade.

**From R3 (desktop depth):**
- Windows auto-update broken by design (`update-electron-app` needs Squirrel; target is NSIS) — needs `electron-updater` migration.
- Release workflow double-publish race (`release-desktop.yml` tag pushes trigger both electron-builder `--publish` and the softprops release job).
- No crash reporting / no global exception handlers anywhere in `src/main/`.
- Dead layers: `platform.ts` autostart imported by nothing; tray icon missing (`build/tray-icon.png`); HUD `get-windows` dependency never staged; 5 zero-import modules.
- Broken IPC channel: `auth:oauth-start` invoked from preload with no main handler (R1 §7 table; R3 independently).

**From R4 (gizzi-code — a third product in the launch path):**
- 🔴 **Cloud linkage showstopper:** `Flag.GIZZI_PLATFORM_API_URL` defaults to dead `https://allternit-cloud-api.fly.dev` (`flag.ts:71`) — `gizzi pair`/login/instance registration fail out of the box while production `api.allternit.com` is live. One-line fix.
- `gizzi org` calls routes that exist on neither backend, with a localhost default and a dev-mode header bypass (`org.ts:59-64`).
- Second backend (labs/cowork) defaults to `http://127.0.0.1:8013` — no production URL in the client.
- Clerk issuer default mismatch: cloud-api code defaults `allternit.com/__clerk`, gizzi-code/allternit-api default `clerk.allternit.com`.
- Committed **Clerk `sk_test_` secret key** in `script/platform-auth-server.js:19-21` (rotate + gitleaks CI).
- `gizzi web --mdns` exposes an unauthenticated agent API on the LAN; plaintext API keys in `config.toml`; `gizzi upgrade` broken three ways; install.gizziio.com serves SPA HTML for `/version.json`.
- R4 estimate for gizzi-code GA: ~4–6 weeks (Phases 0–5 in its master plan). **Not a tomorrow deliverable.**

**From R5 (marketing websites — the launch surface around the product):**
- 🔴 **labs.allternit.com serves the wrong app** (Husks robot sim, itself broken) — Pages domain-binding issue.
- 🔴 **ai.allternit.com `_redirects` catch-all swallows real assets — verified live this session:** `curl -I https://ai.allternit.com/benchmark-leaderboard.json` returns `content-type: text/html` (index.html), and `dist/` contains neither `benchmark-leaderboard.json` nor `models/`. The header comment in `dist/_redirects` documents the hazard; assets not explicitly self-rewritten get swallowed. **Fix in tomorrow's web deploy: add pass-throughs or emit the assets.**
- 🔴 **platform.allternit.com next deploy will 404 every auth route** (workspace sync drops the prerendered HTML `_redirects` points at).
- **3dfacility.allternit.com doesn't exist** (no DNS/Pages/CI) while www.allternit.com carries an uncommitted hero CTA pointing to it.
- Homebrew cask ships `PLACEHOLDER_INTEL_SHA256`; app self-reports not notarized → Gatekeeper friction on every first launch.
- Zero analytics on all 15 sites; robots/sitemap/404 missing on ~13.
- Fine: install.gizziio.com install paths, Stripe intake (30+ links), content quality.

## D. Reconciled launch picture for 2026-09-04

**T0 — tonight (blocks any launch):**
1. Web: fix `ChatComposer.tsx` duplicate; regenerate+commit lockfile; rebuild `dist/`; fix `_redirects`/missing assets (leaderboard, models); delete stale surface `wrangler.toml`. *(R1, R2, R5)*
2. Rotate: ProtonMail password + TOTP seed (R1/R2), Clerk `sk_test_` key (R4), review committed `pk_live_` key. Disable/gate `dev-api-token` + `gizzi-local-token` fallbacks (R2/R4).
3. Decide: kill or deploy 3dfacility CTA on www (uncommitted www changes must be committed or reverted before its next CI deploy) (R5).
4. Fix labs.allternit.com Pages domain binding (R5).
5. Desktop (if shipping anything): fix merge damage (11 errors), recreate `build-desktop.sh` staging or slim payload, decide voice-service scope (R1/R3).

**T1 — launch day:** Clerk smoke tests vs production (R1 §4.6); homebrew cask sha fix or Intel-build cut; platform.allternit.com prerender fix before its deploy (R5); desktop startup-window isolation + open-external validation if any desktop build ships (R3 M1/M2).

**Not launchable this week under any plan:** gizzi-code GA (R4: weeks), desktop public distribution (signing certs have lead time; R3), three-OS desktop release (cross-platform native binaries don't exist; R3 H7).

**Confidence note:** R1's three corrections (§B) were all in the direction of R3 being right and R1 overstating health — the multi-agent process worked as intended. No finding in §A was contradicted by any other report.


---

# Section E — Single-Agent Execution Guide

> **Purpose:** this section turns Sections 9–11 and Addendum A–D into an executable work order for ONE agent working alone. Read the whole report first; run Appendix A spot checks before changing anything so you know which findings are still live (some may already be fixed by the time you start).

## E.0 Session setup (repo rules — non-negotiable)

1. This repo mandates **session worktrees** (`AGENTS.md`): never edit the shared `main` checkout. Create/reuse your own worktree on branch `session/<id>` — a SessionStart hook normally injects the ritual; if it doesn't:
   ```bash
   cd /Users/joe/Desktop/allternit-workspace/allternit
   git worktree add ../allternit-session-<id> -b session/<id>
   cd ../allternit-session-<id>
   ```
2. `git commit`/`git push` are hard-gated by a steering agent. Update `.steering/checkpoint.md` (`Goal` / `Just done` / `Next` / `Open questions`) at every meaningful checkpoint; expect `[steering]` messages and act on them.
3. Do all work and verification inside the worktree. Merge to `main` happens only after steering approval — note **pushing to `main` triggers the Cloudflare deploy workflow**, so the merge IS the deploy.
4. Never read or transmit the contents of `capture-e2e-auth.mjs` beyond confirming it exists. Do not paste its contents into any message, commit, or new file.

## E.1 Verify first (~20 min) — know the true starting state

Run these spot checks from the worktree; record results in `.steering/checkpoint.md`:

```bash
cd surfaces/ai.allternit.com
pnpm run build            # expect: FAIL duplicate submitMessage (if fixed since, note and skip 2.1)
pnpm typecheck            # expect: exit 0 (misleading — 84 @ts-nocheck files)
pnpm test                 # expect: ~1157 pass / 3 fail
cd ../allternit-desktop
pnpm run typecheck        # expect: 11 errors (9 unified-main.ts + 2 preload index.ts:399)
ls scripts/build-desktop.sh   # expect: missing
ls release/mac-arm64 2>/dev/null # expect: hollow or absent
```

Also: `gh run list --workflow=deploy-cloudflare-pages.yml --limit 3` (expect last runs failed at install) and `curl -sI https://ai.allternit.com/benchmark-leaderboard.json | grep content-type` (expect `text/html` if still unfixed).

## E.2 Work order — execute in this sequence

Each item: **Do → Verify → Commit** before moving on.

### Phase 1 — Web build unblock (deploy gate)

**1.1 Fix `src/views/chat/ChatComposer.tsx` duplicate `submitMessage`.**
- Read both `useCallback` blocks (:1028 and :1197). They implement the same core send path (bad-merge double-insert from `020203a9e`).
- Diff them carefully — keep the superset of behavior (whichever handles more edge cases: streaming state, abort, attachments). Delete the other. If they differ materially, prefer the one referenced by the surrounding JSX's onSubmit wiring.
- **Do NOT remove the `@ts-nocheck` header in this pass** — that's Phase 5. Minimize blast radius.
- Verify: `pnpm run build` exits 0; `pnpm test` unchanged (1157 pass / same 3 failures).
- Commit: `fix(web): dedupe submitMessage in ChatComposer (merge residue 020203a9e)`.

**1.2 Regenerate the pnpm lockfile (CI hard blocker).**
- Repo root: `pnpm install --lockfile-only` (absorbs the `better-sqlite3: 13.0.3` override from `pnpm-workspace.yaml:83`).
- Verify: `git diff pnpm-lock.yaml` is non-trivial; `pnpm install --frozen-lockfile --ignore-scripts` exits 0 in a clean env (or trust CI to prove it).
- Commit separately: `chore(deps): regenerate lockfile for better-sqlite3 override`.

**1.3 Fix the `_redirects` asset swallowing.**
- `dist/_redirects` self-rewrite pass-throughs exist, but `benchmark-leaderboard.json` and `models/*` are neither emitted nor pass-through'd. Decide with the steering/user which is canonical:
  - If the app needs them: find the generator (grep `benchmark-leaderboard` in `src/` and `scripts/`), ensure they're emitted to `dist/`, add pass-through lines to the `_redirects` source (find where `_redirects` is written — likely `public/_redirects`), OR
  - If they're dead features: remove the UI references (grep for fetch of those paths) so nothing 404s silently.
- Verify: after rebuild, `curl -sI dist-server-or-local` returns the right content-type for each fixed asset; on the live site after deploy, `content-type: application/json` for the leaderboard.
- Live re-check command: `curl -sI https://ai.allternit.com/benchmark-leaderboard.json | grep -i content-type`.

**1.4 Delete stale configs (housekeeping, zero risk).**
- `git rm surfaces/ai.allternit.com/wrangler.toml` (wrong project `allternit-platform`, wrong dir `out` — root `wrangler.toml` is canonical).
- `git rm` the four fake knip reports (`knip-report*.json` — they contain an npx prompt, not data).
- Verify: root `wrangler.toml` still names `ai-allternit`/`dist`; nothing references the deleted files (`grep -rn "knip-report" surfaces/ai.allternit.com --include="*.json" -l` outside the deleted ones).
- Commit: `chore(web): remove stale wrangler.toml and fake knip reports`.

### Phase 2 — Credentials & backdoors (HUMAN ACTIONS REQUIRED — prepare, don't execute)

**2.1 Prepare the rotation report for the user (do NOT rotate yourself, do NOT scrub history without explicit approval).**
- List precisely: ProtonMail password + TOTP seed in `surfaces/ai.allternit.com/capture-e2e-auth.mjs:3-6`; Clerk `sk_test_…` in `cmd/gizzi-code/script/platform-platform-auth-server.js:19-21` (path per R4 — verify); live `pk_live_…` in `surfaces/ai.allternit.com/.env.production`.
- Recommendation to user: rotate all three; then remove the files from git history (`git filter-repo` or BFG) — history scrub rewrites SHAs and needs explicit go-ahead.
- What you CAN do now, safely: `git rm` the four `capture-*.mjs` scripts from the working tree (they're e2e scratch; the credentials stay in history until the scrub is approved). Commit: `chore(web): remove e2e credential scratch scripts (history scrub pending)`.
- Add gitleaks/trufflehog CI scan as a follow-up task in the checkpoint — do not implement in this pass without approval (new CI = new scope).

**2.2 Gate the dev backdoors (needs steering/user sign-off first — touches auth).**
- `cmd/allternit-cloud-api/src/auth/resolve.rs:241` — `dev-api-token` → `dev-user` fallback.
- gizzi-code `allternitApi.ts:83-87` — `gizzi-local-token` header fallback.
- Proposal only this pass: make both conditional on an explicit `ALLTERNIT_DEV_AUTH=1` env (default off), or delete. **Do not change auth behavior on `main` without human approval.** Park in checkpoint open questions.

### Phase 3 — Desktop compile fix (only if user confirms desktop is in scope)

**3.1 Fix merge damage in `src/main/unified-main.ts`** (from `ea89a5fdb`):
- Dedupe `hudWindow` (:210 vs :232) and `remoteControlWindow` (:212 vs :215) declarations.
- Remove the duplicate `createHudWindow` (keep :2182, delete :1436 — verify which copy the rest of the file references) and duplicate `toggleHudWindow` (:2287 vs :1523, same check).
- Define `effectiveMode` (:732) — read the surrounding boot-mode selection logic (:706-739); it should derive from the same mode resolution used elsewhere in `initializeApp`.
- Fix `src/preload/index.ts:399-400` duplicate object keys.
- Verify: `pnpm run typecheck` exits 0; `pnpm run build` (tsc both configs) succeeds; `pnpm run test` still 94/94.
- **Then delete the stale dist and rebuild fresh** so source and artifact match: `rm -rf dist && pnpm run build:main && pnpm run build:preload`. The stale Aug 30 `dist/` masking breakage must never recur — add a note to the checkpoint that CI must build dist (R3 B2).
- Commit: `fix(desktop): resolve desktop-cloud-mvp merge residue in unified-main + preload`.
- Verify launch: `pnpm run dev` boots the shell window (loads remote site — expected; local platform export is Phase 3.3).

**3.2 Harden the startup/auth window** (small, high value — `startup-window.ts:304-306`): move Clerk auth behind the existing preload bridge pattern (`src/preload/auth.ts`); set `nodeIntegration: false, contextIsolation: true, sandbox: true`. Verify the sign-in flow still works via the preload's `window.allternitAuth`. Commit separately.

**3.3 Recreate the staging entry point** (R3 B4/B5): recreate `scripts/build-desktop.sh` (referenced by `verify-packaged-resources.cjs:73`, `BUILD.md`, `SIGNING.md`) OR — recommended — fold its steps into the existing `prepare:*` scripts so the chain is self-contained. Resolve `allternit-voice-service`: find who built it last (grep ledger/CI); either add its build step or remove it from `verify-packaged-resources.cjs:43-46`. Stage `resources/platform/` from a fresh `ai.allternit.com` build. Verify: `pnpm run verify:packaged-resources` passes.
- **Stop condition:** if the user wants the full fat client (Lima, cua-driver, voice, mesh-node), say so in the checkpoint and pause — that toolchain (Go, cargo, pyinstaller, multi-GB downloads) is a separate decision. Minimum viable: gizzi-code + allternit-api binaries + platform static.

**3.4 Build arm64-only unsigned package:** `pnpm run pack` with electron-builder `--mac --arm64` (identity `null` is the configured default). **Do not build x64** (single-arch binary lie, R1 §6.7 / R3 H7). Verify the .app has `Contents/MacOS/`, `Info.plist`, `app.asar`. Delete the hollow `release/mac-arm64` artifact first. Do not attempt signing/notarization (no creds) — internal build only.

### Phase 4 — Merge, deploy, verify

1. Get steering approval per commit; push `session/<id>`; merge to `main` (**this triggers the Cloudflare deploy** — sequence 1.1→1.2 must both be merged for CI to go green).
2. Watch: `gh run watch` on `deploy-cloudflare-pages.yml`. Expect install to pass (1.2) and build to pass (1.1).
3. Post-deploy smoke (per `TESTING.md`):
   ```bash
   node surfaces/ai.allternit.com/scripts/clerk-e2e-verify.mjs
   node surfaces/ai.allternit.com/scripts/clerk-stress-test-v4.mjs
   curl -sI https://ai.allternit.com/benchmark-leaderboard.json | grep -i content-type   # application/json
   ```
4. Write the session attestation per `AGENTS.md` (`agent-ledger/summaries/YYYY-MM-DD-HHMM-<id>-kimi-<topic>.md` + LEDGER.md entry), clean up the worktree, restore branch.

## E.3 Explicit non-goals for this work order (do not drift)

- **No gizzi-code work** (R4's 44-item plan — separate effort, separate owner).
- **No marketing-website work** (R5 — separate repo `Allternit Websites`).
- **No Electron major bump** (41→43/44 is R3 H5; note the EOL exposure in the attestation instead).
- **No git-history rewrite, no credential rotation execution** — human-only, pending approval.
- **No removing `@ts-nocheck` headers** — separate ratchet effort; only fix what breaks the build.
- **No new CI workflows, no dependency upgrades** beyond the lockfile regen in 1.2.
- **No x64/Windows/Linux desktop packaging.**

## E.4 Definition of done (all must hold)

- [ ] `pnpm run build` green in `surfaces/ai.allternit.com` at the merge commit.
- [ ] `deploy-cloudflare-pages.yml` green on `main` after merge.
- [ ] Live: SPA loads, `/__clerk` 200, leaderboard (or its references) serve correct content-type, Clerk e2e verify passes.
- [ ] (If desktop in scope) desktop `typecheck`/`build` exit 0, fresh `dist/`, 94/94 tests, `verify:packaged-resources` passes, arm64-only .app built and launchable.
- [ ] Rotation report delivered to user; capture-*.mjs removed from tree; backdoor gating proposal in checkpoint open questions.
- [ ] Attestation written; worktree removed; `git worktree list` clean.

## E.5 If something here is already fixed when you start

That's expected — other sessions may land fixes first. For every Phase 1 item: run the Appendix A verify command; if it passes, record "already fixed at <SHA>" in the checkpoint and move on. Do not redo work, do not revert others' fixes.
