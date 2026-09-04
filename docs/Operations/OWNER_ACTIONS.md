# Owner Actions — production & secrets

> **What this is:** the complete, owner-only action list for the API-consolidation
> work (PRs #85/#86/#88, 2026-09-04). Formatted like a secrets-rotation list:
> each item says what, where, how, and how to verify. Agents must NOT execute
> these — credentials, production hosts, and spending decisions are owner-only.
>
> **Last updated:** 2026-09-04 (session/routing + session/testdebt)

## 1. CI/CD credentials — unblocks cloud-api deploys

| | |
|---|---|
| **What** | Tailscale auth for the deploy workflow (currently fails with "OAuth identity empty") |
| **Where** | Tailscale admin console → OAuth clients (or auth keys); GitHub repo `Gizziio/allternit-platform` → Settings → Secrets |
| **How** | Create an OAuth client (or reusable pre-authorized auth key tagged `tag:ci` per `docs/Operations/CLOUD_API_VPS_DEPLOY.md`); set `TS_OAUTH_CLIENT_ID`/`TS_OAUTH_CLIENT_SECRET` (what the workflow reads) or `TS_AUTHKEY` per the workflow's inputs; ACL must allow `tag:ci` → `tag:mail:*` |
| **Verify** | Re-run the failed workflow run (`deploy-cloud-api-contabo.yml`); the `deploy` job joins Tailscale, swaps the binary on `mail`, health-checks, and goes green. The `test` job already passes |

## 2. Cloud-api production env (on `mail`, after CI deploy is unblocked)

| | |
|---|---|
| **What** | Apply migration `012_data_plane_nodes.sql` + set the data-plane JWT seed |
| **Where** | `ssh root@mail`; DB `allternit` (prod Postgres), env `/opt/allternit-cloud-api/.env` |
| **How** | `sudo -u postgres psql -d allternit -v ON_ERROR_STOP=1 -f …/migrations_pg/012_data_plane_nodes.sql` (idempotent — `IF NOT EXISTS`); then `openssl rand -base64 32` → add `ALLTERNIT_DP_JWT_SEED=<value>` to the env file; `systemctl restart allternit-cloud-api` |
| **Verify** | `curl -s localhost:8082/api/v1/health` → `{"status":"healthy"}`; `curl -s https://api.allternit.com/api/v1/auth/dp-jwks` → JSON with `keys[0].kty = "OKP"` (503 before the seed is set is expected/fail-closed) |
| **Note** | Until 012 is applied, the new agent-sessions/office/beta handlers return errors — they degrade gracefully, nothing else is affected |

## 3. Retire the live 8013 nginx proxy on `mail`

| | |
|---|---|
| **What** | Remove the interim proxy config deployed by the earlier hardening session |
| **Where** | `mail` at `/etc/nginx/conf.d/` — `allternit-cors-map.conf` (confirmed live 2026-09-03) and any `location` blocks proxying `/api/jobs`, `/api/v1/agent-sessions`, `/api/v1/office/`, `/api/v1/beta/`, `/api/rails/` to `127.0.0.1:8013` |
| **Why** | The repo config is deleted (ADR D4 retired) — P1 control-plane handlers replaced it. Leaving it live keeps 8013 publicly exposed for no purpose |
| **How** | Remove the proxy `location` blocks + the cors-map include; `nginx -t && systemctl reload nginx` |
| **Verify** | `curl -s -o /dev/null -w '%{http_code}\n' https://api.allternit.com/api/jobs` → 401 from **cloud-api** (check the `www-authenticate`/body shape), NOT a proxied 8013 response; `curl -s https://api.allternit.com/api/v1/health` still healthy |

## 4. Verify the dev-token backdoor is closed

| | |
|---|---|
| **What** | Confirm the `dev-api-token` bearer no longer authenticates in production |
| **Where** | any shell |
| **How** | `curl -s -o /dev/null -w '%{http_code}\n' -H "Authorization: Bearer dev-api-token" https://api.allternit.com/api/v1/auth/me` |
| **Expect** | **401** (was 200). Gate is `ALLTERNIT_ALLOW_DEV_TOKEN`, default OFF; never set it on `mail`. Coordinated-removal sequence is documented in `docs/Operations/CLOUD_API_VPS_DEPLOY.md` |

## 5. allternit-api repair migrations (VPS 8013 instance)

| | |
|---|---|
| **What** | 7 renumbered migrations (V124–V130) apply on next service start |
| **Where** | `mail`, systemd unit `allternit-api` (or wherever 8013 runs) |
| **How** | Nothing to prepare — just restart/deploy the service with PR #86's code |
| **Verify** | Journal shows 7 migrations applied; fabric offer/lease/pricing columns, desktop audit log, placement canonical fields, node capability JSON now exist. **This is the repair, not a fault** |
| **Caution** | The duplicate-route fix in #86 also removes a startup panic — any binary built between merge `ea89a5fdb` and #86 would crash at router construction; do not roll back past #86 |

## 6. Secrets rotation (from the 2026-09-03 audit — independent of this work)

| Secret | Where found | Action |
|---|---|---|
| TESTING.md password | `surfaces/ai.allternit.com/TESTING.md` (now removed from HEAD — **history still has it**) | Rotate the account; consider BFG/git-filter-repo |
| ProtonMail password + TOTP seed | committed in docs (audit A1) | Rotate password AND re-seed TOTP |
| Clerk `sk_test` key | `cmd/gizzi-code/script/platform-auth-server.js` (now env-var'd) | Rotate at clerk.allternit.com; **history still has it** |
| GitHub history | all of the above | gitleaks workflow added (`.github/workflows/secrets.yml`); run `gitleaks detect` clean on HEAD; history rewrite is your call |

## 7. Enable web features (when ready — product decision)

| | |
|---|---|
| **What** | Turn on the namespaces now served by the control plane |
| **Where** | `surfaces/ai.allternit.com/.env.production` |
| **How** | Set to `1`, one namespace at a time, in this order: `NEXT_PUBLIC_ALLTERNIT_AGENT_SESSIONS_API` → `NEXT_PUBLIC_ALLTERNIT_OFFICE_API` → `NEXT_PUBLIC_ALLTERNIT_BETA_API` → then the rest (`RAILS_API`, `RUNTIME_API`, `TOOLS_API`, `PERMISSIONS_API`, `QUESTIONS_API`, `MODEL_LAB_API`). Push → Pages deploys |
| **Verify** | Each flag: the widget works for a Clerk-signed-in user (428 "pair a device" message when the user has no registered node is the expected state, not a bug) |
| **Note** | Users without a paired/provisioned node get the deliberate "pair a device" state — that is the designed behavior until the P2 per-sub provisioning lane exists |

## 8. Deferred (no action needed now)

- **iOS Xcode build** — mobile changes merged; build in Xcode before the next app release (owner deferred). Release builds never sent the dev token, so there is no urgency.
- **Coverage gaps** — 21 rails data-plane routes (plan/gate/leases/context-packs) and canvas get/update/delete control-plane routes are flagged TODO in code; build when those features get users.
