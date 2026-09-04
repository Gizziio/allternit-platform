# Secrets Rotation Runbook — execution guide (2026-09-04)

**Companion doc:** `reports/2026-09-04-secrets-rotation-hygiene-handoff.md` (evidence + history-purge options).
**Do these in order.** Each step lists: where to rotate → where the new value must be updated → how to verify.
No code changes are needed at HEAD — everything already reads env vars. Only **two** in-repo secret stores
exist: the GitHub secret `CLERK_SECRET_KEY` and host-side env files. Everything else is dashboard + password manager.

---

## Step 1 — Stripe secret keys (blast radius: billing) ⚠️ causes brief billing outage

**Rotate:**
1. dashboard.stripe.com → Developers → API keys → **roll the secret key** (creates new, invalidates old immediately).
2. Developers → Webhooks → open each endpoint → **roll the endpoint's signing secret** too.

**Update immediately after rolling** (old key dies the moment you roll):
| Location | What |
|---|---|
| Contabo VPS | `/etc/allternit-api/api.env` → `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` (chmod 600), restart allternit-api |
| Railway dashboard | `allternit-cloud-api` service variables → same two vars, redeploy |
| (only if gizzi console is deployed) | `cd cmd/gizzi-code && sst secret set STRIPE_SECRET_KEY ...` — manual path, no CI |

**Verify:**
- `curl https://api.allternit.com/api/v1/billing/checkout` (authed) → 200, not 503 `billing_not_configured`.
- Stripe dashboard → Webhooks → endpoint shows successful deliveries after restart.
- Live: run a $0/1¢ test checkout via platform.allternit.com.

## Step 2 — Clerk secret key `sk_test_37qh…`

**Rotate:** dashboard.clerk.com → API Keys → rotate secret key.

**Update:**
| Location | What |
|---|---|
| GitHub repo secret | `gh secret set CLERK_SECRET_KEY` (used by `.github/workflows/configure-clerk-organization.yml`) |
| Clerk proxy Worker | `cd infrastructure/clerk-proxy && wrangler secret put CLERK_SECRET_KEY` (serves `*/__clerk/*` on all 3 domains — breaking this breaks sign-in everywhere) |
| Contabo VPS + Railway | cloud-api env `CLERK_SECRET_KEY`, restart/redeploy |
| Local dev | `surfaces/ai.allternit.com/.env.local` → `CLERK_SECRET_KEY` |

**Verify:** sign in/out on ai.allternit.com and platform.allternit.com; run
`node surfaces/ai.allternit.com/scripts/clerk-e2e-verify.mjs` (should pass; fail-closed user_trust gate trips if unset).

## Step 3 — Clerk test-account password `Tyhvix-gafho2-bofxog`

**Rotate:** dashboard.clerk.com → Users → the test user (`cartlidge.joseph@proton.me`) → reset password.

**Update:** team password manager only. Test/screenshot scripts read `ALLTERNIT_TEST_PASSWORD` / `CLERK_TEST_PASSWORD`
from your shell env — nothing in CI, nothing on servers. Re-export in your shell.

**Verify:** `node surfaces/ai.allternit.com/scripts/clerk-e2e-verify.mjs` passes with the new password.

## Step 4 — ProtonMail password + TOTP seed

**Rotate:** account.proton.me → Settings → Account → change password; Security → disable 2FA → re-enable with new seed.
(Save the new OTP seed in the password manager — `capture-e2e-auth.mjs` needs it as `ALLTERNIT_TEST_OTP`.)

**Update:** password manager + your shell env. No server or CI references.

**Verify:** `node surfaces/ai.allternit.com/capture-e2e-auth.mjs` completes without exit 1.

## Step 5 — Sourcegraph tokens (22 findings, all in history)

**Rotate:** sourcegraph.com → Settings → Access tokens → revoke all listed tokens.

**Update:** nothing — verified zero live usage at HEAD (no code, workflow, or config reads Sourcegraph vars).

**Verify:** any old CI/scripts referencing them were already dead; no action.

## Step 6 — link-card-service private key

**Nothing to rotate** — verified dead: no workflow, Dockerfile, or deploy script starts the service; the only
out-of-archive references are an unused port constant and unrelated port collision. Confirm-nothing step is done.

---

## After all six: agent-side cleanups (hand to an agent)

1. `gitleaks detect --no-git` → still 0 leaks.
2. Drop the `.gitleaks.toml` allowlist entry for `.steering/checkpoint.md` (exists only because the checkpoint quotes the dead dev-api-token).
3. Update the `.gitleaks.toml` history-note comment → rotation completed 2026-09-04.
4. Optional cosmetic purge per the handoff doc (`bfg ...` + force-push — coordinate, main may have diverged).
5. Confirm CI `.github/workflows/secrets.yml` green on next push.

## Notes / cautions

- **Order matters:** Step 1 is the only one with user-facing impact (billing 503s between roll and env update).
  Do it in a quiet window and have the VPS/Railway dashboards open before you click "roll".
- Stripe `pk_live_…` / Clerk `pk_test_…` publishable keys in history are **not secrets** — no action.
- The 135 generic-api-key entropy hits and SSH test fixtures are triaged non-issues per the handoff doc — skip.
