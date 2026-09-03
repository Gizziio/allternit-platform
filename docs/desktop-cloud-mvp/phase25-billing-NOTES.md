# Phase 25 — Billing / Metering for Desktop Usage

## Goal
Turn the `desktop_usage` rows produced by Phase 23 into line-item costs and an
aggregate bill. Keep the module small and read-only: pricing is seeded in the
database and applied at query time.

## What changed

### Schema
`cmd/allternit-api/migrations/V97__desktop_pricing.sql`:
- Added `os` column to `desktop_usage` so usage rows can be priced per OS.
- Created `desktop_pricing` table keyed by `(provider, os)`.
- Seeded placeholder prices: Linux Incus $0.005/min, Windows Incus $0.015/min,
  macOS Tart $0.050/min.

### New billing module
`cmd/allternit-api/src/bot_desktop_billing.rs` (210 LOC excluding tests):
- `GET /api/v1/desktop-usage` — lists per-session usage rows with computed
  `cost` and `currency`.
- `GET /api/v1/desktop-usage/summary` — rolls up total minutes and total cost
  grouped by `(provider, os)`.
- Optional `?start=` and `?end=` RFC3339 filters on both endpoints.
- Prices are loaded once per request from `desktop_pricing`.

### Wiring
- `cmd/allternit-api/src/lib.rs` exports `bot_desktop_billing`.
- `cmd/allternit-api/src/main.rs` mounts the billing router at `/api/v1`.

## Verification

### Automated tests
```bash
cargo test -q -p allternit-api bot_desktop
```
All 38 desktop tests pass.

### End-to-end
```bash
curl -s -H "Authorization: Bearer dev" http://127.0.0.1:8013/api/v1/desktop-usage/summary
```
Returns:
```json
{
  "currency": "USD",
  "rows": 1,
  "total_cost": 6.0,
  "total_minutes": 120
}
```

```bash
curl -s -H "Authorization: Bearer dev" http://127.0.0.1:8013/api/v1/desktop-usage
```
Returns two macOS Tart usage sessions with per-minute costs.

## Size gate
- `bot_desktop_billing.rs`: 210 LOC (under 1,500)
- `V97__desktop_pricing.sql`: 15 LOC

## Artifacts
- Screen recording: `phase25-billing-demo.webm`
- This notes file: `phase25-billing-NOTES.md`

## Known limitations / next work
- Pricing is static seed data; there is no admin UI to edit rates yet.
- Currency is hard-coded to USD.
- No invoice or payment integration; this is pure usage metering.
- Next phase: web UI for desktop provisioning and management.
