---
status: done
files_changed:
  - cmd/allternit-api/migrations/V51__mcp_tunnel_auth.sql
  - cmd/allternit-api/src/mcp_tunnel_auth.rs
  - cmd/allternit-api/src/mcp_server_routes.rs
  - cmd/allternit-api/src/lib.rs
  - cmd/allternit-api/Cargo.toml
  - Cargo.lock
deviations: []
remaining:
  - Admin API CRUD for mcp_tunnel_auth policies (create/list/update/delete endpoints under /admin/mcp_tunnels)
  - Real mTLS client certificate extraction from the TLS layer (current scaffold uses headers)
  - Live OAuth token introspection / JWKS validation instead of header-trusted issuer/audience
  - Integration tests that exercise /mcp/server with a full AppState and tunnel auth configured
---

# Swarm C — Phase 3 Notes

## What changed

Phase 3 for Swarm C added the **MCP tunnel security scaffold** to `allternit-api`.

1. **Database migration (`V51__mcp_tunnel_auth.sql`)**
   - Created `mcp_tunnel_auth(tunnel_id, client_cert_pem, oauth_issuer, audience, created_at, updated_at)`.
   - Added an index on `oauth_issuer`.
   - The table is intentionally fail-open: if no row exists for a `tunnel_id`, the MCP server endpoint behaves as before.

2. **New module `cmd/allternit-api/src/mcp_tunnel_auth.rs`**
   - `McpTunnelAuth` data model and `load_tunnel_auth` helper.
   - `client_cert_thumbprint(pem)` computes the SHA-256 hex thumbprint of the first certificate in a PEM bundle, matching `openssl x509 -sha256 -fingerprint` output.
   - `validate_oauth_issuer` normalizes case and trailing slashes.
   - `validate_oauth_audience` enforces audience only when one is configured.
   - `validate_tunnel_request` and `require_tunnel_auth` provide fail-closed validation when a policy is configured.
   - Unit tests cover thumbprint computation, issuer/audience validation, and full policy checks using a hard-coded self-signed certificate and a temporary SQLite database.

3. **Wired into MCP server attachment (`mcp_server_routes.rs`)**
   - `handle_rpc` now reads four optional headers:
     - `x-allternit-tunnel-id`
     - `x-allternit-client-cert-thumbprint`
     - `x-allternit-oauth-issuer`
     - `x-allternit-oauth-audience`
   - If a `tunnel_id` header is present and a policy exists, the request is validated before the JSON-RPC handler runs.
   - Validation failures return a JSON-RPC error with code `-32001` and HTTP 401.
   - Added unit tests for JSON-RPC envelope shape and tunnel auth header constants.

4. **Build / dependency changes**
   - Added `rustls-pemfile = "2"` to `cmd/allternit-api/Cargo.toml` (already present in the workspace lockfile).
   - Registered `mcp_tunnel_auth` in `lib.rs`.

## Verification

- `cargo check -p allternit-api`: passed (pre-existing warnings only).
- `cargo test -p allternit-api --lib`: 196 passed, 0 failed.

## Blockers

None for the scoped scaffold. The existing warnings in unrelated modules were not introduced by this change.

## What remains for Phase 4

- **Admin API surface**: CRUD endpoints under `/admin/mcp_tunnels` so operators can create, rotate, and delete tunnel auth policies without raw SQL.
- **Real TLS integration**: Replace header-trusted thumbprints with actual mTLS client certificate extraction (e.g., from `SslStream` or a reverse proxy).
- **Live OAuth validation**: Move from header-trusted issuer/audience to real JWT signature verification or token introspection against the configured issuer.
- **End-to-end tests**: A test harness that spins up `allternit-api` with a real `AppState`, seeds `mcp_tunnel_auth`, and asserts that `/mcp/server` accepts/rejects requests accordingly.
- **Documentation / threat model**: Document the trust boundary between the TLS terminator and the API, and how operators should rotate compromised client certificates.
