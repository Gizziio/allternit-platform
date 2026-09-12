# Steering checkpoint — session/console-be-p10

## Goal
Backend build-out Phase 10 (G16–G17, final): (1) gizzi-code opt-in telemetry client posting to the existing /api/v1/analytics/gizzi-code/events endpoint (analytics_routes.rs:690-790 — backend already exists), env-gated OFF by default, plus lines-accepted counters in payload + aggregation; (2) announcements backend: table + GET /api/v1/console/announcements (audience-gated: org, dismissible-id) + admin publish endpoint. gizzi-code is desktop-bundled → release-preflight must be 26→35/0 before merge.

## Just did
- Worktree allternit-session-console-be-p10 on session/console-be-p10 from origin/main (bef00dff0).
- G16 backend: V151 migration (gizzi_code_usage_events.lines_accepted NOT NULL DEFAULT 0 + console_announcements table); analytics_routes.rs ingest + aggregation extended; existing gizzi test extended with lines_accepted + old-payload case.
- G17 backend: new src/console_announcement_routes.rs (GET /console/announcements, POST+DELETE /admin/console/announcements, admin_org gating, numeric semver filter), wired in lib.rs + main.rs; 8 tests.
- G16 client: src/runtime/services/telemetry/gizziUsageTelemetry.ts (GIZZI_TELEMETRY=1 opt-in, honors global privacy killswitches, fire-and-forget ≤1 retry, flushed in gracefulShutdown's 500ms-bounded analytics flush). Hooks: both countLinesChanged copies (accepted edits + lines), permissionLogging + toolExecution headless (rejections). docs/telemetry.md section 6. bun test test/telemetry/gizziUsageTelemetry.test.ts (14 tests).
- Env decision: GIZZI_TELEMETRY is ALSO the upstream kill switch; client turns on only for truthy values AND when privacyLevel permits — documented in module + telemetry.md.

## Next
- PR; attest; cleanup. (Implementation + verification complete: cargo 1023 pass / 5 known pre-existing fails, gizzi smoke 1300 pass, typecheck green, preflight 35/0, live smoke green.)

## Deviation note
- Task said telemetry endpoint lives at /api/v1/analytics/gizzi-code/events, but analytics_router was only mounted at /api. Fixed by merging analytics_router() into v1_routes (main.rs:798) so /api/v1 works; historical /api mount kept. Also: migration numbering — V150 exists and V151 was next-free, so both G16+G17 schema changes share V151.

## Open questions
- gizzi-code client placement: follow gizzi-code's existing patterns for background/persisted state; telemetry off unless GIZZI_TELEMETRY=1 (pick name consistent with GIZZI_* env style).
