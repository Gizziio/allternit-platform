# Secrets Rotation + History Hygiene — Handoff (do later)

**Created:** 2026-09-04 by Kimi Code session b6d6153b · **Status:** USER-ACTION, no deadline set
**Context:** P0 gap-analysis Step 4/5 (merged to main @ `a0f8230b5`)

## What's already done (don't redo)

- HEAD is clean: `gitleaks detect --no-git` → 0 leaks. CI gate (`.github/workflows/secrets.yml`) scans all PR/push diffs going forward.
- The `dev-api-token` backdoor is **dead in production** (deployed 2026-09-03 ~22:35 local; live probe → 401).
- `archive/link-card-service/private.pem` deleted from HEAD.
- Clerk/ProtonMail secrets in source are now env-var required (throw if unset).

## Rotation checklist (dashboard work — only you can do it)

Ordered by blast radius. Full redacted evidence: regenerate with
`gitleaks detect --source . --redact --report-format json --report-path gitleaks-history.json` (219 findings, 1153 commits, ~2.1GB).

| Priority | Credential | Where to rotate | Where it lives in history |
|---|---|---|---|
| 1 | Stripe secret keys (12 findings) | dashboard.stripe.com → Developers → API keys → roll; review Webhook endpoint keys too | `cmd/gizzi-code/script/platform-auth-server.js` (×6), `platform-auth-server.{ts,js}.bak` (×4), `surfaces/allternit-platform/DEPLOYMENT_SECRETS.md` (×2) |
| 2 | Clerk sk_test_37qh7k8rZwwWu3QKPi2doqk10SabkYgIMCXEqkcQzi | dashboard.clerk.com → API Keys → rotate | gizzi `platform-auth-server.js`, ai.allternit.com `build-desktop-server.cjs` (both now env-required at HEAD) |
| 3 | Clerk test-account password `Tyhvix-gafho2-bofxog` | Clerk → Users → test user → reset password | both surfaces' TESTING.md + 3 platform screenshot scripts |
| 4 | ProtonMail password + OTP seed | Proton account settings → password + 2FA regen | `capture-e2e-auth.mjs` (now env-var'd) |
| 5 | Sourcegraph tokens (22 findings) | sourcegraph.com → Settings → Access tokens → revoke | `a2r-workspace/patches/` (3 patch files) |
| 6 | link-card-service private key | service is archived/dead — confirm nothing deployed uses it, then nothing to do | `archive/` + `services/infrastructure/link-card-service/private.pem` in history |

## History purge (optional hygiene, after rotation)

Rotation makes the history harmless; purging is cosmetic + defense-in-depth.

```bash
# BFG (brew install bfg) — deletes the known files entirely from history
bfg --delete-folders archive/link-card-service --delete-files "platform-auth-server.js.bak" --delete-files "DEPLOYMENT_SECRETS.md" .
# or target the specific blobs; then:
git reflog expire --expire=now --all && git gc --prune=now --aggressive
git push --force-with-lease   # coordinaate — other sessions may have branches off main
```

Cheaper alternative: leave history dirty (tokens are revoked by then anyway) and rely on the diff-only CI gate.

## Post-rotation / post-purge cleanups (small, agent-doable — hand back to an agent)

1. Drop the `.gitleaks.toml` allowlist entry for `.steering/checkpoint.md` (marked TODO — it exists only because the checkpoint quotes the dead dev-api-token as evidence).
2. **iOS field-build warning:** App Store/in-field iOS builds shipped the `dev-api-token` hardcoded (it was in `#if DEBUG` shims + AppConfig; release never shipped the literal per Step 5 analysis — **verify against any builds actually distributed**). If any distributed build used it, those builds now get 401 from prod and need an app update.
3. Re-run the rotation verification: `gitleaks detect --no-git` still 0; CI secrets workflow green on next push.
4. Update `.gitleaks.toml` history-note comment to reflect completed rotation.

## Known-non-issues (triaged, do not chase)

- 135 generic-api-key entropy hits — mostly fixtures/vendored code; triaged in `.gitleaks.toml`.
- `chrome-data/Default/Secure Preferences` (32 hits) — local browser profile junk in extension dirs.
- 19 private-key hits — link-card key (rotated above) + SSHKeyService/ssh_keygen **test fixtures** (generated in tests, not real keys).
