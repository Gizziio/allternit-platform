# Allternit Cloud API — Failover Runbook

Control-plane failover between the Contabo primary and standby. Tested end-to-end on 2026-09-02 (DNS flip, promote, live heartbeat through `api.allternit.com`, failback, replica re-bootstrap).

## Hosts

| Role | Host | Public IP | Tailscale | Services |
|------|------|-----------|-----------|----------|
| Primary | `mail` (`mail.news.allternit.com`) | 45.84.138.187 | 100.108.37.126 | allternit-cloud-api (8082), PostgreSQL 16 (primary), nginx, Prometheus 9091, Grafana 3000, Alertmanager 9093 |
| Standby | `allternit-standby` (Contabo Cloud VPS 8, `vmi3547644`) | 31.220.95.165 | 100.83.199.24 | PostgreSQL 16 (hot standby, streaming replica), allternit-cloud-api (installed, stopped + disabled), nginx with LE cert for api.allternit.com |

## Normal state

- `api.allternit.com` (Cloudflare A record `1d8f34ae4f5ced08e361067020b50720`, zone `5ebf34ee08d574ea107bbeb83395723a`, proxied, SSL mode **Full (strict)**) → `45.84.138.187` (mail).
- Standby Postgres streams from primary via replication user `replicator` over Tailscale (`host replication replicator 100.83.199.24/32 scram-sha-256` in mail's `pg_hba.conf`; mail listens on `127.0.0.1,100.108.37.126`).
- Standby API service is **stopped and disabled** to prevent split-brain (its background writers fail against the read-only replica by design).
- Standby nginx runs with a copy of mail's Let's Encrypt cert (`/etc/letsencrypt/{live,archive,renewal}`) so Full (strict) works immediately after a DNS flip.

## Cloudflare credentials

Global API key auth (the `cfk_…` key) with headers:

```
X-Auth-Email: allternitpbc@gmail.com
X-Auth-Key: <cfk_ key>
```

(Bearer-token form of this key is rejected; it is a global key, not an API token.)

## Failover (primary → standby), ~2 minutes

1. **Promote the database** on the standby:
   ```bash
   ssh root@31.220.95.165
   sudo -u postgres psql -c "SELECT pg_promote();"
   sudo -u postgres psql -tc "SELECT pg_is_in_recovery();"   # expect f
   ```
2. **Start the API** on the standby:
   ```bash
   systemctl start allternit-cloud-api
   curl -s http://127.0.0.1:8082/api/v1/health
   ```
3. **Flip DNS** (Cloudflare):
   ```bash
   curl -X PATCH "https://api.cloudflare.com/client/v4/zones/5ebf34ee08d574ea107bbeb83395723a/dns_records/1d8f34ae4f5ced08e361067020b50720" \
     -H "X-Auth-Email: allternitpbc@gmail.com" -H "X-Auth-Key: <cfk_ key>" \
     -H "Content-Type: application/json" --data '{"content":"31.220.95.165"}'
   ```
4. **Verify**: `curl https://api.allternit.com/api/v1/health` and confirm requests land in `/var/log/nginx/access.log` on the standby. Runtime-device heartbeats resume automatically.
5. If nginx on the standby does not answer 443 from Cloudflare (521), `systemctl reload nginx` and confirm `ss -tln | grep 443`.

## Failback (standby → primary)

1. Flip the DNS record back to `45.84.138.187` (same PATCH as above).
2. Verify `https://api.allternit.com/api/v1/health` (served by mail).
3. Stop the standby API: `systemctl stop allternit-cloud-api` (leave disabled).
4. Re-bootstrap the replica (the promoted DB cannot rejoin as a standby; the DB is ~112 MB so this is fast):
   ```bash
   systemctl stop postgresql
   rm -rf /var/lib/postgresql/16/main
   sudo -u postgres PGPASSWORD=<replicator pw> pg_basebackup \
     -h 100.108.37.126 -U replicator -D /var/lib/postgresql/16/main -R -X stream
   chown -R postgres:postgres /var/lib/postgresql/16/main
   chmod 700 /var/lib/postgresql/16/main
   systemctl start postgresql
   sudo -u postgres psql -tc "SELECT pg_is_in_recovery();"   # expect t
   ```
5. On mail, confirm: `sudo -u postgres psql -c "SELECT client_addr, state, replay_lag FROM pg_stat_replication;"`

**Note on writes during failover:** anything written while the standby was promoted is discarded by the re-bootstrap. For a real extended outage, either re-bootstrap `mail` from the promoted standby instead, or replay/export the delta before failback.

## Health checks

- Replication lag (mail): `SELECT client_addr, state, replay_lag FROM pg_stat_replication;` — expect `streaming`, lag < 1s.
- Replica status (standby): `SELECT pg_is_in_recovery();` — expect `t`.
- Cert expiry on the standby: the copied LE cert is renewed only on mail. Re-copy `/etc/letsencrypt/{live,archive,renewal}` to the standby after each renewal (or automate with a weekly rsync + `nginx reload`).

## 2026-09-02 test evidence

- DNS flipped to `31.220.95.165` at ~14:52 UTC; `GET /api/v1/health` 200 and `GET /api/v1/metrics` 200 through Cloudflare within ~1 minute.
- A live runtime-device heartbeat (`POST /api/v1/runtime-devices/rt_0406c03f…/heartbeat` → 200) was served by the standby and written to the promoted DB.
- Failback completed and replica re-bootstrapped; `pg_stat_replication` on mail showed `streaming` again.
