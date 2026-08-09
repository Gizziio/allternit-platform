---
status: done
files_changed:
  - cmd/gizzi-code/src/cli/commands/auth.ts
  - cmd/gizzi-code/src/runtime/context/config/auth-profiles.ts
  - cmd/gizzi-code/src/runtime/context/config/config.ts
  - cmd/gizzi-code/src/runtime/context/config/credential-store.ts
  - cmd/gizzi-code/test/config/auth-profiles.test.ts
  - cmd/gizzi-code/test/config/config.test.ts
  - cmd/gizzi-code/test/config/credential-store.test.ts
deviations:
  - The full `bun test` suite contains pre-existing failures unrelated to Phase 3 (missing modules, external-service tests, timeouts). The new/modified auth/config tests pass.
remaining:
  - Wire a real OS keyring backend into KeyringCredentialWriter.
  - Implement OAuth login path in `gizzi auth login` (Phase 4 or later).
  - Surface credential_store in interactive `gizzi config` flows.
---

# Swarm D — Phase 3 Notes

## What changed

### API key authentication for CLI

- Added `gizzi auth login --api-key <key> [--provider <id>] [--profile <name>]`.
  - Stored in the active/default auth profile (`default` if not specified).
  - Respects the `auth.credential_store` config value.
- Added `gizzi auth status`.
  - Reports `oauth_token` when the runtime auth store contains an OAuth entry.
  - Reports `api_key` when an active auth profile resolves to a key.
  - Reports `none` otherwise.

### Keyring support scaffold

- New `CredentialWriter` interface in `src/runtime/context/config/credential-store.ts`.
- `FileCredentialWriter` for filesystem-backed secrets.
- `KeyringCredentialWriter` that delegates to a pluggable `KeyringBackend`.
  - Default backend throws "keyring backend not configured", so `"auto"` falls back to file safely.
- `createCredentialWriter("file" | "keyring" | "auto")` factory.
- `"auto"` prefers keyring and falls back to file on failure.

### Config schema

- Added `auth.credential_store` field to `Config.Info` in `src/runtime/context/config/config.ts`.
- Valid values: `"file"`, `"keyring"`, `"auto"`.
- Default remains `"file"` for deterministic tests.

### Auth profile modules

- `src/runtime/context/config/auth-profiles.ts` gained:
  - `credential_store` read/write in config.toml.
  - `loginApiKey()` — stores API key according to credential_store.
  - `resolveApiKey()` — resolves keys from config, env var, or keyring.
  - `getAuthStatus()` — distinguishes OAuth token vs API key vs none.

### Tests

- `test/config/credential-store.test.ts` — new tests for file writer, keyring writer, and `createCredentialWriter` factory.
- `test/config/auth-profiles.test.ts` — added tests for `loginApiKey`, `resolveApiKey`, and `getAuthStatus`, including mocked in-memory keyring.
- `test/config/config.test.ts` — added test confirming `auth.credential_store` is loaded from config.toml.

## Test results

- Targeted tests (`test/config/credential-store.test.ts`, `test/config/auth-profiles.test.ts`, `test/config/config.test.ts`): **85 pass, 0 fail**.
- Full `bun test` was run; the suite has pre-existing failures unrelated to this change (missing module imports, external-service requirements such as Tailscale, and timeout issues). The auth/config changes do not introduce new failures.

## Blockers

- None for Phase 3 scope.

## What remains for Phase 4

- Wire a real OS keyring backend (e.g., macOS Keychain, libsecret/KWallet on Linux, Windows Credential Manager).
- Implement the OAuth flow in `gizzi auth login` so users can choose OAuth instead of API key.
- Add interactive config UI for choosing `credential_store`.
- Update user-facing documentation for the new auth commands and credential store options.
