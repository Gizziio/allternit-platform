# Lens & Connectors — Architecture Reference

> Lookup reference, not a build log. For history/decisions/why, see
> `docs/LENS_CONTEXT_LAYER_PLAN.md` (chronological) and
> `docs/gap-analysis/OPEN_CONNECTOR_GAP_ANALYSIS.md` (how the catalogue got
> to its current shape).

## The two systems

Allternit has **two separate connector-facing systems** that share one
underlying engine but serve different jobs. They are easy to conflate —
don't.

| | **Connectors** (pre-existing) | **Lens Context** (built 2026-08) |
|---|---|---|
| Job | One-off agent tool actions, on demand | Continuous background sync into persistent, tagged memory |
| Settings location | Settings → Customize → **Connectors** | Settings → Customize → **Lens Context** |
| Frontend component | `surfaces/ai.allternit.com/src/views/design/ConnectorModal.tsx` | `surfaces/ai.allternit.com/src/views/settings/LensSettingsPanel.tsx` |
| Frontend client | `src/lib/design/owned-connector.ts` | `src/lib/vault-api.ts` |
| Backend API | `GET /api/v1/connectors` on **allternit-api, port 8013** | `/v1/vault/*` on **gizzi-code, port 4096** |
| Backend route file | `cmd/allternit-api/src/connector_routes.rs` | `cmd/gizzi-code/src/runtime/server/routes/vault.ts` |
| Scope | Full catalogue — ~1,137 providers | ~7 registered sources (gmail, calendar, fireflies, github, notion, linear, slack) |
| Storage | Credentials only (SQLite, AES-256-GCM) | Full content — Markdown notes in the local Vault |

## The catalogue (Connectors page, full ~1,137 entries)

Two source catalogs, merged at request time — not one file:

1. **Legacy Allternit catalog**: `cmd/allternit-api/assets/open-design/connectors.json` (181 hand-curated entries, id/name/category only) + `cmd/allternit-api/assets/connectors.meta.json` (only **3** entries — `github`, `notion`, `slack` — have real dispatch metadata: auth type, OAuth endpoints, REST tool templates)
2. **open-connector's generated catalog**: `services/open-connector/catalog/` — generated from `services/open-connector/src/providers/<service>/definition.ts`, one directory per provider (1,000+ of them), via `services/open-connector/scripts/generate-catalog.ts`

Merge point: `cmd/allternit-api/src/connector_routes.rs`
(`find_catalog`, `meta_for`, `sidecar_view`) combines both into one response
at `GET /api/v1/connectors`. Routing logic per connector id:

- **Curated** (`is_curated(id)` — true only for github/notion/slack, i.e. present in `connectors.meta.json`): dispatched by `execute_connector`'s hand-written/`generic_dispatch` path. **Known bug**: this path hardcodes a GitHub `Accept` header on every request with no per-provider override — breaks Notion (needs `Notion-Version`). Not fixed at the Rust layer; Lens's Notion connector works around it by talking to the sidecar directly instead (see below).
- **Everything else** (~1,134 providers): proxied to the sidecar via `execute_sidecar` → `open_connector_proxy.rs` → the sidecar's own `POST /v1/actions/:actionId`, which sets correct provider-specific headers itself. No bug here.

## The sidecar (the shared engine underneath both)

`services/open-connector` — vendored (not forked) copy of oomol-lab's
open-connector, Apache-2.0. See its own `PROVENANCE.md` for import/audit
details. One running process serves **both** systems above.

| Environment | How it's started | File |
|---|---|---|
| Local dev (`dev-stack-watch.cjs`) | Node directly, ephemeral per-session tokens | `scripts/dev-stack-watch.cjs` |
| Packaged Desktop app | `ELECTRON_RUN_AS_NODE=1` running the bundled TS source through Electron's own Node runtime (its `bun build --compile` fails — see plan doc §7) | `surfaces/allternit-desktop/src/main/connector-sidecar-manager.ts` |
| Credential tokens (packaged) | Persisted once to `userData/auth/connector-sidecar-tokens.json`, not regenerated per launch | `surfaces/allternit-desktop/src/main/auth-manager.ts` (`getConnectorSidecarEnvironment`) |
| Bundled into the packaged app | `extraResources` in `package.json` — **two** entries (`node_modules` must be its own copy root; electron-builder unconditionally drops a directory's own top-level `node_modules` otherwise) | `surfaces/allternit-desktop/package.json` (`build.extraResources`) |

## Lens internals (the Vault side)

**Storage root** (as of 2026-08-04): Vault and the second brain (`gizzi
brain`) share one root — `resolveBrainPath()` (`runtime/brain/path.ts`):
`--path` flag → `userSettings.brain.path` → default `~/brain`, a git repo.
Was previously a separate, non-git `~/.local/share/gizzi-code/vault`. See
`docs/LENS_CONTEXT_LAYER_PLAN.md` §8 for why and how.

| Piece | File |
|---|---|
| Vault core (notes, query, frontmatter) | `cmd/gizzi-code/src/vault/{index,io,types,search}.ts` |
| Connector registry + generic sidecar-backed factory | `vault/connector.ts`, `vault/connectors/sidecar.ts` |
| Native (non-sidecar) connectors | `vault/connectors/{gmail,calendar,fireflies}.ts` — own direct OAuth, unrelated to the sidecar |
| Raw-item → tagged Vault note mapper | `vault/extraction-pipeline.ts` |
| User settings (enabled flags, tokens) | `vault/settings.ts` → `~/.config/gizzi-code/vault-settings.json` |
| Cron auto-sync (already generic, no per-source code) | `cmd/gizzi-code/src/daemon/main.ts` (`registerDefaultVaultJobs`) |
| CLI | `cmd/gizzi-code/src/cli/commands/vault.ts` — `gizzi vault {status,sync,config,mcp-server}` |

## MCP servers (how AI tools reach any of this)

Both registered together in `~/.config/gizzi-code/gizzi.json` under `"mcp"`:

| Name | Type | Purpose |
|---|---|---|
| `allternit-lens` | local/stdio, `gizzi vault mcp-server` | Reads the Vault — `search_context`, `get_recent_activity`, `get_profile`. Never serves `sensitivity: "restricted"` notes. |
| `open-connector` | remote, `http://127.0.0.1:8014/mcp` | The sidecar's own MCP — live `list_apps`/`search_actions`/`execute_action` against the full catalogue. No memory, no persistence. |

## Port reference

| Port | Process | Started by |
|---|---|---|
| 4096 | gizzi-code (Vault, Lens HTTP API, MCP) | `gizzi serve`, `bun start-server.ts`, or `gizzi-manager.ts` in the desktop app |
| 8013 | allternit-api (Rust, catalogue merge, connector proxy) | `target/debug/allternit-api` or `backend-manager.ts` |
| 8014 | open-connector sidecar | `connector-sidecar-manager.ts` (packaged) or `dev-stack-watch.cjs` (dev) |
