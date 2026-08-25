# Phase 26 — Web UI for Desktop Provisioning and Management

## Goal
Add a lightweight, standalone web admin surface that lets an operator view the
heterogeneous desktop fleet (templates, capacity, usage) and provision a desktop
for any bot through the unified control-plane API.

## What changed

### New admin page
- `surfaces/ai.allternit.com/public/desktop-cloud-admin.html` — standalone
  HTML/JS admin UI. It is served as a static asset by the platform Vite dev
  server (and can be served by any static host or the API in production).
- `surfaces/ai.allternit.com/public/desktop-cloud-admin.js` — small ES-module
  API client for the control plane. Exported functions accept an optional
  `fetch` implementation so they are testable without a browser.

### UI sections
- **Provision Desktop** — dropdown of bots from `GET /api/v1/agents`, dropdown
  of templates from `GET /api/v1/desktop-templates`, and a button that calls
  `POST /api/v1/bots/:bot_id/desktop/provision?template_id=...`.
- **Templates** — table of all templates with OS badge, CPU cores, RAM, and disk.
- **Capacity** — current fleet snapshots and the `scale_up_recommended` flag.
- **Usage Summary** — aggregated minutes and cost from `GET /api/v1/desktop-usage/summary`.

### Tests
- `docs/desktop-cloud-mvp/desktop-cloud-admin.test.mjs` — Node test runner
  tests for the API client using mocked `fetch`. Covers agents, templates,
  capacity, usage, provisioning, and HTTP error handling.

## Verification

### Automated tests
```bash
cd /Users/joe/Desktop/allternit-workspace/allternit-session-desktop-cloud-mvp
node --test docs/desktop-cloud-mvp/desktop-cloud-admin.test.mjs
```
All 6 tests pass.

### End-to-end
1. Serve the admin page from the platform `public/` directory:
   ```bash
   cd surfaces/ai.allternit.com/public
   python3 -m http.server 8766
   ```
2. Open `http://127.0.0.1:8766/desktop-cloud-admin.html`.
3. Page loads bots, templates, capacity, and usage summary automatically.
4. Select bot `Router Test Linux` and template `macOS Desktop`, then click
   **Provision desktop**.
5. Result displayed:
   ```
   Provisioned tart desktop for bot router-test-2.
   Sandbox: allternit-bot-c849f5ab7e144b3db6219d9f70ec8596
   Status: creating
   ```

## Size gate
- `desktop-cloud-admin.html`: ~270 LOC
- `desktop-cloud-admin.js`: ~70 LOC
- `desktop-cloud-admin.test.mjs`: ~80 LOC
- Total feature: well under 1,500 LOC

## Artifacts
- Screen recording: `phase26-webui-demo.webm`
- This notes file: `phase26-webui-NOTES.md`

## Known limitations / next work
- The admin page is standalone static HTML; the next iteration should embed
  equivalent controls into the authenticated React shell (`surfaces/ai.allternit.com`)
  and add start/stop/deprovision actions for existing sandboxes.
- No real-time updates; refresh the page to see capacity/usage changes.
- This completes the desktop-cloud MVP phase queue.
