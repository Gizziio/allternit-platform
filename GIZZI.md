# Allternit monorepo — agent orientation

This is the root instructions file for any AI agent working in this repo
(gizzi-code, Claude Code, or otherwise). Read this before starting
user-facing feature work.

## Surfaces — read this before adding any user-facing feature

Allternit ships the same product to three places. **Adding a feature to
only one of them is the single most common cross-repo mistake in this
codebase.** Check all three before calling a feature "done":

| Surface | Path | Relationship |
|---|---|---|
| **Web** | `surfaces/ai.allternit.com` | Source of truth. Vite + React SPA. |
| **Desktop** | `surfaces/allternit-desktop` | Electron wrapper. Production builds bundle a *prebuilt copy* of the web surface (`resources/platform/`, produced by the `prepare:platform-static` script) — desktop has no separate UI implementation of its own. In `NODE_ENV=development`, the Electron main process instead points at a live web dev server on `localhost:3013` (see `src/main/config.ts`'s `PORTS.DEV_UI`). |
| **iOS** | `surfaces/allternit-mobile/ios` | Fully separate native Swift/SwiftUI app. Shares the same backend contracts and the same Clerk identity as web/desktop, but shares **no UI code**. |

**Practical rule: web + desktop are effectively one codebase** (build once,
bundle twice, gated on someone actually running the packaging step before a
release). **iOS is a second, independent codebase that needs every feature
built again, natively, by hand** — nothing web does reaches iOS
automatically. When scoping a feature, plan it as two explicit line items:
(a) web/desktop implementation, (b) iOS implementation. Treat iOS parity as
its own checklist item, not an afterthought.

All three surfaces authenticate against the **same Clerk application**
(`Gizziio`, one publishable key, verified byte-identical across web/desktop/
iOS builds as of 2026-08-01) — identity is unified even though the UI code
isn't.

## Backend architecture

- `cmd/allternit-api` — the backend each *device* actually talks to day to
  day. Desktop spawns/expects its own local instance
  (`VITE_ALLTERNIT_API_URL=http://127.0.0.1:8013` baked in at desktop build
  time); a paired iOS device reaches a real instance (local or tunneled)
  the same way. It is **not** a centrally-hosted multi-tenant service — it
  is not even a deployed Fly/Railway app. Local-first, per-device SQLite.
- `cmd/allternit-cloud-api` — the actual centrally-hosted service (Fly.io,
  app `allternit-cloud-api`). This is where cross-device tenancy really
  lives (`users.tenant_id`/`role`/`status`, `api_tokens`, `user_sessions`,
  `audit_log` — see `migrations/003_auth.sql`), device-token verification,
  hosted-runtime management, and Clerk webhook sync
  (`src/routes/clerk_webhooks.rs`, added 2026-08-01).
- **The deployed hosted web build (`ai.allternit.com`) currently has no
  backend behind it at all.** `CompanyConfigProvider`
  (`surfaces/ai.allternit.com/src/providers/company-config-provider.tsx`)
  used to call `/api/onboarding/config` unconditionally on every load, which
  always 404'd/fell through to the SPA shell there — fixed 2026-08-01 by
  gating that call behind `isSelfHosted()` (see `src/lib/env.ts`), since
  that endpoint is genuinely desktop/self-hosted-only (local Ollama/LM
  Studio discovery, OS keychain — concepts that don't exist for a hosted
  multi-tenant site).

## Local dev gotchas (hit and fixed 2026-08-01, will recur in fresh checkouts/worktrees)

- **`surfaces/ai.allternit.com` env vars**: Vite only exposes vars prefixed
  `VITE_` or `NEXT_PUBLIC_` to the browser bundle (`envPrefix` in
  `vite.config.ts`, deliberate — "never broaden this to arbitrary process
  environment variables"). A bare `ALLTERNIT_SELF_HOSTED=1` in `.env.local`
  silently does nothing in the browser. Use
  `VITE_ALLTERNIT_PLATFORM_DISABLE_CLERK=1` /
  `NEXT_PUBLIC_ALLTERNIT_PLATFORM_DISABLE_CLERK=1` to bypass Clerk for local
  testing instead.
- **`autoprefixer` is used by `postcss.config.cjs` but not declared** in
  `surfaces/ai.allternit.com/package.json` — fresh installs need it added
  manually or the dev server serves a permanent PostCSS error overlay (HTTP
  200 on the shell, but the page never actually renders — easy to
  misdiagnose as a backend problem).
- **iOS builds need `Frameworks/Mesh.xcframework`**, which is
  gitignored/not checked in — copy it from a working checkout
  (`surfaces/allternit-mobile/ios/Frameworks/`) before building in a fresh
  worktree.
- **iOS defaults to "Allternit Cloud" pairing mode**, not local — pass
  `ALLTERNIT_API_BASE_URL=http://127.0.0.1:8013/api/v1` at `xcodebuild`
  time (build-time, not a launch arg) to point a simulator build at a local
  backend directly.
- **This sandboxed dev environment cannot download large binaries** —
  Electron's postinstall (`cmd/allternit-desktop`) and Playwright's
  Chromium download both silently truncate (exit 0, but the resulting
  `dist/` is a few hundred KB instead of 100MB+). Not a code bug; don't
  spend time debugging it here, it needs a real (non-sandboxed) machine.
- **gizzi-code's own CLI entrypoint** (`bin/gizzi` / `cmd/gizzi-code`) has
  pre-existing undeclared dependencies (`axios`, `figures`, `fuse.js`,
  `lru-cache` resolving to the wrong major version, the
  `@opentelemetry/*` set, `sharp`, `xss`, `yaml`) that block it booting in a
  fresh checkout — fixed once already (`cmd/gizzi-code/package.json`), but
  watch for the same class of issue if new imports get added without a
  matching `package.json` entry, since pnpm hoisting can silently paper
  over it in some checkouts and not others.

## Steering / pipeline

This repo runs its own autonomous `.pipeline`/`.steering` automation
(spec-checker loop, discovery/build queue) and has a documented history of
**multiple concurrent Eoj/agent sessions editing the same checkout at
once**. Before editing any file, check `git status`/`git diff main` against
what you actually intend to touch, not just what you remember touching —
`main` moving out from under a long-running session mid-work is a known,
recurring, benign event here (resolve with a fast-forward merge, not by
treating it as your own scope creep).
