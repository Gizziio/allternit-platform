# Monitoring configs — `mail` (Contabo control plane)

Snapshot of the live Prometheus / Alertmanager / Grafana configuration on
`mail` (api.allternit.com host), committed 2026-09-03 (audit item P2 #21 —
"configs were untracked manual state").

| Path here | Live path on mail |
|---|---|
| `prometheus/prometheus.yml` | `/etc/prometheus/prometheus.yml` |
| `prometheus/rules/` | `/etc/prometheus/rules/` |
| `prometheus/alertmanager.yml` | `/etc/prometheus/alertmanager.yml` (alertmanager runs via prometheus pkg; there is no /etc/alertmanager) |
| `grafana/provisioning/` | `/etc/grafana/provisioning/` |
| `grafana/dashboards/` | `/var/lib/grafana/dashboards/` (empty as of snapshot) |

Apply flow: edit here → `scp` to the live path → `systemctl reload prometheus
prometheus-alertmanager` (grafana picks up provisioning changes automatically).
No secrets live in these files (verified by grep at commit time) — webhook URLs,
if ever added to alertmanager.yml, must be env-injected or kept out of the repo.

Verify after apply: `curl -s localhost:9090/-/healthy` (Prometheus),
`curl -s localhost:9093/-/healthy` (Alertmanager), Grafana `/-/healthy` on :3000.
