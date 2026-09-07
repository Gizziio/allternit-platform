# Allternit Desktop Cloud — Operator Runbook

## Prerequisites

- A VPS or bare-metal host running Ubuntu 24.04 with Incus installed.
- A Tailscale/Headscale tailnet for agent-to-desktop networking (optional but recommended).
- SSH root access to the host.
- GitHub repository secrets (for CI): `VPS_HOST`, `VPS_SSH_KEY`.

## Initial VPS deploy

1. Push the current repo to the VPS source directory. The default path is
   `/opt/allternit-src`.
2. From the VPS, ensure Incus is initialized and client certificates exist:
   ```bash
   incus admin init --auto
   ```
3. From your local machine, run the deploy script:
   ```bash
   cd infrastructure/vps-desktop-cloud
   ./deploy.sh mail.news.allternit.com
   ```
   This installs the release binary, environment file, Incus certs, systemd
   service, health check, and backup timer.
4. Verify the service is healthy:
   ```bash
   ssh root@mail.news.allternit.com "systemctl status allternit-api"
   ssh root@mail.news.allternit.com "/opt/allternit-api/bin/health-check.sh"
   ```

## Re-deploy after code changes

The recommended path is the GitHub Actions workflow
`.github/workflows/deploy-desktop-cloud-vps.yml`. It builds the release binary,
uploads it to the VPS, runs `deploy.sh`, seeds the e2e bot, and runs the
Playwright e2e test.

To deploy manually:

```bash
cargo build -p allternit-api --release
scp target/release/allternit-api root@mail.news.allternit.com:/opt/allternit-src/target/release/allternit-api
ssh root@mail.news.allternit.com "cd /opt/allternit-src/infrastructure/vps-desktop-cloud && ./deploy.sh"
```

## Rotate secrets

The deploy script generates random values for:

- `ENCRYPTION_KEY`
- `ALLTERNIT_INTERNAL_SERVICE_TOKEN`
- `ALLTERNIT_SELF_HOSTED_SETUP_TOKEN`

To rotate them, delete `/etc/allternit-api/api.env` and re-run `deploy.sh`.
Backup credentials (`/etc/allternit-api/backup.env`) must be rotated separately.

## Rotate Incus certificates

1. Regenerate Incus certificates on the VPS:
   ```bash
   incus config trust list
   incus config trust add <name>
   ```
2. Re-run `deploy.sh` to copy the new CA/client certs into
   `/etc/allternit-api/incus/`.
3. Restart the service:
   ```bash
   systemctl restart allternit-api
   ```

## Read logs

```bash
# Human-readable logs
ssh root@mail.news.allternit.com "journalctl -u allternit-api -f"

# Structured JSON logs (when ALLTERNIT_LOG_FORMAT=json)
ssh root@mail.news.allternit.com "journalctl -u allternit-api -o json -n 100"

# Backup logs
ssh root@mail.news.allternit.com "tail -f /var/log/allternit-api/backup.log"
```

## Health checks

- API liveness: `https://mail.news.allternit.com/api/health`
- Desktop substrate health: `https://mail.news.allternit.com/api/v1/desktop-health`
- Systemd timer status:
  ```bash
  systemctl list-timers allternit-desktop-backup.timer
  ```

## Re-run the e2e test manually

```bash
cd surfaces/ai.allternit.com
VITE_ALLTERNIT_GATEWAY_URL=https://mail.news.allternit.com \
  VITE_ALLTERNIT_SELF_HOSTED_TOKEN=<token from /etc/allternit-api/api.env> \
  DESKTOP_CLOUD_TEMPLATE_LABEL="Ubuntu 24.04 Desktop (linux)" \
  pnpm exec playwright test tests/desktop-cloud.spec.ts --project chromium --reporter=list
```

## Restore a VM from a snapshot

Snapshots are managed through the API:

```bash
curl -s https://mail.news.allternit.com/api/v1/bots/<bot_id>/desktop/snapshots \
  -H "Authorization: Bearer <token>"

curl -s -X POST \
  https://mail.news.allternit.com/api/v1/bots/<bot_id>/desktop/snapshots/<snapshot_id>/restore \
  -H "Authorization: Bearer <token>"
```

## Restore a VM from an S3 backup

1. List backups in the bucket:
   ```bash
   mc ls allternit/allternit-desktop-backups
   ```
2. Download the tarball:
   ```bash
   mc cp allternit/allternit-desktop-backups/<backup>.tar.gz /tmp/
   ```
3. Import it as a new Incus instance:
   ```bash
   incus import /tmp/<backup>.tar.gz <new_instance_name>
   ```
4. Update the `bot_desktop_sandboxes` record for the bot to point at the new
   `sandbox_id` if necessary.

## Build and import a new Linux desktop image

1. Trigger the `desktop-image.yml` workflow with `import_to_vps: true`.
2. Or run locally:
   ```bash
   cd cmd/allternit-computer-cloud/guest
   sudo -E ./build-image.sh
   incus image export allternit-desktop /tmp/allternit-desktop.tar.gz
   scp /tmp/allternit-desktop.tar.gz root@mail.news.allternit.com:/tmp/
   ssh root@mail.news.allternit.com "incus image import /tmp/allternit-desktop.tar.gz --alias allternit-desktop"
   ```

## Unified API and deprecation

The platform now exposes a single compute domain at `/api/v1/computers/*` that
covers local, BYO-VPS, managed, BYOC, and cloud-desktop resources. For cloud
desktops this unified surface proxies to the same Incus/Tart substrate that
powers the legacy bot-desktop routes.

- New integrations should call `/api/v1/computers` (list/create),
  `/api/v1/computers/:id/start|stop|delete`, and the control endpoints
  `/api/v1/computers/:id/screenshot|shell|mouse|keyboard|files/*`.
- Legacy `/bots/:bot_id/desktop/*` routes are deprecated and retained only for
  backward compatibility. They will be removed in a future release after the
  deprecation window.
- Existing `bot_desktop_sandboxes` rows are automatically mirrored into the
  `computers` table on migration so the unified API can list historical desktops.

## Known limitations

- Windows desktops require a host with nested KVM (`/dev/kvm` present). The
  current VPS is a VM without nested KVM, so Windows validation is blocked.
- macOS desktops require Apple Silicon hardware running the Tart host wrapper.
  The current fleet only validates macOS locally.
