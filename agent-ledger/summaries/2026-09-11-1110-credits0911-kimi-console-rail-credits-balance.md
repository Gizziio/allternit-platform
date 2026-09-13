# Session summary — credits0911 (kimi-code)

> 2026-09-11 · PR #342 (merge e6bea0466) · branch `session/credits0911`

## What was done

Made the console rail's money row real. PR #331 left it as "Spend" (monthly cost
from `/api/v1/costs/summary`) because no balance endpoint was known at the time.
Investigation found the balance endpoint already live: `GET /api/v1/billing/credits`
(allternit-cloud-api, user-scoped, returns `balance_usd`) — the same source the
BillingPage credits panel uses. No Rust changes were needed.

- `surfaces/platform.allternit.com/src/lib/credits.ts` (new) — `getCreditsBalance(token)`
  wrapping `/api/v1/billing/credits` with the same base-URL + Clerk Bearer pattern
  as BillingPage, plus `formatCreditsUsd`.
- `surfaces/platform.allternit.com/src/components/ConsoleLayout.tsx` — rail row is now
  "Credits" showing the live `balance_usd` as $X.XX (Claude-rail parity); on error or
  when billing isn't configured it falls back to "—" and still links to /billing.
  The `getCostSummary` dependency was removed from the rail (dashboard still shows
  spend via PlatformUsageDashboard).

Note on backend landscape (for future sessions): there are three separate "credits"
systems — the fabric org ledger (`/api/v1/credits/balance` in allternit-api, org-scoped,
SQLite), the user wallet (`/api/v1/billing/credits` in allternit-cloud-api, Postgres —
what the console now uses), and an admin fallback-provider policy ledger
(`/api/v1/admin/fallback-credits*`, unrelated). Consolidation is a bigger decision
than this session.

## Verification evidence

- `npm run typecheck` — clean; `npm run build` — green.
- Playwright smoke (Chrome headless, VITE_DEV_AUTH_BYPASS=1, dev server on :3020)
  with the credits endpoint mocked: rail renders "Credits $4.98" (screenshot
  `/tmp/credits-rail.png` during the run).

## Incidents / deferrals

- Vercel checks on PR #342 fail with the account-level "Deployment rate limited —
  retry in 24 hours" state seen since earlier today; GitHub checks all passed.
- Desktop rebuild skipped: platform.allternit.com Pages surface only, nothing the
  desktop bundles.
