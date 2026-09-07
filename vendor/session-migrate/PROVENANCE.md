# Provenance

Vendored copy of [xhluca/session-migrate](https://github.com/xhluca/session-migrate), MIT.

- **Upstream:** https://github.com/xhluca/session-migrate
- **Imported:** 2026-09-06 (depth-1 of `main`)
- **License:** MIT (see `LICENSE`) — copyright notice preserved

## Why it is here

session-migrate is the production-grade reader/writer matrix for 18 native coding-agent session formats. Allternit uses it as the **format contract and optional CLI bridge**, not as a live migrator that writes back into canonical native journals.

Allternit’s production path (`packages/@allternit/native-sessions`):

1. Read-only catalog of every harness (installed or not — missing roots list empty).
2. Snapshot + new Gizzi session with a first-class `source_ref`.
3. Inbound **fetch** when the native file later changes (origin timeline, not a rewrite of Allternit turns).
4. Never mutate the source native session. Outbound export to a *new* native id is a later bridge, not v1.

Do not call `smigrate transfer --to <same-id>` against a live store from Allternit.

## Changes relative to upstream

None to Python source at import. Allternit-specific shaping lives in `@allternit/native-sessions` and Gizzi `session` columns.
