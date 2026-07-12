# Library feature — implementation record

Status: **Done** (code-complete, compile + typecheck clean, API-level verified with a real `HTTP 200`). Not browser-E2E verified.

A single, easy-to-find **Library** surface that aggregates the signed-in user's generated images/artifacts/documents/code **and** uploaded files in one place, with source-session provenance and a click-to-preview overlay. Read-only aggregation over existing data — no new storage, no migrations.

## What was built

**Backend — `cmd/allternit-api` (package `allternit-api`)**
- `src/library_routes.rs` (new): `library_router()`
  - `GET /api/v1/library` — user-scoped (`Extension<AuthUser>`), merges two sources and flattens into `LibraryItem { id, kind, title, url, content, session_id, canvas_id, artifact_id, origin, created_at }`, sorted by `created_at` desc, with `kind`/`search`/`limit`/`cursor` + dedupe by `artifact_id`.
  - `GET /api/v1/library/stats` — per-kind counts over the same deduped set.
  - Sources: (1) `agent_canvases.components` JSON (generated artifacts), (2) `users/{user_id}/files` on disk (uploaded, `origin:"uploaded"`).
  - Wired in `src/main.rs` (merge) and `src/lib.rs` (`pub mod`).
- `src/file_routes.rs`: added `GET /api/v1/files/raw?path=` (user-scoped bytes + content-type) so uploaded images preview.

**Frontend — `surfaces/ai.allternit.com` (Vite/React)**
- `src/services/library-api.ts` (new): typed client + `useAuthBlobUrl` (auth'd blob for `/api` image previews).
- `src/views/library/LibraryView.tsx` (new): header, debounced search, tabs (All/Images/Artifacts/Documents/Files), sort (Newest/Oldest/Type), card grid, infinite scroll.
- `src/views/library/LibraryItemDialog.tsx` (new): selection overlay reusing the platform's renderers (`ImageRenderer`/`DocumentRenderer`/`CodeRenderer`/`ArtifactRenderer`) + metadata (origin, date, source session) + actions (Open source, Copy session id, Download, Copy link) + image zoom (uploaded images).
- Registration: `src/nav/nav.types.ts` (`"library"`), `src/nav/nav.policy.ts`, `src/shell/ViewRegistry.tsx`, `src/shell/rail/rail.config.tsx` (phosphor `Images` icon).
- `src/views/agent-sessions/ChatModeAgentSession.tsx` + `ViewRegistry.tsx`: "Open source" now passes the real `ses…` session id and reloads its messages.

**Dev fix:** `dev/scripts/start-api.sh` now sets `ALLTERNIT_LOCAL_DEV_BYPASS=1` (the key `config.rs::local_dev_bypass()` actually reads; was `ALLTERNIT_DEV_AUTH_BYPASS`).

## Auth / scoping
Scoped by the Clerk `sub` (= `AuthUser.user_id` = `users.id`), which is what `agent_canvases.user_id` stores. The desktop app authenticates via `x-allternit-user-id` + `x-allternit-desktop-access-token` headers (accepted before Clerk). Dev bypass for localhost uses `ALLTERNIT_LOCAL_DEV_BYPASS=1`.

## Verification
- `cargo check -p allternit-api -j 2` — clean (only a pre-existing unrelated `unused_mut` warning in `agent_routes.rs`).
- SPA typecheck — clean. **Note:** this project needs `NODE_OPTIONS="--max-old-space-size=8192"` for `tsc` on Node 25.6.1, or it OOMs.
- API-level proven: `GET /api/v1/library` returned `HTTP 200` with the user's items when authenticated with the desktop headers.

## To view
`make api` (bypass fixed) + the platform app → **Library** in the rail.

## Known caveats / not done
- Not browser-E2E verified (real Clerk login + real generated images). API + compile are verified; pixels were not watched.
- Image **Zoom** affects uploaded images only; generated images use `ImageRenderer`'s own lightbox (the Zoom toggle is a no-op for those).
- "Open source" shows empty only when the source session isn't in the local chat store (cross-device/cleared/non-chat origin); **Copy session id** covers it.
- Uploads appear once files exist in `users/{id}/files` (empty by default).
- **Durability not implemented:** generated image bytes still live as `url`/`data:` in canvas JSON; persisting blobs to `users/{id}/files` for unbreakable thumbnails is future work.

_I did not commit these changes (no git mutations without an explicit request)._
