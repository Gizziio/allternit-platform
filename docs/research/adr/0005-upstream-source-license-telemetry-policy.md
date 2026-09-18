# ADR 0005: Upstream Source, License, Telemetry, and Update Policy

- Status: Accepted
- Date: 2026-07-15

## Decision

Upstream integrations are pinned to reviewed releases or commits and recorded in a source ledger. Copied or derived code retains required notices and modification history. Providers expose telemetry controls through Allternit consent settings, and offline mode permits no provider telemetry.

Initial reviewed pins:

- `injaneity/pi-computer-use`: `230d2e2c364ee76c0b7492a0588353f2fd064b67`, MIT.
- `trycua/cua`: `740806ca01f9a7cbc57694f28693f98748d345a4`, MIT repository; optional dependencies require separate review.

The optional Cua `cua-agent[omni]` dependency includes `ultralytics` under AGPL-3.0 and is excluded from distributed Allternit builds unless legal/product review explicitly approves it.

## Consequences

- Every upstream upgrade runs compatibility fixtures, real provider smoke cells, SBOM comparison, telemetry review, and rollback preparation.
- Unreviewed branch tracking and install-time remote code execution are not production defaults.
- Source notices, binary provenance, image digests, and dependency licenses ship with relevant artifacts.

