# Testing / agent auth notes — ai.allternit.com

## Shared development test account

- **Email:** `cartlidge.joseph@yahoo.com`
- **Password:** kept in the team password manager — ask the account owner.

> ⚠️ **2026-09-03 security note:** the password for this account was previously
> committed in this file and has been scrubbed. It must be **rotated** — git
> history still contains it. Do not re-commit it here.

This account is verified in the production Clerk instance and works across
`ai.allternit.com`, `platform.allternit.com`, and any other `.allternit.com`
subdomain that proxies Clerk through `/__clerk/*`.

## Local development

```bash
cd surfaces/ai.allternit.com
cp .env.example .env.local
# Add NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY and any other required secrets.
pnpm install
pnpm dev
```

### Skip auth in local dev

Set in `.env.local`:

```bash
VITE_DEV_AUTH_BYPASS=1
```

The shell will render with a mock signed-in user.

### Auto-sign-in the test account

Add to `.env.local`:

```bash
VITE_CLERK_SEED_EMAIL=cartlidge.joseph@yahoo.com
VITE_CLERK_SEED_PASSWORD=<password from team password manager>
```

The platform auth client automatically signs in and activates an organization
on startup.

## Running the Clerk smoke test

```bash
CLERK_TEST_PASSWORD=<password from team password manager> \
  node surfaces/ai.allternit.com/scripts/clerk-e2e-verify.mjs
```

## Running the full Clerk stress test

```bash
CLERK_TEST_PASSWORD=<password from team password manager> \
  HEADLESS=0 \
  node surfaces/ai.allternit.com/scripts/clerk-stress-test-v4.mjs
```

The stress suite validates sign-in/out, cross-subdomain session sharing, OAuth
redirect initiation, and token refresh.
