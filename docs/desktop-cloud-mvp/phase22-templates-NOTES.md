# Phase 22 — Desktop Template Registry and Presets

## Goal
Replace raw image aliases with a curated template registry. Users can pick from
built-in presets or create their own templates, then provision a desktop by
`template_id` instead of memorizing OS/image/resource combinations.

## What changed

### Database
`cmd/allternit-api/migrations/V95__desktop_templates.sql` adds the
`desktop_templates` table and seeds three public presets:
- `preset-linux-ubuntu` → `allternit-desktop`
- `preset-windows` → `allternit-desktop-windows`
- `preset-macos` → `tart-ubuntu-test`

### New registry module
`cmd/allternit-api/src/bot_desktop_templates.rs` (~407 LOC including tests):
- `GET /api/v1/desktop-templates` — list visible templates, with optional `os`
  and `tag` filters.
- `POST /api/v1/desktop-templates` — create a user/org template.
- `GET /api/v1/desktop-templates/:id` — fetch one template.
- `DELETE /api/v1/desktop-templates/:id` — delete a template you own.
- `resolve_template(db, user, id)` — internal helper used by provisioning.

Visibility rules: public presets + templates owned by the user + templates
owned by the user’s organization.

### Provisioning integration
`cmd/allternit-api/src/bot_desktop_routes.rs` now accepts `?template_id=` on
`POST /api/v1/bots/:bot_id/desktop/provision`. When a template is supplied, its
`os`, `image`, CPU, memory, disk, network flag, and env vars override the
legacy defaults. The existing `?os=` query still works for backward
compatibility.

### Wiring
- `cmd/allternit-api/src/lib.rs` exports `bot_desktop_templates`.
- `cmd/allternit-api/src/main.rs` merges the template router at `/api/v1`.

## Verification

### Automated tests
```bash
cargo test -q -p allternit-api bot_desktop_templates
cargo test -q -p allternit-api bot_desktop
```
All 3 template tests + 30 desktop tests pass.

### End-to-end
List presets:
```bash
curl -s -H "Authorization: Bearer dev" \
  "http://127.0.0.1:8013/api/v1/desktop-templates?os=linux"
```
Returns the seeded Ubuntu preset.

Provision from the macOS preset:
```bash
curl -s -X POST \
  "http://127.0.0.1:8013/api/v1/bots/router-test-1/desktop/provision?template_id=preset-macos" \
  -H "Authorization: Bearer dev"
# {"sandbox_id":"...","status":"creating","provider":"tart","host":"127.0.0.1"}
```
The template correctly routed to Tart and used `tart-ubuntu-test`.

## Size gate
- `bot_desktop_templates.rs`: 407 LOC
- `bot_desktop_routes.rs`: 1,485 LOC (still under 1,500)

## Artifacts
- Screen recording: `phase22-templates-demo.webm`
- This notes file: `phase22-templates-NOTES.md`

## Known limitations / next work
- No PUT endpoint yet; users must delete and recreate to update a template.
- Tags are stored as JSON and filtered with a simple substring LIKE.
- Next phase: per-user/org quotas and usage tracking so tenants cannot consume
  unlimited capacity.
