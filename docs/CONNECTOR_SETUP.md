# Connector Setup (Production)

The allternit platform ships with three first-party connector surfaces:

| Connector | Backend | What the operator must set up |
|-----------|---------|-------------------------------|
| **Allternit Mail** | `services/mailflare` (vendored fork) on the user's Cloudflare account | Run `services/mailflare/setup.sh` |
| **Gmail** | `services/open-connector` sidecar (Google OAuth) | Create a Google Cloud OAuth app, run `scripts/setup-google-oauth.sh` |
| **Google Drive** | `services/open-connector` sidecar (Google OAuth) | Same Google OAuth app as Gmail |

End-users connect their accounts from the connector marketplace in the UI. This
document covers the one-time operator steps.

## Prerequisites

- The platform is deployed and reachable at a public origin (e.g.
  `https://ai.example.com`).
- The open-connector sidecar is running and healthy.
  - Local dev: run `./dev/scripts/start-connector-sidecar.sh` (it installs
    `services/open-connector` dependencies automatically if they are missing).
  - Production: deploy the sidecar via Docker/Cloudflare per
    `services/open-connector/docs/`.
- `.env` sets `ALLTERNIT_PUBLIC_BASE_URL` to the public origin.

## 1. Allternit Mail

See [`services/mailflare/README.md`](../services/mailflare/README.md). In short:

```bash
cd services/mailflare
./setup.sh
```

The installer supports two outbound transports:

- `cloudflare` (default) — uses Cloudflare Email Sending; requires the Workers
  Paid plan.
- `resend` — uses [Resend](https://resend.com); free tier 100 emails/day and
  works on the free Workers plan. The installer automates Resend domain creation,
  DNS records, and verification.

When the installer finishes it writes `ALLTERNIT_MAILFLARE_URL`,
`ALLTERNIT_MAILFLARE_ADMIN_KEY`, `ALLTERNIT_BOT_EMAIL_DOMAIN`, and
`ALLTERNIT_MAILFLARE_WEBHOOK_SECRET` into the repo-root `.env`.

## 2. Gmail + Google Drive

Google does not allow third-party OAuth apps to be created through an API, so
this step is split: the operator creates the app in Google Cloud, then a setup
script registers the resulting credentials in the open-connector sidecar vault.

### 2.1 Create the Google Cloud OAuth app

1. Open [Google Cloud Console → APIs & Services → Credentials](https://console.cloud.google.com/apis/credentials).
2. Click **Create credentials → OAuth client ID**.
3. Choose **Web application**.
4. Under **Authorized redirect URIs**, add:
   ```
   https://<your-public-origin>/oauth/callback
   ```
   For local development use `http://127.0.0.1:8013/oauth/callback`.
5. Enable the Gmail API and Google Drive API for the project.
6. Copy the **Client ID** and **Client secret**.

### 2.2 Register the credentials in the sidecar

Make sure the sidecar is running, then run:

```bash
./scripts/setup-google-oauth.sh
```

The script will:

- read the sidecar URL and admin token from `.env` or
  `/tmp/allternit-connector-sidecar.env`
- prompt for the Gmail and Google Drive client ID/secret (usually the same app)
- call `PUT /api/oauth/configs/gmail` and `PUT /api/oauth/configs/googledrive`
- store the public origin and client IDs in `.env` for documentation

Non-interactive use:

```bash
export ALLTERNIT_PUBLIC_BASE_URL=https://ai.example.com
export GMAIL_CLIENT_ID=...
export GMAIL_CLIENT_SECRET=...
export GOOGLE_DRIVE_CLIENT_ID=...
export GOOGLE_DRIVE_CLIENT_SECRET=...
./scripts/setup-google-oauth.sh
```

Client secrets are stored only in the sidecar vault, never in `.env`.

### 2.3 Verify

In the UI, open the connector marketplace. Gmail and Google Drive should now
show **Connect** instead of a setup-hint message. Connecting an account will
start the normal Google consent flow and redirect back to
`<public-origin>/oauth/callback`.

## Environment reference

| Variable | Purpose |
|----------|---------|
| `ALLTERNIT_PUBLIC_BASE_URL` | Public origin of allternit-api; used for OAuth redirect URIs. Must match `OOMOL_CONNECT_ORIGIN` on the sidecar. |
| `ALLTERNIT_CONNECTOR_SIDECAR_URL` | Loopback URL of the sidecar (default `http://127.0.0.1:8014`). |
| `ALLTERNIT_CONNECTOR_SIDECAR_ADMIN_TOKEN` | Bearer token for sidecar admin API. |
| `ALLTERNIT_CONNECTOR_SIDECAR_RUNTIME_TOKEN` | Bearer token for sidecar `/v1` runtime API. |

## Troubleshooting

**"oauth_app_not_configured" when connecting Gmail/Drive**
Run `scripts/setup-google-oauth.sh` and make sure the redirect URI in the
Google app exactly matches `<ALLTERNIT_PUBLIC_BASE_URL>/oauth/callback`.

**"redirect_uri_mismatch" during Google consent**
The public origin changed, or the Google app is missing the redirect URI.
Re-run the setup script with the correct `ALLTERNIT_PUBLIC_BASE_URL` and update
the Google app accordingly.

**Sidecar not reachable**
The setup script needs a running sidecar. Start it with
`./dev/scripts/start-connector-sidecar.sh` (dev) or the production equivalent.
