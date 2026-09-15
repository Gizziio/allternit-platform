# Session attestation — datadir-dev-0915 — isolate unpackaged SQLite from the packaged app

- **Session:** `session/datadir-dev-0915` (grok)
- **PR:** #545, merge `a6c20f1d5` into main (`8754ad358`)
- **Date:** 2026-09-15 08:21 CDT

## What was done

Picked up the leftover from fastload-0914: unpackaged / `npm run dev`
desktops shared Electron userData with the installed app
(`<appData>/@allternit/desktop`), so cargo/dev migrations rewrote
production sqlite and the next packaged boot died on a version mismatch.
Port 8013 vs 18013 already split the gateway; this splits the profile
the same way.

- Unpackaged launches default to `<appData>/@allternit/desktop-dev`,
  applied in `unified-main.ts` before any `getPath('userData')`.
- `ALLTERNIT_USER_DATA_DIR` relocates the Electron profile;
  `ALLTERNIT_DATA_DIR` relocates API sqlite. Both win only when
  unpackaged, matching `ALLTERNIT_API_PORT`. Packaged ignores both.
- `--user-data-dir` (Playwright / e2e) is left alone.
- AGENTS.md data-dir ownership note next to the port-ownership paragraph.

## Verification

- `pnpm run typecheck` (desktop main + preload): clean
- `pnpm run test`: 155/155, including 8 new tests in
  `desktop-data-dir.test.ts` (packaged pin, default sibling path, env
  overrides, `--user-data-dir` passthrough)

## Honest deferrals

- Packaged DMG not rebuilt: the packaged code path is a no-op (same
  userData/sqlite as before). Isolation only affects unpackaged launches.
- fastload known non-fatals, still not launch-gating: ACU gateway needs
  uvicorn on this host; mesh enrollment 502; Clerk script hiccup on the
  auth renderer.
- Cargo-run of `allternit-api` without Electron still defaults to
  `<appData>/allternit`. That path was already distinct from the packaged
  profile; the bug was Electron unpackaged using the packaged name.
