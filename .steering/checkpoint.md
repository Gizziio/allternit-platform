# Checkpoint — session/desktop-clerk-proxy-20260910

## Goal
Fix desktop Clerk GitHub OAuth (authorization_invalid → Vercel 404) and land via merge.

## Just did
- Root cause proven by controlled experiments (E2/E3): Clerk's /v1/oauth_callback
  exchange only succeeds as a real browser navigation carrying the attempt-bound
  __client cookie; the old flow loaded the callback in the protocol-handled auth
  window where partition cookies are stripped from real navigations.
- Rewrote src/main/clerk-oauth-popup.ts: default-session popup, copy attempt
  __client from auth partition pre-flight, webRequest pre-dispatch detection of
  success (redirect to accounts.allternit.com/__desktop_auth__ — note: FAPI does
  NOT append created_session_id for clerk-js-created attempts) and failure
  (err_code), signed-in cookies handed back into the auth partition, auth window
  reloads so TokenBridge completes pairing.
- Live smoke PASSED: GitHub authorize → exchange → Clerk token → pairing
  lookup/approve/exchange 200 → identity saved → relay connected.
- typecheck ✓ build:main ✓ release-preflight 35/0 ✓

## Next
- Commit + push + PR + merge; sync main; ledger attestation; rebuild desktop preview; cleanup.

## Open questions
- Instance-proxy config (option 2, company.json clerkProxyUrl) rides along as approved.
