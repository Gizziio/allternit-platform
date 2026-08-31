# Testing / agent auth notes — platform.allternit.com

## Shared development test account

Use this real verified account when you need to sign in manually or run the
Clerk e2e stress tests. The account exists in the production Clerk instance
(`clerk.allternit.com`) and works on both `platform.allternit.com` and
`ai.allternit.com` because they share the `.allternit.com` cookie domain.

- **Email:** `cartlidge.joseph@yahoo.com`
- **Password:** `Tyhvix-gafho2-bofxog`

> Keep this account for development/testing only. Do not use it for production
> data or billing actions.

## Local development

```bash
cd surfaces/platform.allternit.com
cp .env.local.example .env.local
# Add the Clerk publishable key from the dashboard.
pnpm install
pnpm dev
```

The dev server runs on `http://localhost:3016`.

### Skip auth in local dev

If you are working on UI that does not need Clerk, set in `.env.local`:

```bash
VITE_DEV_AUTH_BYPASS=1
```

This mocks a signed-in user so the console renders without credentials.

### Auto-sign-in a test account in local dev

If you want the dev server to sign in automatically, add to `.env.local`:

```bash
VITE_CLERK_SEED_EMAIL=cartlidge.joseph@yahoo.com
VITE_CLERK_SEED_PASSWORD=Tyhvix-gafho2-bofxog
```

The platform auth client will attempt to sign in on startup and, if needed,
create/select a seed organization so the session is active.

## Production smoke test

```bash
# From the repo root
CLERK_TEST_PASSWORD=Tyhvix-gafho2-bofxog \
  node surfaces/ai.allternit.com/scripts/clerk-e2e-verify.mjs
```

The script signs in on `https://platform.allternit.com` and verifies the
sign-up form reaches Clerk.

## Full Clerk stress test

```bash
CLERK_TEST_PASSWORD=Tyhvix-gafho2-bofxog \
  HEADLESS=0 \
  node surfaces/ai.allternit.com/scripts/clerk-stress-test-v4.mjs
```

The stress suite covers sign-in, sign-out, wrong passwords, session sharing
across `platform.allternit.com` and `ai.allternit.com`, OAuth redirects, and
token refresh.

## Console surfaces to verify after changes

- `/` — Dashboard with usage/cost cards, paired device count, hosted runtime count, and the usage dashboard.
- `/organizations` — Organization access panel and org switcher.
- `/compute` — Compute billing panel with hosted runtime management.
- `/devices` — Paired runtime devices list, revoke action, and pairing-code approval.
- `/billing` — Plan card, monthly runtime usage meter, estimated cost, and upgrade link.
- `/api-keys` — Scoped API-key creation/revocation UI (keys are currently stored locally in the browser for UI testing; the backend contract is documented in `src/lib/api-keys.ts`).
- `/docs` — Documentation landing.
- `/settings` — Theme toggle, account info, and sign-out.

## Expected post-login behavior

- On `platform.allternit.com`, signing in lands you on `/` (the dashboard).
- On `ai.allternit.com`, signing in lands you on `/shell`.
- Signing in on either subdomain makes you authenticated on the other because
  Clerk session cookies are written for `.allternit.com` and proxied through
  each subdomain's `/__clerk/*` route.
