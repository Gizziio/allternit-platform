# Bot Agents BA-0b/BA-1 + Fabric PWA bot-mode UI

- **Date:** 2026-09-10
- **Agent:** grok (orchestrator). Executors: kimi (BA-0b, quota), agy/Claude Sonnet 4.6 (BA-1 start + Fabric 1B, quota), orchestrator finished BA-1 inline.
- **PRs:**
  - https://github.com/Gizziio/allternit-platform/pull/284 · merge `3c96baba5` — CommRails crate rename + live rail
  - https://github.com/Gizziio/allternit-platform/pull/285 · merge `ae36c67b3` — Fabric Transport PWA bot-mode UI (1A–1C)

## What landed

**#284 — CommRails**
- `rails/` → `commrails/`. Package `allternit-commrails`, lib `allternit_commrails`.
- Bins `allternit-commrails`, `allternit-commrails-service`, nested CLI `commrails`.
- One-release shims: old bin names, `/api/rails` nest, `ALLTERNIT_RAILS_*` env, `commrails/compat` crate.
- Live Desktop rail: seed bots dropped; `GET /api/commrails/visibility` (alias `/api/rails/visibility`) from PeerRegistry; Sessions + Needs you panels.

**#285 — Fabric PWA**
- 1A transcript fold/primitives, 1B approvals + composer, 1C PWA bots roster/chat + ACI watch-to-pull.
- Service-worker `CACHE_NAME` bumped so installed PWAs drop stale caches.

## Verification

- `cargo test -p allternit-commrails` — 5/5 + doc-test (BA-0b).
- `npx vitest run src/lib/bots/commrails-store.test.ts` — 6/6 (BA-1).
- Cloud Agents Phase 1 (already on main): `cargo test -p allternit-api cloud_agents` — 7/7.
- PR 285: check-sw-cache-bump, gitleaks, typography, desktop vitest passed. Vercel deploy rate-limited (not a code failure). Cloudflare Pages still pending at merge.

## Honest deferrals

- BA-3 brain bind not started.
- Visibility panes are peer-registry only; ao-engine blocked/idle HTTP bridge not built.
- `scripts/maintenance/cleanup.sh` still mentions `rails/target`.
- Desktop DMG not rebuilt this session.
- Kimi 5-hour, Codex until 2026-09-16, agy individual quota (~7d) blocked further executors.
