# Session desktop-clerk-proxy-20260910 — desktop Clerk OAuth (GitHub) fix

**Agent:** Kimi Code (session `desktop-clerk-proxy-20260910`)
**Date:** 2026-09-10
**PR:** #261 — merge commit `f71795005280723e28b86a9757d28afa9fd7bcb0`
**Branch:** `session/desktop-clerk-proxy-20260910` (deleted after cleanup)

## What was broken

Desktop GitHub (and Google) sign-in via Clerk failed with `authorization_invalid`
(clerk_trace_id JSON), and after the instance-proxy change surfaced as the
marketing site's Vercel "404 page not found". The web app (ai.allternit.com)
worked the whole time.

## Root cause (proven, not theorized)

Clerk's `/v1/oauth_callback` exchange only succeeds as a **real browser
navigation carrying the attempt-bound `__client` cookie** — every fetch/replay
variant (curl, `net.fetch`, `session.fetch` with injected Cookie header) is
rejected with `authorization_invalid`. The desktop auth window is served via
`protocol.handle('https')`, which strips partition cookies from real
navigations, so the callback went out without `__client`.

Controlled experiments that pinned this down:
- Pure-curl replay of a fresh, unconsumed code+state+`__client` triple → rejected.
- Web-origin attempt (`ai.allternit.com`) via real navigation → **succeeded**.
- Desktop-origin attempt (`accounts.allternit.com`) via real navigation → **succeeded**
  (so the Origin was never the problem — no Clerk dashboard change needed).
- A live `webRequest`/navigation trace showed the exchange succeeding every run;
  the app's failure was detection: FAPI does **not** append
  `created_session_id` to the redirect for clerk-js-created attempts (only for
  API-created ones), and the first fix iteration required that param.

## The fix

`surfaces/allternit-desktop/src/main/clerk-oauth-popup.ts` (rewritten):
- OAuth popup runs in the **default session** (real cookie jar; reuses the
  user's existing GitHub/Google session — no credential re-entry).
- The attempt's `__client` is copied from the auth partition into the popup
  session before launch (`setCookieOnSession`, with `__Host-`/`__Secure-`
  prefix rules handled).
- The provider redirect chain completes as real navigations; finish detection
  is pre-dispatch via `webRequest.onBeforeRequest` (success = redirect to the
  auth renderer's `redirect_url`; failure = any `err_code` redirect).
  `webContents will-redirect` does not reliably fire for the cross-origin 302,
  and custom-partition `webRequest` does not observe these navigations on this
  Electron version — both are documented in code comments.
- On success, the signed-in Clerk cookies are copied into the auth partition
  and the auth renderer reloads; clerk-js then sees the session and
  TokenBridge completes runtime pairing.
- Side effect (intentional): the pairing session's `__client` remains in the
  default session, so the built-in platform browser is signed in as the
  pairing user afterwards.

Also landed (approved "option 2"): `clerkProxyUrl: https://allternit.com/__clerk`
threaded from `resources/company.json` → `build-auth-renderer.cjs` →
`clerk-config.json` → `proxyUrl` on ClerkProvider; example config updated.
Debug scaffolding (`ALLTERNIT_AUTH_DEBUG` logging incl. a JWT-to-log line, and
the callback-URL debug branch) fully removed.

## Verification

- Live smoke in the dev app: GitHub authorize → exchange completed → Clerk
  token (GitHub-linked account) → pairing lookup/approve/exchange 200 →
  identity saved → paired relay connected; platform window loads signed in.
- `npm run typecheck` ✓, `npm run build:main` ✓ (surfaces/allternit-desktop),
  `node scripts/release-preflight.mjs` → 35/0.
- Merge required resolving a `.steering/checkpoint.md` conflict against
  origin/main (kept session's checkpoint).

## Ops notes for the operator

- GitHub OAuth app (`Ov23limDVkYsC7niHPzk`): keep BOTH callback URIs
  (`https://allternit.com/__clerk/v1/oauth_callback` AND
  `https://clerk.allternit.com/v1/oauth_callback`). Homepage URL cosmetic only.
- No Clerk dashboard change was needed; the failure was entirely in the
  desktop callback delivery.
- New agent test mailbox `clerk-test@news.allternit.com` (created by the
  parallel session) is recorded in `~/CLERK_SESSION_STATUS.md`; not wired into
  this fix (OAuth path doesn't use email codes).

## Honest deferrals

- The popup briefly shows the hosted Account Portal only in failure paths; on
  success it closes before the portal renders.
- Desktop preview DMG rebuild from merged main runs after this attestation
  (repo ritual step 8); the fix is source-verified, the binary refresh follows.
