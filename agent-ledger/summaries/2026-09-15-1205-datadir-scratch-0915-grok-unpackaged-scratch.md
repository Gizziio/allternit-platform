# Session attestation — datadir-scratch-0915 — unpackaged is scratch, not a second product

- **Session:** `session/datadir-scratch-0915` (grok)
- **PR:** #549, merge `e546f83eb` into main (`08d0172e3`)
- **Date:** 2026-09-15 12:05 CDT

## What was done

Owner rejected the standing `@allternit/desktop-dev` profile that #545
added. That was two Allternits. This machine runs one Desktop: the
installed app on 8013 with the packaged sqlite.

- Unpackaged / `npm run dev` is explicit scratch (`ALLTERNIT_USER_DATA_DIR`
  / `ALLTERNIT_DATA_DIR`) or an ephemeral temp dir. No sibling product
  path.
- Packaged sqlite and the 8013 fuse (unset cargo default 18013 so a
  stray process cannot SIGTERM the installed gateway) are unchanged.
- AGENTS.md rewritten: 18013 is a fuse, not a second product.

## Verification

- `pnpm exec vitest run`: 155/155 (data-dir tests now assert `ephemeral`,
  not a standing `desktop-dev` path).

## Honest deferrals

- Packaged DMG not rebuilt: packaged code path still a no-op.
- ACU/uvicorn, mesh 502, Clerk auth-renderer hiccup still not this.
