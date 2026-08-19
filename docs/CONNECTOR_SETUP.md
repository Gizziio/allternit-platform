# Connector Setup (Production)

The allternit platform ships with three first-party connector surfaces:

| Connector | Backend | One-time operator setup |
|-----------|---------|-------------------------|
| **Allternit Mail** | `services/mailflare` (vendored fork) on the user's Cloudflare account | Deployed by `./scripts/install-connectors.sh` |
| **Gmail** | `services/open-connector` sidecar (Google OAuth) | Registered by `./scripts/install-connectors.sh` |
| **Google Drive** | `services/open-connector` sidecar (Google OAuth) | Registered by `./scripts/install-connectors.sh` |

End-users connect their accounts from the connector marketplace in the UI. This
document covers the one-time operator steps.

## Quick start — run the unified installer

The installer handles the sidecar, Allternit Mail provisioning, and Google OAuth
registration in one command:

```bash
./scripts/install-connectors.sh
```

It will:

1. Check prerequisites (Node.js, npm, curl, openssl).
2. Start the open-connector sidecar if it is not already running.
3. Deploy Allternit Mail to your Cloudflare account (via `services/mailflare/setup.sh`).
4. Register your Google OAuth app for Gmail and Google Drive (via `scripts/setup-google-oauth.sh`).
5. Verify everything is reachable and print a summary.

The script is idempotent: re-running it skips steps that are already complete.

### Non-interactive / CI use

```bash
export ALLTERNIT_PUBLIC_BASE_URL=https://ai.example.com

# Mailflare
export CF_TOKEN=...
export CF_ACCOUNT_ID=...
export MAILFLARE_ZONE=example.com
export ADMIN_PASSWORD=...

# Google OAuth
export GMAIL_CLIENT_ID=...
export GMAIL_CLIENT_SECRET=...
export GOOGLE_DRIVE_CLIENT_ID=...
export GOOGLE_DRIVE_CLIENT_SECRET=...

./scripts/install-connectors.sh --non-interactive
```

## Prerequisites

- A running allternit platform checkout (the installer assumes the repo is already
  built and runnable; it does not install Node/Rust/Python itself).
- The platform is reachable at a public origin (e.g. `https://ai.example.com`).
- `.env` exists or can be created from `.env.example`.
- For Allternit Mail: a Cloudflare account with a zone already on Cloudflare
  nameservers. The free Workers plan works if you choose the Resend transport;
  Cloudflare Email Sending requires the Workers Paid plan.
- For Gmail/Drive: a Google Cloud project where you can create an OAuth client ID.

## What the installer provisions

### Allternit Mail

The installer calls `services/mailflare/setup.sh`, which:

- Verifies a scoped Cloudflare API token.
- Provisions D1, R2, and Queues in your Cloudflare account.
- Deploys the `allternit-agent-mail` Worker.
- Configures Email Routing and DNS for `agents.<your-domain>`.
- Creates the first admin account and an admin-scope API key.
- Writes `ALLTERNIT_MAILFLARE_URL`, `ALLTERNIT_MAILFLARE_ADMIN_KEY`,
  `ALLTERNIT_BOT_EMAIL_DOMAIN`, and `ALLTERNIT_MAILFLARE_WEBHOOK_SECRET` into
  the repo-root `.env`.

The installer supports two outbound transports:

- `cloudflare` (default) — uses Cloudflare Email Sending; requires the Workers
  Paid plan.
- `resend` — uses [Resend](https://resend.com); free tier 100 emails/day and
  works on the free Workers plan. The installer automates Resend domain creation,
  DNS records, and verification.

Choose the transport when the installer prompts, or set `EMAIL_TRANSPORT`.

### Gmail + Google Drive

The installer calls `scripts/setup-google-oauth.sh`, which:

- Computes the exact redirect URI the Google app must allow.
- Starts the open-connector sidecar if needed.
- Registers the client id/secret for `gmail` and `googledrive` in the sidecar vault.
- Writes the public origin and client IDs into `.env` for documentation
  (secrets stay in the sidecar vault).

You still create the OAuth app once in Google Cloud Console; the script cannot
create it for you because Google does not allow OAuth app creation via API.
Steps:

1. Open [Google Cloud Console → APIs & Services → Credentials](https://console.cloud.google.com/apis/credentials).
2. Click **Create credentials → OAuth client ID**.
3. Choose **Web application**.
4. Under **Authorized redirect URIs**, add:
   ```
   https://<your-public-origin>/oauth/callback
   ```
   For local development use `http://127.0.0.1:8013/oauth/callback`.
5. Enable the Gmail API and Google Drive API for the project.
6. Copy the **Client ID** and **Client secret** and paste them when the installer asks.

## Verify

After the installer finishes, open the connector marketplace in the UI. If any
connector still shows a setup hint, the marketplace banner lists the missing
step and the exact recovery command.

You can also query the aggregate status endpoint directly:

```bash
curl -H "Authorization: Bearer <clerk-token>" \
  https://<your-public-origin>/api/v1/connectors/setup-status
```

## Environment reference

| Variable | Purpose |
|----------|---------|
| `ALLTERNIT_PUBLIC_BASE_URL` | Public origin of allternit-api; used for OAuth redirect URIs. Must match `OOMOL_CONNECT_ORIGIN` on the sidecar. |
| `ALLTERNIT_CONNECTOR_SIDECAR_URL` | Loopback URL of the sidecar (default `http://127.0.0.1:8014`). |
| `ALLTERNIT_CONNECTOR_SIDECAR_ADMIN_TOKEN` | Bearer token for sidecar admin API. |
| `ALLTERNIT_CONNECTOR_SIDECAR_RUNTIME_TOKEN` | Bearer token for sidecar `/v1` runtime API. |
| `ALLTERNIT_MAILFLARE_URL` | Deployed mailflare worker URL. |
| `ALLTERNIT_MAILFLARE_ADMIN_KEY` | Admin-scope mailflare API key. |
| `ALLTERNIT_BOT_EMAIL_DOMAIN` | Agent email domain, e.g. `agents.example.com`. |

## Troubleshooting

**"Some checks failed" at the end of the installer**
Read the per-check failure message. Common causes:
- Cloudflare token missing a permission group — the installer prints the exact missing group.
- Google redirect URI mismatch — make sure the Google app allows `<ALLTERNIT_PUBLIC_BASE_URL>/oauth/callback`.
- Sidecar not reachable — re-run `./scripts/install-connectors.sh` without `--skip-sidecar`.

**Re-run a single phase**

```bash
# Re-run only the mailflare phase
./scripts/install-connectors.sh --skip-google-oauth

# Re-run only the Google OAuth phase
./scripts/install-connectors.sh --skip-mailflare

# Ignore saved state and re-run both phases
./scripts/install-connectors.sh --reconfigure
```

**"oauth_app_not_configured" when connecting Gmail/Drive**
Run `./scripts/install-connectors.sh` and make sure the redirect URI in the
Google app exactly matches `<ALLTERNIT_PUBLIC_BASE_URL>/oauth/callback`.

**"redirect_uri_mismatch" during Google consent**
The public origin changed, or the Google app is missing the redirect URI.
Re-run the installer with the correct `ALLTERNIT_PUBLIC_BASE_URL` and update
the Google app accordingly.

## Appendix — manual steps

If you prefer not to use the unified installer, the underlying scripts are:

1. Start the sidecar: `./dev/scripts/start-connector-sidecar.sh`
2. Set up Allternit Mail: `cd services/mailflare && ./setup.sh`
3. Register Google OAuth: `./scripts/setup-google-oauth.sh`

See the individual script `--help` output and `docs/AGENT_EMAIL_RAIL.md` for details.
