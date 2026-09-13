# Session summary — relay-0912 (org relay tier, Rust gateway + CommRails)

- **Date:** 2026-09-12
- **Agent:** kimi-code
- **Branch:** `session/relay-0912` → PR #442, merge commit `8b260f9b1`
- **Scope:** Implement the §6 org relay tier of `docs/design/artifacts-api.md`
  (deferred-but-decided tier, decisions 5 & 6, Eoj 2026-09-12): artifact
  send/receive across gateways over the CommRails substrate. Receiving
  gateway mints a NEW LOCAL id; origin id + relay path ride in provenance;
  received artifacts keep the standard sandbox (no stricter policy), with
  provenance displayed. One of three parallel 0912 sessions (`onlook-ast-0912`
  AST binding web, `artpolish-0912` CSP/tree-sync/critique/wrangler).

## What was done

1. **Gateway (cmd/allternit-api)**
   - Migration **V159** (`V159__content_artifact_relay.sql`):
     `content_artifact_relay_receipts` (send/receive audit + idempotency,
     bundle_hash PK) and `content_artifact_relay_provenance` (origin
     identity + relay chain per received artifact).
   - New module `content_artifact_relay.rs`:
     - `POST /api/v1/content-artifacts/:id/relay` `{target}` — packages the
       current version (HTML body + metadata + relay chain) as a
       CommRails-shaped bundle (`allternit.content-artifact.relay/v1`,
       deterministic bundle hash) and delivers it to the peer gateway's
       inbox over HTTP. Send-dedupe: a retried identical send replays the
       recorded receipt (`replayed:true`).
     - `POST /api/v1/content-artifacts/relay/inbox` (public router,
       per-handler `internal_auth::require_internal_token`) — verifies
       bundle hash + body sha256, mints `art_<uuid4>`, stores artifact
       (sandbox forced `standard`; origin policy preserved in provenance) +
       version 1 + provenance row. Idempotent by bundle hash (replayed
       bundle → 200 with the existing local id).
     - `a://artifact/<id>@<gateway>` read resolution: local hit on the
       prefix wins; local miss + `@peer` proxies the read from the named
       peer (read-through, annotated `resolvedVia`/`resolvedFrom`, nothing
       persisted locally).
     - Every relay is recorded as a `ContentArtifactRelayed` event in the
       local CommRails ledger on both gateways.
   - `content_artifact_routes.rs`: get/list attach `provenance.relay`.
   - Config: `ALLTERNIT_GATEWAY_NAME` (default `local`),
     `ALLTERNIT_RELAY_PEERS` (`name=http://host:port,...`, parsed per
     request).
2. **Transport choice (justified in PR):** HTTP inbox between gateway base
   URLs. The CommRails UDS envelope path requires a listener the gateway
   doesn't run; the CommRails Bus inbox is keyed per data_dir so it cannot
   span two gateway instances with separate data dirs — the org-mesh
   topology. CommRails provides the envelope conventions + durable ledger
   record on both ends of the wire hop.
3. **Web (minimal, presentational only):** relay provenance types in
   `content-artifact-api.ts`; `GalleryRelayProvenance` line under a gallery
   card when the artifact has relay provenance ("Relayed from <gateway>").
   Gallery stores and publish UI untouched.
4. **Docs:** `docs/design/artifacts-api.md` §6 relay row marked IMPLEMENTED
   with endpoint/bundle/idempotency/`@peer`-read/env semantics.

## Verification (all on merged main unless noted)

- `cargo test -p allternit-api --lib content_artifact`: **22/22 green**
  (bundle-hash determinism, peer-map parsing, address splitting, inbox auth
  401, mint + idempotent replay + provenance, tamper rejection, real-HTTP
  two-gateway e2e send, `@peer` read resolution).
- Full `cargo test -p allternit-api` on the PR base: 1049 passed; 6 failed =
  the known pre-existing set (4× agent_cloud provision_*,
  rails::gate_data_plane_round_trip) + 1 ordering flake that passes in
  isolation. None touched by this diff.
- `cargo build --release -p allternit-api`: green.
- **LIVE two-gateway smoke** (two release binaries, ports 18013/18014,
  separate data dirs, `ALLTERNIT_LOCAL_DEV_BYPASS=1`): relay A→B minted a
  new local id (≠ origin id); received artifact renderable with the v2 body
  snapshot + `provenance.relay` (originGateway `gw-a`, origin id, relay
  path) + `sandboxPolicy: standard`; `@gw-b` read-through resolved from A;
  resend deduped (B held exactly 1 artifact); tokenless inbox delivery
  rejected with 401.
- `pnpm typecheck`: 0 errors. vitest `src/lib/design src/components/artifact
  src/views/design`: **122/122** (incl. 3 new GalleryRelayProvenance tests).
  `node scripts/release-preflight.mjs`: **35/0**.

## Incidents

- Main gained migrations V156–V158 (adispatch-0912) while this branch held
  V156 — renumbered to V159 pre-merge (0cb9bb44d).

## Deferrals (honest)

- Receiving-user attribution = origin user id (org mesh assumes shared user
  identity); per-user cross-org attribution is future work.
- `@peer` read-through requires the peer to accept the request (local-dev
  bypass or shared deployment auth); full cross-org authenticated proxying
  is future work.

## Post-merge re-verification (this session, merged main @ cfd13a07c)

- `cargo test -p allternit-api --lib content_artifact`: **22/22 green** (25.6s).
- `cargo build --release -p allternit-api`: green (9m25s); smoke + sidecar
  binary from this build.
- LIVE two-gateway smoke re-run from the merged tree (tmp/relay-smoke.sh,
  evidence in the session's tmp/, 2026-09-12 ~21:15 CDT): relay A(18013)→B(18014)
  minted `art_eca5e40e-…` (origin `art_8b4b91ed-…`); B read returned the v2
  snapshot body with `provenance.relay` (originGateway `gw-a`, origin id,
  relayPath, originSandboxPolicy) under `sandboxPolicy: standard`;
  `@gw-b` read on A resolved via relay (`resolvedVia: relay`,
  `resolvedFrom: gw-b`); identical resend returned `replayed: true` and B
  held exactly 1 artifact.
- Inbox auth live probe (third gateway, token configured, no dev bypass):
  valid bundle without token → **401**, wrong token → **401**, correct
  `x-allternit-internal-token` → **201** with freshly minted local id
  `art_5f086dc1-…`. (The scripted `{}`-body check returns 422 because
  axum's `Json` extractor rejects the empty body before the handler's
  auth gate runs — probe uses a well-formed bundle, matching the unit
  test's approach.)

## Desktop rebuild

Follows in a ledger update below (release-path rule: rebuild from merged
main after attestation).

## Update 2026-09-12 ~21:30 — desktop rebuild DONE

- Fresh `gizzi-code` binary built from the merged tree (`cmd/gizzi-code`
  `bun run script/build-production.js` after `ensure-sdk-dist.sh`) and
  staged into `surfaces/allternit-desktop/resources/bin/gizzi-code` (2.0.8).
- Fresh `allternit-api` sidecar from this session's
  `cargo build --release -p allternit-api` on merged main (45,039,024 bytes,
  byte-identical into the bundle). Other 4 sidecars copied from the shared
  checkout (unchanged upstream).
- `CSC_IDENTITY_AUTO_DISCOVERY=false npm run dist` from the session
  worktree (pnpm collector — the shared checkout's npm-style node_modules
  breaks electron-builder, as onlook-ast documented).
- Result: **build b2423**, 8 files (arm64/x64 × dmg/zip + blockmaps),
  copied to the shared `surfaces/allternit-desktop/release/`.
- Bundle verification: `grep -rl relay/inbox` →
  `bin/allternit-api` inside `release/mac-arm64/Allternit Desktop.app`;
  `grep -rl "Relayed from"` → `platform/assets/DesignModeView-BUZi1A6L.js`.
- Retired ONLY the previous latest set: **b2414** (8 files). DMG unsigned/
  unnotarized (no APPLE_ID creds) — expected for local builds.
