# Phase 23 — Desktop Quotas and Usage Tracking

## Goal
Prevent a single user or org from consuming unlimited desktop capacity, and
record how much desktop time is actually used so later billing/metering has a
source of truth.

## What changed

### Database
`cmd/allternit-api/migrations/V96__desktop_quotas_usage.sql` adds:
- `desktop_quotas` — per-user (and optional per-org) limits for concurrent
desktops and monthly minutes.
- `desktop_usage` — one row per desktop session with start/end timestamps,
provider, and minutes used.

### New quota module
`cmd/allternit-api/src/bot_desktop_quotas.rs` (~377 LOC including tests):
- `check_quota(state, user)` — loads the user’s quota, falls back to the org
  quota, and checks active desktop count plus current calendar-month minutes.
- `record_start(...)` — inserts an open usage row when a desktop is provisioned.
- `record_end(bot_id)` — closes the usage row and computes elapsed minutes on
  deprovision.
- Quota failures return `QuotaError::ConcurrentLimit` or
  `QuotaError::MonthlyMinutesLimit`.

### Provisioning/deprovision integration
`cmd/allternit-api/src/bot_desktop_routes.rs`:
- Calls `check_quota` before spawning; returns HTTP 429 when the limit is hit.
- Calls `record_start` after a successful spawn.
- Calls `record_end` after deprovision.

## Verification

### Automated tests
```bash
cargo test -q -p allternit-api bot_desktop_quotas
cargo test -q -p allternit-api bot_desktop
```
All 3 quota tests + 36 desktop tests pass.

### End-to-end
Set a concurrent limit of 1 for the dev user:
```bash
sqlite3 "/Users/joe/Library/Application Support/allternit/allternit.db" \
  "INSERT OR REPLACE INTO desktop_quotas (user_id, max_concurrent, max_monthly_minutes) VALUES ('local-dev-user', 1, 10000);"
```

First provision succeeds:
```bash
curl -s -X POST \
  "http://127.0.0.1:8013/api/v1/bots/router-test-1/desktop/provision?template_id=preset-macos" \
  -H "Authorization: Bearer dev"
# {"sandbox_id":"...","status":"creating","provider":"tart","host":"127.0.0.1"}
```

Second concurrent provision is blocked:
```bash
curl -s -X POST \
  "http://127.0.0.1:8013/api/v1/bots/router-test-2/desktop/provision?template_id=preset-macos" \
  -H "Authorization: Bearer dev"
# {"error":"concurrent desktop limit reached (1/1)"}
```

After deprovision, usage is recorded:
```bash
sqlite3 ... "SELECT bot_id, provider, minutes FROM desktop_usage WHERE user_id='local-dev-user' ORDER BY id DESC LIMIT 1;"
# router-test-1|tart|0
```

## Size gate
- `bot_desktop_quotas.rs`: 377 LOC
- `bot_desktop_routes.rs`: 1,451 LOC (under 1,500)
- `bot_desktop_templates.rs`: 477 LOC

## Artifacts
- Screen recording: `phase23-quotas-demo.webm`
- This notes file: `phase23-quotas-NOTES.md`

## Known limitations / next work
- Only user-level and org-level quotas; no per-bot or per-template quotas yet.
- Monthly minutes are computed at deprovision time, so a running desktop does
  not contribute to monthly usage until it ends.
- Next phase: autoscaling and capacity monitoring so the fleet can grow and
  shrink based on actual demand.
