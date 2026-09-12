# Attestation — session/console-be-p10 (console backend phase 10, FINAL)

**Date:** 2026-09-12
**Agent:** kimi-code
**PR:** #431 (merge `89508917f`)
**Topic:** Gizzi telemetry client (opt-in) + console announcements backend (G16–G17)

## What was done
- V151: gizzi_code_usage_events.lines_accepted; console_announcements (audience, min_client_version, dismissible, expiry).
- gizzi-code telemetry service: GIZZI_TELEMETRY truthy + privacy level permits (upstream kill switches win); fire-and-forget session summaries; lines_accepted = +lines actually applied to disk (post-permission choke points); graceful-shutdown flush; 16 tests. provider reserved-null (documented).
- analytics router mounted under /api/v1 (was /api-only — the documented endpoint 501'd); aggregation sums lines_accepted.
- GET /console/announcements (org+'all' audience, client_version semver filter, no internal fields); POST/DELETE /admin/console/announcements (org-admin gated, own-org or all).

## Verification
- cargo test api: 1023 pass / 5 fail = known env set exactly. gizzi-code typecheck green; bun test 1300 pass / 0 fail. release-preflight 35/0 (release-path gate). Live smoke (port 18013): org scoping, version filter, 403 gating, delete, telemetry ingest + aggregation.

## Incidents / deviations
- GIZZI_TELEMETRY name already the upstream kill switch — client respects =off etc.; enables only on truthy + privacy permit.
- analytics /api-only mount fixed (backward-compat /api mount kept).

## Status: ALL 10 PHASES COMPLETE
