# Steering checkpoint

Goal: Unblock production blockers — Tailscale OAuth secrets, mail migrations/seed, retire 8013 proxy on api.allternit.com, land a working CI deploy.

Just did:
- Set GitHub secrets `TS_OAUTH_CLIENT_ID` / `TS_OAUTH_CLIENT_SECRET` / `CONTABO_SSH_KEY`.
- On `mail`: applied migrations_pg 012–014 via psql; set `ALLTERNIT_DP_JWT_SEED` + `ALLTERNIT_SKIP_MIGRATIONS=1` (prod `_sqlx_migrations` is the sqlite-derived 1–24 lineage — sqlx::migrate! would checksum-fail).
- Retired api.allternit.com 8013 location blocks + cors-map; `/api/jobs` is now 401 from cloud-api. mail.news.allternit.com → 8013 left in place (company desktop-cloud).
- Root SSH via public IP works; workflow deploy host switched to 45.84.138.187, Tailscale join is continue-on-error.

Next: commit/push this workflow tweak, merge PR #91, watch test+deploy; after swap verify `/api/v1/auth/dp-jwks` returns OKP.

Open questions: add tailnet ACL `tag:ci → tag:mail` later so deploys can leave the public IP path.
