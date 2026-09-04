# Steering checkpoint

Goal: Unblock production blockers with the owner — item 1: Tailscale auth for the cloud-api CI deploy (fails "OAuth identity empty"); then items 2–3 on `mail` (migration 012 + DP JWT seed; retire live 8013 nginx proxy).

Just did:
- Confirmed live: `secrets.TS_AUTHKEY` empty → deploy job dies at the Join Tailscale step (run 33919223298). `test` job passes.
- Switched `.github/workflows/deploy-cloud-api-contabo.yml` from deprecated `authkey` input to OAuth client (`TS_OAUTH_CLIENT_ID` / `TS_OAUTH_CLIENT_SECRET` + `tags: tag:ci`); header comment updated. YAML validated.
- Updated `docs/Operations/CLOUD_API_VPS_DEPLOY.md` one-time setup (OAuth client, Auth keys/Write scope, tag:ci) and `docs/Operations/OWNER_ACTIONS.md` item 1 to match.

Next: owner creates the OAuth client in the Tailscale admin console and pastes id+secret here → I `gh secret set` both, merge this branch (merge push triggers full test+deploy), watch run to green. Owner also needs the tailnet ACL `tag:ci → tag:mail:*` (+ ssh check rule, or CONTABO_SSH_KEY) for the deploy step's SSH.

Open questions: whether the existing tailnet ACL already allows tag:ci SSH into mail (owner to check at login.tailscale.com/admin/acl); if not, add the ssh check rule or provide CONTABO_SSH_KEY.
