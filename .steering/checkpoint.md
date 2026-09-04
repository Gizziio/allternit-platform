# Steering checkpoint — gizzi-code P3 credential-store hardening (2026-09-04, session gizzi-p3-credentials-20260904)

## Goal
Wire the credential-store as the ONLY storage path for sensitive tokens in cmd/gizzi-code: eliminate plaintext fallbacks (inline config.toml api_key, silent per-service JSON files, unmarked plaintext credential files), add migrate-on-read, harden the no-OS-store fallback (0600 + marker + one-time warning + deprecation log), and add log redaction.

## Just did
- Hardened `FileCredentialWriter`: single `credentials.json` with `insecureFallback: true` marker, 0700 dir / 0600 file, one-time user warning (injectable notifier) + `Log.Default.warn` deprecation; transparent migration of legacy per-service JSON files to `.migrated` backups.
- New `keychain-backend.ts`: macOS Keychain `KeyringBackend` (distinct `-profiles` service suffix, never collides with the OAuth blob); `createCredentialWriter` defaults to it on darwin.
- `auth-profiles.ts`: `loginApiKey` never writes inline api_key (default store now `auto`); `migrateInlineApiKeys` on read (strip on success; chmod 600 + warn on failure); `logout` now removes the stored key; `storeApiKeyForProfile` for `auth profile add --api-key`.
- `plainTextStorage` (both shared + ink-app copies): 0700 dir, on-disk `insecureFallback` marker (stripped on read), one-time stderr warning + deprecation log.
- New `shared/util/redact.ts`; applied in `Log` build output and both `logForDebugging` copies.
- Tests updated (credential-store, auth-profiles) + new `test/util/redact.test.ts` (appended to smoke.txt). Targeted tests: 38/38 pass. Baseline smoke before changes: 1072/87/0.

## Next
- Await typecheck + full smoke; commit on `session/gizzi-p3-credentials-20260904` (no push).

## Open questions
- Linux libsecret / Windows Credential Manager backends remain TODO (fallback is the marked, warned, deprecated file).
- Legacy upstream `saveApiKey`/`primaryApiKey` path in shared/utils/auth.ts still writes a 0600 JSON config key — documented as follow-up, not rewired (upstream-parity blast radius).
