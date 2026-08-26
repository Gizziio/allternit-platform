# Steering spec — fix cloud API pairing-approve 500 and desktop follow-ups

## Requirements

- [x] R1: Local repro against the production DB snapshot must either reproduce
  the exact sqlx error or definitively rule out the current code/DB state as
  the cause (deployed-binary skew hypothesis).
- [x] R2: `ApiError` details must be logged server-side before the sanitized
  public response is built, so fly logs show the real failure reason.
- [x] R3: `approve_pairing` must upsert the `users` row before writing to
  `user_runtime_quotas` and `user_pairing_usage`, eliminating a latent FK
  failure for first-time users if SQLite foreign-key enforcement is enabled.
- [x] R4: The existing uncommitted `ios` runtime-type allowance in
  `runtime_pairing.rs` must be preserved.
- [x] R5: After the changes, the cloud API must pass its own cargo tests and a
  local pairing-approve end-to-end against the prod DB snapshot must succeed.
- [x] R6: The production Clerk publishable key must be baked into
  `resources/company.json` so desktop dev builds no longer rely on the env var.
- [x] R7: The platform `DispatchView` must render inside the desktop shell
  without requiring a Clerk `ClerkProvider` by using the platform auth context.
- [x] R8: The platform theme must default to `'system'` so it respects the OS
  light/dark preference on first launch.

## Acceptance (Gherkin)

- Scenario: pairing approve no longer returns opaque 500 locally
  Given the API is running against a copy of the production DB
  When a pending pairing is approved with a valid device token
  Then the response is 200 with status "approved".

- Scenario: server-side error detail is visible
  Given a route that raises an `ApiError::DatabaseError`
  When the response is built
  Then tracing logs contain the underlying sqlx error text.

- Scenario: first-time user ordering is safe
  Given a Clerk user that does not yet exist in `users`
  When `approve_pairing` runs
  Then the `users` row is inserted before any quota/usage write.

- Scenario: desktop dev build uses prod Clerk key
  Given `resources/company.json` has the prod `clerkPublishableKey`
  When `npm run build:auth-renderer` runs
  Then it reports `Clerk key source: company.json`.

- Scenario: Dispatch loads in the desktop shell
  Given the desktop app is signed in and loads the platform
  When the Dispatch view mounts
  Then it does not throw a `useAuth` / `ClerkProvider` error.

- Scenario: theme respects OS preference
  Given the platform has no persisted theme
  When the platform first loads
  Then it uses the OS light/dark preference.
