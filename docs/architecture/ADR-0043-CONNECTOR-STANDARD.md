# ADR-0043: One Allternit Connector Standard (Owned Rust Catalog + Open-Connector Sidecar)

- **Status:** Accepted
- **Date:** 2026-07-12
- **Owners:** Platform API / Connectors

## Decision

Allternit will operate one connector standard: `cmd/allternit-api/src/connector_routes.rs` (catalog, auth, connection state) fronting two backends — the Rust-native path for the curated 3 (github/notion/slack: `local_cli`/`oauth2`/`device_flow`/`api_key`, tokens sealed by `token_crypto.rs`) and the vendored open-connector sidecar (`services/open-connector`, self-hosted, Apache-2.0, no third-party runtime dependency — see `services/open-connector/PROVENANCE.md`) for every other connector.

The catalog is the union of Allternit's legacy 181-entry list and every provider the sidecar supports (1,063 as of this ADR), currently 1,137 entries, 1,064 of them genuinely connectable — not the 181-entry, 3-working state this replaces (see `docs/gap-analysis/OPEN_CONNECTOR_GAP_ANALYSIS.md`).

Per-user isolation is enforced entirely in the Rust layer: the sidecar is architecturally a local single-user server, so every proxied call passes the Allternit `user_id` as `connectionName`/`x-oo-connector-alias`. The sidecar is the token vault for everything it handles; `connector_connections` (SQLite, `backend` column) is an index only for sidecar-backed rows — real secrets never land in Rust's database for those.

## Why not the alternatives already in the codebase

Two other connector implementations exist and are **not** the standard:

- `mcp/connectors/` — a clean `Connector` interface/registry, abandoned at 3 hand-written connectors (Slack, GitHub, PostgreSQL). The right shape, wrong scale; superseded by the catalog+sidecar model, which gets 1,000+ providers without hand-writing each one.
- `domains/cowork/connectors/*` — 15 hand-rolled stdio-MCP servers with manual env-var token auth, no OAuth flow, no encryption at rest. Functional for its narrow set but has no path to the sidecar's scale or the Rust layer's per-user isolation and encrypted storage.

Neither is deleted by this ADR (deletion is a separate, more destructive action — see Consequences), but neither should be extended. New connector work goes through `connector_routes.rs`.

## Existing component disposition

| Component | Decision |
|---|---|
| `cmd/allternit-api/src/connector_routes.rs` | Canonical. Catalog, auth dispatch, connection-state index for both backends. |
| `cmd/allternit-api/src/open_connector_proxy.rs` | Canonical. Sole point of contact with the sidecar; owns id aliasing and per-user isolation. |
| `services/open-connector/` | Canonical sidecar backend for every non-curated connector. Self-hosted, vendored, no live upstream dependency. |
| `cmd/allternit-api/src/token_crypto.rs` | Canonical for the curated-3 (rust-native) credential path only. |
| `mcp/connectors/` | Deprecated. Do not extend; candidate for deletion once nothing depends on it (unverified as of this ADR — no consumer audit performed). |
| `domains/cowork/connectors/*` | Deprecated. Do not extend; candidate for deletion once `ConnectorSettingsPanel.tsx`/`cowork_routes.rs` are migrated or retired (their current response-shape mismatch, noted in the original gap analysis, is a separate pre-existing bug). |
| Plugin Manager marketplace UI (`BrowseConnectorsOverlay.tsx`) | Repointed at the real `/api/v1/connectors` catalog (was hitting nonexistent endpoints). |

## Consequences

- New connector integrations are catalog entries and (when needed) id aliases, not new bespoke Rust or TypeScript connector implementations.
- `mcp/connectors/` and `domains/cowork/connectors/*` are frozen, not actively deleted by this ADR — deletion requires a consumer audit (what still reads from `cowork_connectors`/`connectors-manifest.ts`) and is a separate, explicitly-confirmed change.
- The sidecar's own single-user architecture means any future feature that needs sidecar-side data (run logs, action policy) must be threaded through the same per-user `connectionName` discipline established here — never exposed to the frontend/MCP surface unfiltered.
- Full provider support (1,064/1,137) still excludes ~72 services genuinely absent from open-connector's catalog under any spelling (Salesforce, ServiceNow, Snowflake, the Zoho suite, etc.) — closing that gap means either open-connector adds them upstream or Allternit writes first-party provider definitions; it is not fixable by more id-mapping.
