# Steering checkpoint — relay-0912

## Goal
Org relay tier for content artifacts (docs/design/artifacts-api.md §6): send an
artifact across gateways, mint a new local id on receive, carry origin id +
relay chain in provenance, standard sandbox for received artifacts. Desktop
rebuild required. Full session lifecycle ritual per AGENTS.md.

## Just did
- Read AGENTS.md ritual (binding), created worktree allternit-session-relay-0912
  on session/relay-0912 from origin/main (base 3fa88fb35). pnpm install done.
- Scoped the code: content_artifact_routes.rs conventions, CommRails
  peer/bus substrate (per-data_dir, local-only — cannot span two gateways),
  internal_auth token gate, public-router mounting, publish module patterns.
- Design decision: HTTP inbox between gateway base URLs is the only transport
  that spans separate data dirs; CommRails provides envelope shape + local
  ledger recording. Peer map via ALLTERNIT_RELAY_PEERS env; gateway identity
  ALLTERNIT_GATEWAY_NAME. Plan written to .steering/plans/plan-relay-0912.md.

## Next
Migration V156 + content_artifact_relay.rs module (send + inbox + @peer read +
provenance attach), Rust tests, then web provenance line, docs, live smoke.

## Open questions
- None — relay-tier decisions were pre-made by Eoj 2026-09-12 (§6).
