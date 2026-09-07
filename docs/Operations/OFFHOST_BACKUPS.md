# Off-host backups (audit P2 #19)

**Live since:** 2026-09-03 · **Source:** `mail` (prod Postgres + configs) · **Destination:** `allternit-standby` (tailnet 100.83.199.24, `/opt/backups/allternit-mail/`)

## What runs

- `/usr/local/bin/allternit-offhost-backup.sh` on mail — `pg_dump -Fc allternit` + tar of nginx sites / prometheus / alertmanager / grafana provisioning → rsync to standby → prune to 14 copies on both ends. Log: `/var/log/allternit-backup.log`.
- `allternit-offhost-backup.timer` — nightly 03:31 UTC (`systemctl list-timers allternit-offhost-backup.timer`).
- Auth: dedicated ed25519 keypair on mail (`/root/.ssh/id_backup_standby`), pubkey authorized on standby as `mail-to-standby-backup`. Standby host key in mail's known_hosts.

## Headscale volume

Fly.io snapshots `vol_rkgwmg1w3dpl2wy4` (app `allternit-headscale`) automatically every day, 5-day retention — verified 2026-09-03 (`flyctl volumes snapshots list vol_rkgwmg1w3dpl2wy4`). No custom job needed. Manual snapshot if ever required: `flyctl volumes fork <vol> -n <name>` (creates a new volume from latest snapshot).

## Restore drill (do quarterly)

```bash
# on standby (or any host with postgres 16):
scp root@mail:/opt/backups/allternit-mail/allternit-<stamp>.dump /tmp/
sudo -u postgres pg_restore --clean --if-exists -d allternit_restore_test /tmp/allternit-<stamp>.dump
sudo -u postgres psql -d allternit_restore_test -c "select count(*) from users;"
# success = row counts sane; then drop allternit_restore_test
```

## Known gaps

- No WAL archiving / PITR — nightly dump is RPO-24h. Acceptable per audit item as written ("nightly pg_dump off-host + restore drill").
- Backup failure alert not wired to Alertmanager; the timer's failure shows in `systemctl list-timers` and journal only.
