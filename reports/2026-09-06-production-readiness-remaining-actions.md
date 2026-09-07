# Production Readiness — Remaining Actions (2026-09-06)

Status: the 2026-09-06 readiness-assessment fixes are merged to main (see
`git log --oneline main` for the `session/*` merge commits). This document
tracks everything **only a human can finish** — dashboard access, paid
accounts, signing certificates, or secrets. Check items off as they land.

## P0 — Security exposure (do this week)

- [ ] **Rotate leaked credentials in git history** (HEAD is clean since the
      9/3 scrub; history is not). Per
      `reports/2026-09-04-secrets-rotation-hygiene-handoff.md`:
  - [ ] Stripe live keys (12 findings) — Stripe dashboard → roll the restricted key set
  - [ ] Clerk secret key (`sk_test_…`) — Clerk dashboard → regenerate
  - [ ] ProtonMail password + OTP seed — change password, re-seed 2FA
  - [ ] 22 Sourcegraph tokens — Sourcegraph → revoke and reissue
  - [ ] Purge large binaries from git history (5.8 GB `.git`) or accept and
        document the exposure window
- [ ] **Decommission the Railway service** (`allternit-cloud-api`). Repo-side
      files were deleted 2026-09-06 (Dockerfile never booted, so nothing on
      Railway can rebuild), but the dashboard service still holds env
      vars/secrets and must be removed by hand:
  - `npm i -g @railway/cli && railway login` (browser auth)
  - `railway link` → select the `allternit-cloud-api` service →
    `railway delete` (or delete the whole project in the dashboard)
  - Delete the stale service token from wherever CI kept `RAILWAY_TOKEN`
  - `reports/2026-09-04-secrets-rotation-runbook.md` references this service
    as an env-var holder — update it once deleted

## P1 — Unblocks shipping

- [ ] **Create 4 GitHub secrets** for the new post-deploy Clerk smoke job in
      `deploy-cloudflare-pages.yml` (`clerk-smoke-ai` job):
      `CLERK_TEST_EMAIL`, `CLERK_TEST_PASSWORD`,
      `CLERK_TEST_SECONDARY_EMAIL`, `CLERK_TEST_SECONDARY_PASSWORD`.
      Until these exist, every web deploy workflow will end red.
- [ ] **Desktop release v1.1.0** (the actual product — nothing installable
      exists yet):
  - [ ] Apple Developer ID Application certificate; add `CSC_LINK` /
        `CSC_KEY_PASSWORD` (and confirm `APPLE_ID*` / `APPLE_TEAM_ID`)
        secrets for the release workflow
  - [ ] Create the `allternit/desktop` GitHub repo (fixes auto-update feed,
        package.json `repository.url`, README download links, **and** the
        `prepare-api-binary` manifest download path — four birds)
  - [ ] Point `build.publish` and `manifest.ts update.desktopFeedUrl` at the
        same repo (currently says `Gizziio`)
  - [ ] Tag `desktop-v1.1.0` → `release-desktop.yml` does the rest
- [ ] **Decide what ai.allternit.com is.** Today: Clerk sign-in + pairing
      console; no backend, no inference path, no pricing page. Either give it
      a backend (cloud-api + inference keys) or make it an honest landing
      page routing to the desktop download. Until then the public surface
      overpromises.

## P2 — Hardening (next sprint)

- [ ] **Observability**: wire Sentry (or equivalent) into web + desktop; the
      homegrown client-error reporter now self-disables cleanly but still has
      nowhere real to report on the hosted site.
- [ ] **cloud-api integration tests don't run in CI** — the deploy gate runs
      `--lib` only; the `--tests` target now compiles (fixed 2026-09-06) but
      should be added to the gate job.
- [ ] **Test-environment landmines**: one lib test shells out to `docker`
      (fails on any runner/host without it) and one `allternit-api` fabric
      test needs the external AllternitOS runtime binary (marked
      `#[ignore]`). Either install docker in CI or gate these explicitly.
- [ ] **Uncommitted fixes sitting in the shared checkout** (fabric-session
      `_redirects`, CSP loosening for Clerk, `.env.production` dedup) —
      review the 252-file dirty `feat/desktop-apps-extensions` tree and land
      or discard; the fabric-session PWA route is broken on the live site
      until the `_redirects` fix deploys.
- [ ] **Follow-up code debt** (from 2026-09-06 work, non-blocking):
      thread shutdown handles into the 5 library-spawned loops in
      allternit-api; decide the `audit_log.details` text-vs-Json model
      mapping before anything reads it; add a dependency-cruiser/knip check
      to catch the next undeclared-dependency bug.
- [ ] **iOS**: zero CI, zero tests, can't build from a fresh checkout
      (`Mesh.xcframework` gitignored). Either stand up a minimal
      build/testflight workflow or take iOS out of the pitch until parity
      work resumes.
