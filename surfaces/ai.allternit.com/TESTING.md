# Testing the Allternit Platform

## Clerk test account

We use one shared production test account for development and automated tests:

- **Email:** `cartlidge.joseph@yahoo.com`
- **Password:** see the gitignored `.env.local` in this worktree
- **Clerk domain:** `clerk.allternit.com`
- **Primary origin:** `https://platform.allternit.com`
- **Secondary origin:** `https://ai.allternit.com`

The account is verified and has an active organization membership, so sign-in lands on `/shell` instead of the onboarding wizard.

## Local dev auto-login

Copy `.env.example` to `.env.local` and make sure these lines are filled in:

```bash
VITE_CLERK_SEED_EMAIL=cartlidge.joseph@yahoo.com
VITE_CLERK_SEED_PASSWORD=<password from existing .env.local>
```

When `pnpm dev` starts, the app automatically signs in as the test user on page load. No manual sign-in is required while building features.

## Manual sign-in

If you prefer not to use auto-login, visit:

- `https://platform.allternit.com/sign-in`
- `https://ai.allternit.com/sign-in`

Use the email and password above.

## Automated smoke tests

Two scripts exercise the production Clerk flow:

```bash
# Full stress suite (21 scenarios, ~90s including token-refresh wait)
node scripts/clerk-stress-test-v4.mjs

# Lightweight smoke test
node scripts/clerk-e2e-verify.mjs
```

Both scripts auto-load `.env.local` via `dotenv`, so they work without command-line credentials as long as `CLERK_TEST_PASSWORD` is set in `.env.local`.

## Environment file rules

- **`.env.example`** is committed and documents the variables.
- **`.env.local`** is gitignored and holds the real password.
- **Never commit the password** to the repo.

If you are in a fresh worktree, copy `.env.local` from an existing worktree or ask the session lead for the password.
