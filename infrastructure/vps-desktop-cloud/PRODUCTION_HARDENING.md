# Desktop Cloud production hardening checklist

Use this checklist before promoting the Desktop Cloud stack to production traffic.

## Host hardening

- [ ] VPS runs a supported LTS OS (Ubuntu 24.04 or Debian 12) with automatic security updates enabled (`unattended-upgrades`).
- [ ] SSH is key-only and root login over password is disabled.
- [ ] Firewall (`ufw` / `nftables`) allows only 80/443, the API port, and Tailscale traffic.
- [ ] `/var/lib/allternit-api` and `/etc/allternit-api` are on an encrypted volume or filesystem.
- [ ] Incus is initialised with a secure remote and client-certificate auth; `INCUS_INSECURE_SKIP_VERIFY=false` in production.

## Secrets

- [ ] `ENCRYPTION_KEY`, `ALLTERNIT_INTERNAL_SERVICE_TOKEN`, and `ALLTERNIT_SELF_HOSTED_SETUP_TOKEN` are 64-char hex and unique per environment.
- [ ] `TART_HOST_TOKEN` is unique per macOS host and rotated after initial setup.
- [ ] Environment files are `chmod 600` and owned by the service user.
- [ ] Run `./rotate-secrets.sh` and verify the API + Tart hosts come back healthy.

## Deployment & rollback

- [ ] `./deploy.sh` leaves a binary backup in `/opt/allternit-api/bin/backups/`.
- [ ] `./rollback.sh [vps] [timestamp]` restores a previous binary and env successfully in a staging drill.
- [ ] A deployment does not proceed unless `cargo test -p allternit-api bot_desktop` passes locally and in CI.

## Health checks & observability

- [ ] `systemctl status allternit-api` is `active` after deploy.
- [ ] `./health-check.sh` returns 0 from the VPS every minute (systemd timer or cron).
- [ ] `/api/v1/desktop-capacity` returns healthy snapshots and does not recommend perpetual scale-up.
- [ ] `/api/v1/desktop-usage/summary` returns expected totals for a known test window.
- [ ] Logs are shipped to the central log sink (set `ALLTERNIT_LOG_FORMAT=json`).
- [ ] Alerts exist for:
  - API health failing for >2 minutes
  - Queue depth growing for >5 minutes
  - Tart host health failing
  - Incus host disk >80%

## Image pipeline

- [ ] `infrastructure/tart-host/build-image.sh` builds `allternit-desktop-tart` and the service auto-starts on first boot.
- [ ] `infrastructure/tart-host/verify-e2e.sh` passes end-to-end on the rebuilt image.
- [ ] `infrastructure/vps-desktop-cloud/deploy-windows-host.sh` is validated on a KVM-capable host before relying on it.

## Billing

- [ ] `STRIPE_SECRET_KEY` and `STRIPE_DESKTOP_USAGE_SUBSCRIPTION_ITEM` are configured for live Stripe usage records.
- [ ] `cargo test -p allternit-api billing` passes.
- [ ] A manual `/desktop-usage/summary` reconciles with Stripe Dashboard usage for a test customer.

## Capacity & queueing

- [ ] `desktop_capacity_threshold` is tuned (default 0.75) and documented.
- [ ] The provision queue worker drains pending entries when capacity becomes available.
- [ ] Quotas (`bot_desktop_quotas`) reject provision requests that exceed per-user limits.

## Networking

- [ ] Tailscale is installed on VPS, macOS Tart hosts, and Windows Incus hosts.
- [ ] `TART_HOST_URLS` and `INCUS_URL` use Tailscale IPs or hostnames, not public endpoints.
- [ ] VNC ports are not exposed publicly; access is proxied through the API.
