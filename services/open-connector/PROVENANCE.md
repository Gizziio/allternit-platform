# Provenance

This directory is a **fully vendored copy** of [oomol-lab/open-connector](https://github.com/oomol-lab/open-connector), imported directly into the Allternit monorepo — not a git submodule, not an npm/runtime dependency on any OOMOL-hosted service.

- **Upstream repo:** https://github.com/oomol-lab/open-connector
- **Imported at commit:** `62796b0d9390df49ed7644692ed75ba576bac9e9`
- **Commit date:** 2026-07-11
- **Imported into Allternit:** 2026-07-11
- **License:** Apache License 2.0 (see `LICENSE.txt` and `NOTICE.md` in this directory — both preserved unmodified as required by the license)

## Why vendored instead of a submodule

Allternit runs this as a self-hosted sidecar under our own control. A fully vendored copy means there is no live link back to the upstream repository or to OOMOL as a company — updates only happen when we deliberately re-import a newer commit and review the diff. See `docs/gap-analysis/OPEN_CONNECTOR_GAP_ANALYSIS.md` at the repo root for the analysis that led to this decision.

## Runtime independence audit (performed at import time)

Searched the full `src/` tree for any call back to `oomol.com` or any telemetry/analytics/tracking endpoint. Findings:

- `src/providers/fusion-api/*` references `fusion-api.oomol.com` / `www.oomol.com` — this is **one catalog provider entry** (OOMOL's own hosted API product, listed the same way `openai`, `anthropic`, etc. are listed) that a user would have to explicitly connect to, exactly like any other third-party provider in the 1,000+ catalog. It is not infrastructure the runtime depends on. Left in place, untouched, alongside every other provider.
- No other `oomol.com` references, no telemetry/analytics SDKs, no phone-home calls, no postinstall network calls found anywhere in `src/`, `scripts/`, or `package.json`. The `postinstall`/`dev`/`start` scripts (`scripts/ensure-generated.ts`, `scripts/dev-local.ts`, `src/server/index.ts`) are all local codegen/server-boot only.

## Changes made relative to upstream

None to the source yet. Allternit-specific configuration (ports, data directory, encryption key, admin/runtime tokens) is supplied entirely via environment variables at process-spawn time (see `scripts/dev-stack-watch.cjs` at the monorepo root) — no source edits were required to fit Allternit's conventions. If that changes, record the diff here.

## Confirmed runtime configuration (read directly from `src/server/index.ts` at import time)

| Env var | Purpose | Default |
|---|---|---|
| `PORT` | HTTP listen port | `3000` |
| `HOST` | Bind address | `127.0.0.1` |
| `OOMOL_CONNECT_ORIGIN` | Public origin used to construct OAuth redirect URIs | `http://localhost:{PORT}` |
| `OOMOL_CONNECT_DATA_DIR` | SQLite + transit file storage directory | `./data` |
| `OOMOL_CONNECT_ENCRYPTION_KEY` | AES-256-GCM key for credential storage | none (dev warning if unset) |
| `OOMOL_CONNECT_ADMIN_TOKEN` | Bearer token required for `/api/*` admin routes | none (open if unset — **must** be set outside local dev) |
| `OOMOL_CONNECT_RUNTIME_TOKEN` | Bearer token required for `/v1/*` and `/mcp` | none (open if unset — **must** be set outside local dev) |
| `OOMOL_CONNECT_ALLOWED_ACTIONS` / `_BLOCKED_ACTIONS` / `_ALLOWED_PROXIES` / `_BLOCKED_PROXIES` | Action policy allow/block lists | unset |

Allternit binds this to `127.0.0.1` only and never exposes it externally — all traffic reaches it exclusively through `cmd/allternit-api`'s proxy layer (`cmd/allternit-api/src/open_connector_proxy.rs`).
