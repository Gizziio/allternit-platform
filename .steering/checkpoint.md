# Steering checkpoint — session/datadir-dev-0915

- **Goal:** Stop unpackaged / `npm run dev` desktops from sharing the packaged app's SQLite (`<appData>/@allternit/desktop/allternit`). Honor `ALLTERNIT_DATA_DIR` (and `ALLTERNIT_USER_DATA_DIR`) on dev launches only — the follow-up left by fastload-0914.
- **Just did:** Helpers in `desktop-data-dir.ts`; `unified-main.ts` relocates unpackaged userData before log init; `backend-manager.ts` honors `ALLTERNIT_DATA_DIR` only when unpackaged; AGENTS.md data-dir ownership note next to port ownership.
- **Verified:** `pnpm run typecheck` clean; `pnpm run test` 155/155 (8 new in `desktop-data-dir.test.ts`).
- **Next:** commit / push / PR.
- **Open questions:** Known non-fatals from fastload (ACU/uvicorn, mesh 502, Clerk auth-renderer hiccup) stay deferred — they do not gate launch and are host/runtime, not this data-dir bug.
