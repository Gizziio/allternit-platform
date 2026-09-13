# Steering checkpoint — relay-0912

## Goal
Org relay tier for content artifacts (docs/design/artifacts-api.md §6): send an
artifact across gateways, mint a new local id on receive, carry origin id +
relay chain in provenance, standard sandbox for received artifacts. Desktop
rebuild required. Full session lifecycle ritual per AGENTS.md.

## Just did
- Implemented the full relay tier (Rust):
  - V156__content_artifact_relay.sql (receipts + provenance tables).
  - cmd/allternit-api/src/content_artifact_relay.rs: bundle build/hash,
    POST /content-artifacts/:id/relay (send, dedupe by bundle hash),
    public POST /api/v1/content-artifacts/relay/inbox (internal-token gated,
    mints new local id, idempotent by bundle hash, verifies hash+body sha),
    @peer read-through resolution, provenance read helpers, CommRails ledger
    events on both send and receive.
  - content_artifact_routes.rs: get/list attach provenance.relay; GET accepts
    a://artifact/<id>@<gateway> (local hit wins, else proxy from peer).
  - main.rs/lib.rs wiring (protected send router + public inbox router).
- Web: ContentArtifactRelayProvenance types in content-artifact-api.ts,
  presentational GalleryRelayProvenance card line (+ CSS + test),
  rendered next to GalleryPublishActions in NewProjectScreen.
- Docs: artifacts-api.md §6 relay row IMPLEMENTED + §3 endpoint docs.
- Verified so far: cargo check clean; pnpm typecheck 0 errors;
  vitest design+artifact 122/122 (incl. 3 new relay provenance tests);
  release-preflight 35/0.

## Next
- cargo test -p allternit-api content_artifact (running), then full crate test
  + cargo build --release.
- LIVE two-gateway smoke (ports 18013/18014, separate data dirs, dev bypass).
- Merge origin/main, PR, merge, ledger attestation, desktop rebuild, cleanup.

## Open questions
- None.
