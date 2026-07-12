# Deprecated — do not extend

These 15 hand-rolled stdio-MCP connector packages are **not** the connector standard. Per [ADR-0043](../../../docs/architecture/ADR-0043-CONNECTOR-STANDARD.md), Allternit's canonical connector system is `cmd/allternit-api/src/connector_routes.rs` (catalog, auth, connection state) plus the vendored open-connector sidecar (`services/open-connector`) — see `docs/gap-analysis/OPEN_CONNECTOR_GAP_ANALYSIS.md` for the full comparison and `docs/OPEN_CONNECTOR_SIDECAR_PHASE2_NOTES.md` for the implementation.

These packages predate that work and are functional but limited: manual env-var token auth only, no in-app OAuth flow, no encryption at rest. All 15 services here (slack, github, notion, linear, jira, google-workspace, hubspot, figma, asana, salesforce, zendesk, vercel, okta, monday, discord) are already covered by the standard's catalog — most with a real OAuth/api_key flow this system never had.

New connector integrations should be catalog entries in the standard above, not new packages here.

**Not deleted.** Deletion requires a consumer audit — `surfaces/ai.allternit.com/src/views/cowork/ConnectorSettingsPanel.tsx` and `cmd/allternit-api/src/cowork_routes.rs` (`cowork_connectors` table) still reference this system, and `ConnectorSettingsPanel.tsx`'s expected response shape (`connectors`/`summary`/`missingVars`) already doesn't match what `cowork_routes.rs::list_connectors` actually returns — a pre-existing bug independent of this deprecation, noted in the original gap analysis. Migrating or retiring those consumers is a separate, explicitly-confirmed change; this notice only marks the packages frozen.
