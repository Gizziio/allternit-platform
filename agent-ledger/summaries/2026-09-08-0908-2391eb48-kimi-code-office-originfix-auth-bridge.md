# Attestation — Office add-in origin fix: trust only Allternit referrers, auth bridge on ai.allternit.com

- **Session:** originfix / originfix2 (attested by 2391eb48, kimi-code)
- **Date:** 2026-09-08
- **Branches:** `session/originfix` → **PR #129** → 302e61def; `session/originfix2` → **PR #130** → b7fb8e0ee
- **Ledger entry:** [../LEDGER.md](../LEDGER.md)

## What was done

Fixed the hosted Office add-in's **Connect Allternit** flow failing with the Office AppDomains error (12004) in Word on the web. Root cause chain:

1. `getPlatformOrigin()` trusted `document.referrer`, which inside an Office task pane is `https://word-edit.officeapps.live.com` — the auth dialog was pointed at `word-edit.officeapps.live.com/office-auth-bridge` and Office refused. The real `/office-auth-bridge` Clerk page is served by the AI surface (`surfaces/ai.allternit.com/src/pages/OfficeAuthBridgePage.tsx`), not platform.allternit.com.
2. Follow-up (#130): `initializeBootstrap()` seeded `bootstrapState.platformOrigin` from the same untrusted referrer at startup, so `getPlatformOrigin()` returned the bogus origin before the #129 guard could run.

Fixes:

- **PR #129** — `platform-gateway.ts`: only trust referrer origins matching `*.allternit.com` or localhost, fall through to the build-time env URL otherwise; workflow env `ALLTERNIT_PLATFORM_URL` / `VITE_ALLTERNIT_PLATFORM_URL` → `https://ai.allternit.com` (deploy-cloudflare-pages.yml:170,172 — also lands in manifest AppDomains as PLATFORM_URL); manifests regenerated to **1.1.3.0** (e.g. manifests/word.xml:8).
- **PR #130** — same `*.allternit.com`/localhost allowlist applied at bootstrap seed time; no manifest change (still v1.1.3.0).

## How it works (file:line)

- `src/lib/platform-gateway.ts:93–104` — `getPlatformOrigin()` parses `document.referrer`, accepts only `/^https:\/\/([a-z0-9-]+\.)*allternit\.com$/` or localhost/127.0.0.1 with optional port, otherwise falls through to the build-time default (`DEFAULT_PLATFORM_ORIGIN = 'http://localhost:3013'` at platform-gateway.ts:7, overridden by env).
- `src/lib/platform-gateway.ts:192–202` — `initializeBootstrap()` applies the identical regex allowlist before seeding `bootstrapState.platformOrigin` from the referrer (the #130 fix); explicit `?platformOrigin=` param still wins at platform-gateway.ts:206–207.

## Verification evidence (from PR bodies)

- MS manifest validator: 'The manifest is valid.'; manifests carry `https://ai.allternit.com` AppDomain (v1.1.3.0).
- ai.allternit.com serves `/office-auth-bridge` via SPA fallback with 200 (verified `_redirects` `/* / 200` + routes.tsx route).
- #130 verified against the deployed bundle logic by the acceptance driver.

## Incidents

- **Two rounds were needed**: the #129 guard was bypassed by the bootstrap seed path, caught only by re-driving the live acceptance test — a reminder that origin-trust logic must be audited at every entry point, not just the obvious getter.
- The hosted pane depends on the isolated allternit-office-addins Pages deploy; the fix only reaches users after CI rebuilds + deploys the bundle (PR #127's symlink removal was a prerequisite to CI being green again).

## Honest deferrals

- The final **Connect Allternit re-drive in the live Chrome/Office session** was left as post-merge acceptance (pane bundle must be rebuilt + deployed by CI first); not re-confirmed end-to-end by this session at attestation time.
