# Deprecated — do not extend

This package (`@allternit/mcp-connectors`) is **not** the connector standard. Per [ADR-0043](../../docs/architecture/ADR-0043-CONNECTOR-STANDARD.md), Allternit's canonical connector system is `cmd/allternit-api/src/connector_routes.rs` (catalog, auth, connection state) plus the vendored open-connector sidecar (`services/open-connector`) — see `docs/gap-analysis/OPEN_CONNECTOR_GAP_ANALYSIS.md` for the full comparison and `docs/OPEN_CONNECTOR_SIDECAR_PHASE2_NOTES.md` for the implementation.

This package's `Connector`/`ConnectorRegistry` interface was a reasonable shape but never scaled past 3 hand-written connectors (Slack, GitHub, PostgreSQL). New connector integrations should be catalog entries in the standard above, not new implementations here.

**Not deleted.** Deletion requires a consumer audit (what still imports from this package, notably `cmd/cli/src/commands/connectors.ts`) and is a separate, explicitly-confirmed change — this notice only marks the package frozen.
