# Plan — session/relay-0912: org relay tier (artifact send/receive across gateways over CommRails)

Spec: docs/design/artifacts-api.md §6 relay tier, decisions 2026-09-12 (Eoj):
mint NEW LOCAL id on receive; origin id in provenance; NO stricter sandbox
(received artifacts render under `standard`; provenance displayed).

## Design

- Transport: HTTP inbox POST between gateway base URLs. Justification: the
  CommRails UDS envelope path needs a listener the gateway doesn't run; the
  CommRails Bus inbox is keyed per data_dir so it cannot span two gateways
  with separate data dirs (the org-mesh topology). The relay ride is a
  CommRails-shaped envelope and every send/receive is recorded in the local
  CommRails ledger (state.rails.ledger) — same substrate, only the wire hop
  is HTTP.
- Gateway identity: `ALLTERNIT_GATEWAY_NAME` (default `local`).
- Peer map: `ALLTERNIT_RELAY_PEERS="name=http://host:port,name2=..."` env,
  parsed per request via pure `relay_peers_from_env()` / `resolve_peer()`.
- Bundle: JSON envelope `allternit.content-artifact.relay/v1` with
  bundleHash (sha256 over origin gateway/id/version/body sha/relay path —
  deterministic), origin metadata (title/type/policy/provenance fields),
  current-version body + bodySha256, and relayChain (provenance chain,
  appended per hop).
- Migration V156__content_artifact_relay.sql:
  - `content_artifact_relay_receipts` (bundle_hash PK, direction sent|received,
    peer_gateway, origin ids, local_artifact_id, relay_chain, created_at) —
    send dedupe + receive idempotency + audit.
  - `content_artifact_relay_provenance` (artifact_id PK, origin_gateway,
    origin_artifact_id, origin_version, relay_chain, bundle_hash, received_at).

## Routes (new module cmd/allternit-api/src/content_artifact_relay.rs)

- `POST /api/v1/content-artifacts/:id/relay` (Clerk auth) `{target}` → build
  bundle → dedupe by bundle_hash receipt → POST to
  `{peer}/api/v1/content-artifacts/relay/inbox` with
  `x-allternit-internal-token` → record sent receipt → `{ok, target, bundleHash, received}`.
- `POST /api/v1/content-artifacts/relay/inbox` (PUBLIC router, per-handler
  `require_internal_token` — localhost dev bypass applies) → validate
  envelope + recompute bundleHash → idempotent by bundle_hash (INSERT OR
  IGNORE; replay returns existing local id) → mint `art_<uuid4>`, insert
  artifact row (sandbox_policy forced `standard` per decision 6) + version 1
  + provenance row → 201 `{artifactId, version, bundleHash}`.
- `GET /api/v1/content-artifacts/:id` extension (in content_artifact_routes.rs):
  id may carry `@peer` suffix — local hit on the prefix wins; local miss →
  resolve peer → proxy GET from peer (forward caller Authorization if
  present) → return peer artifact annotated `relay: {peer, resolvedVia}`.
  Unknown peer → 404. Read-through only; nothing persisted locally.
- Reads (get + list) attach `provenance.relay` when the side table has a row.

## Web (minimal, presentational only)

- `content-artifact-api.ts`: `relay` field on ContentArtifactProvenance.
- New `views/design/GalleryRelayProvenance.tsx`: small line under a gallery
  card when the artifact's provenance.relay exists ("Relayed from X · origin
  id@X"). Own artifact-id resolver (does NOT touch GalleryPublishActions).
- Render next to GalleryPublishActions in NewProjectScreen.tsx (one line).
- Vitest: relay line shown when provenance.relay present; renders nothing
  otherwise.

## Docs

- artifacts-api.md §6: org relay row → IMPLEMENTED; document endpoints,
  bundle, idempotency, `@peer` read semantics, env config, transport choice.

## Verification

- `cargo test -p allternit-api content_artifact` (new tests: bundle hash
  determinism, inbox mint + idempotent replay, inbox auth 401, two-gateway
  e2e over real HTTP with two in-process routers, `@peer` read resolution,
  local-hit-wins, provenance on get/list).
- Full `cargo test -p allternit-api` (known pre-existing failures not mine).
- `cargo build --release -p allternit-api`.
- LIVE smoke: two gateway binaries, different ports/data dirs,
  ALLTERNIT_LOCAL_DEV_BYPASS=1, relay across, prove new local id + provenance
  chain + renderable read.
- `pnpm typecheck`; vitest for artifact components + design;
  `node scripts/release-preflight.mjs` 35/0.
- Desktop rebuild ritual: fresh gizzi-code binary staged from worktree,
  background `npm run dist`, bundle-grep `relay/inbox` marker in
  bin/allternit-api, preserve 8-file set to shared release/, retire previous
  latest only.

## Non-goals / do-not-touch

- content_artifact_publish.rs semantics; renderer/CSP; design stores;
  gallery-store; content-artifact-sync; project-file-store; TS surgical
  panel; critique files; LibraryItemDialog (siblings own those).
