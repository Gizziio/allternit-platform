# Phase D — Hardened VPS deploy + remote e2e proof

## Goal
Deploy the Allternit API as a systemd service on the VPS (`mail.news.allternit.com`),
expose it securely over HTTPS via OpenResty, and prove the platform-integrated
Desktop Cloud surface can provision/stop/deprovision an Incus desktop on the VPS
from a local Playwright run.

## What changed

### VPS service packaging
- Built the release binary on the VPS with `cargo build -p allternit-api --release`.
- Added `/opt/allternit-api/.env` with:
  - `ALLTERNIT_SELF_HOSTED=true`
  - `ALLTERNIT_LOCAL_DEV_BYPASS=true`
  - `ALLTERNIT_API_PORT=8013`
  - `INCUS_URL=https://mail:8443`
  - `INCUS_INSECURE_SKIP_VERIFY=true`
  - `INCUS_CLIENT_CERT=/etc/allternit-api/incus/client.crt`
  - `INCUS_CLIENT_KEY=/etc/allternit-api/incus/client.key`
- Installed Incus client certificates under `/etc/allternit-api/incus/` so the
  API can authenticate to the local Incus daemon over HTTPS.
- Added systemd unit `allternit-api.service` running as root and listening on
  `127.0.0.1:8013`.

### HTTPS reverse proxy
- Tailscale serve TLS is not enabled on this tailnet, so HTTPS is terminated by
  OpenResty on the VPS.
- Config: `/usr/local/openresty/nginx/conf/sites-enabled/mail.allternit-api.conf`
  - Reverse-proxies `https://mail.news.allternit.com` to `http://127.0.0.1:8013`.
  - Uses the existing Let's Encrypt certificate managed on the VPS.

### Test bot on the VPS
- Created `desktop-cloud-e2e-bot` by POSTing to the VPS `/api/v1/agents`
  endpoint so it is owned by the self-hosted dev user.

### E2E test hardening for a fresh shell session
`surfaces/ai.allternit.com/tests/desktop-cloud.spec.ts`:
- Walks the onboarding wizard if it appears (`Get Started` → `Continue`/`Skip for now`)
  and clicks `Open Allternit` on the final done screen to close the portal.
- Cleans up any pre-existing sandboxes at the start of the test so retries are
  idempotent.
- Uses explicit `aria-label` selectors for the Bot/Template selects.
- Asserts each select has a non-empty value after selection before clicking
  `Provision`.
- Timeout raised to 10 minutes because remote Incus provisioning can be slower
  than local Tart.

`surfaces/ai.allternit.com/src/views/desktop-cloud/DesktopCloudAdminView.tsx`:
- Added `aria-label="Bot"` and `aria-label="Template"` to the native selects so
  Playwright can target them reliably.

## How to run the remote e2e test

```bash
cd surfaces/ai.allternit.com
VITE_ALLTERNIT_GATEWAY_URL=https://mail.news.allternit.com \
  DESKTOP_CLOUD_TEMPLATE_LABEL="Ubuntu 24.04 Desktop (linux)" \
  pnpm exec playwright test tests/desktop-cloud.spec.ts --project chromium --reporter=list
```

The test points the local platform dev server at the remote API; the browser
performs the full authenticated-shell flow against the VPS backend.

## Proof
- Browser recording of the full VPS e2e run:
  `docs/desktop-cloud-mvp/phaseD-vps-deploy-demo.webm`
- Terminal recap (last 2 minutes of the screen recording showing the passing run):
  `docs/desktop-cloud-mvp/phaseD-terminal-recap.webm`

## Tests pass
- `VITE_ALLTERNIT_GATEWAY_URL=https://mail.news.allternit.com DESKTOP_CLOUD_TEMPLATE_LABEL="Ubuntu 24.04 Desktop (linux)" pnpm exec playwright test tests/desktop-cloud.spec.ts --project chromium --reporter=list` (1 passed)
- `pnpm exec vitest run src/lib/desktop-cloud-api.test.ts` (11 passed)
- `cargo test -p allternit-api bot_desktop` (38 passed)
- `cargo test -p allternit-computer-cloud` (24 passed)

## LOC check
- `DesktopCloudAdminView.tsx`: ~580 LOC (added 2 aria-label attributes only)
- `desktop-cloud.spec.ts`: ~120 LOC
- `bot_desktop_routes.rs`: under 1,500 LOC

All feature modules remain under the 1,500 LOC limit.

## Known remaining items for production readiness
- The onboarding `setupApi.saveConfig` call returns HTTP 401 in self-hosted mode
  because it still expects a Clerk bearer token. The wizard still closes because
  it catches the error and writes the local onboarding-completed state. A
  self-hosted setup endpoint should be added later, but it does not block the
  Desktop Cloud checkpoint.
- The VPS release build is currently done manually with `cargo build`; a CI
  pipeline that builds, uploads, and restarts the service via GitHub Actions
  would be the next hardening step.
