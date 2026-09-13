# Attestation — session/artphase1-0912 — A:// Artifacts API Phase 1

- **Date:** 2026-09-12 (~10:59 local)
- **Agent:** Kimi Code (parallel three-session wave with artdecisions-0912 and csp-egress-0912)
- **PR:** #411 — merged as `14a1ac8ef875452fb0c36f587ca06af8b86addd4` (merge commit, `--merge`)
- **Issue:** #387 closed (auto via "Closes #387"; progress comment posted)
- **Design:** `docs/design/artifacts-api.md` §2–§5, §7 Phase 1; §8 retention decision recorded 2026-09-12 by artdecisions-0912

## What was done

**Gateway (`cmd/allternit-api`)**
- Migration `V148__content_artifacts.sql` (V146/V147 were consumed on main after the design doc named V146): `content_artifacts` (one row per artifact, provenance fields reuse `GalleryEntry` names, `sandbox_policy` default `standard`, soft-delete `deleted_at`), `content_artifact_versions` (append-only, `UNIQUE(artifact_id, version)`, cascade delete), `content_artifact_idempotency` (PK `(user_id, key)`, nullable `version` for append replays). Indexes: `(user_id, created_at)`, `(type)`, `(project_id)`, `(artifact_id, version)`.
- New `content_artifact_routes.rs`, mounted with `.merge(...)` in main.rs inside the protected `/api/v1` nest, following `artifact_router()` exactly: `Extension<AuthUser>` scoping, `spawn_blocking` + rusqlite transactions, `{"error": …}` shape, camelCase serde aliases for web params.
- Endpoints: POST create (201 + version 1, `address: a://artifact/<id>`, `provenance` object), GET read (current body inline), PUT versions (append) + PATCH convenience, GET versions list (no bodies) / version read, GET list (`type`/`project`/`q` filters + `created_at|id` cursor pagination, repo convention), DELETE soft delete.
- Idempotency (§3 — new convention for this crate): `Idempotency-Key` header or `idempotencyKey` body field, keyed `(user_id, key)`, 24h TTL swept lazily on write. Replayed create returns the original artifact with 200 (not 201); replayed append returns the original version number instead of double-appending.
- Version retention (§8, decided 2026-09-12): cap **50** per artifact, env `ALLTERNIT_CONTENT_ARTIFACT_MAX_VERSIONS` (the "env or config" knob), prune oldest beyond cap at append time — on-disk bodies of pruned file-backed versions are removed too.
- Storage (§4): bodies ≤256 KB inline; larger written to `<data_dir>/content-artifacts/<artifact_id>/<version>.<ext>` with `storage='file'`, row holds relative path + sha256; reads resolve either way.

**Web surface (`surfaces/ai.allternit.com`)** — design save/gallery plumbing only; ArtifactRenderer.tsx and DESIGN.md §11 untouched (owned by csp-egress-0912).
- New `src/lib/design/content-artifact-sync.ts`: `saveGalleryEntryToGateway` (find-by-project → append version, else create with deterministic per-project idempotency keys) and `listGalleryEntriesGatewayFirst` (gateway list merged with the IndexedDB cache: bodies from local sync-on-save cache, one fetch per gateway-only artifact, local-only offline entries preserved, full IndexedDB fallback on gateway failure).
- `DesignModeView.tsx`: P0 gallery capture writes IndexedDB first (offline fallback), then through the API (best-effort, swallow — matches P0 semantics).
- `NewProjectScreen.tsx`: gallery reads gateway-first.
- Mapping note: the gateway stores MIME types; the gallery's `type` is a UI category slug (prototype/slides/…) that is not part of the gateway model — merged entries recover the category from the local cache or fall back to `'other'`.

## How it works (one paragraph)

Design-session finalization already produced a per-project `GalleryEntry` in IndexedDB. Phase 1 keeps that write and adds a write-through: the entry's artifact HTML becomes either version 1 of a new `content_artifact` (provenance fields copied 1:1) or the next append-only version of the artifact already tied to that `project_id`, so every save is a non-destructive version and retries are idempotent. The landing gallery now reads the gateway as canonical and merges the local cache beneath it, so the UI is unchanged but survives both gateway outages (IndexedDB fallback) and cross-surface creation (gateway-only entries fetch their body once).

## Verification evidence

- `cargo test -p allternit-api content_artifact` — **6/6** (lifecycle; create idempotency → 200 replay; append idempotency; retention prune under env cap; filters + cursor pagination + bad-cursor 400 + user scoping; 300 KB file-storage roundtrip).
- Full `cargo test -p allternit-api` — 968 passed / 6 failed, **all verified pre-existing** by re-running them in a throwaway worktree at pristine origin/main: 4× `agent_cloud_routes::provision_*` fail there too (they spawn the machine's stale `allternitos_control_plane` binary which now rejects `--fake-provider`; the repo binary needs a rebuild unrelated to this session) and `rails::gate_data_plane_round_trip` fails on unmodified main; `deployment_scheduler::claim_race_fires_exactly_one_run` is a timing flake that passes in isolation. None of these modules were touched.
- `cargo build --release -p allternit-api` — green.
- **Live smoke** against the release binary from the worktree (`ALLTERNIT_LOCAL_DEV_BYPASS=1`, `ALLTERNIT_API_PORT=18013`, temp `ALLTERNIT_DATA_DIR`): create → 201 with address/provenance; same-key replay → 200 same id; read body roundtrip + sha256; PUT append → v2; versions list/read; list with project filter; soft delete → read 404 + list excludes; retention with `ALLTERNIT_CONTENT_ARTIFACT_MAX_VERSIONS=3` after 6 appends → versions `[4, 5, 6]`.
- `pnpm typecheck` (surfaces/ai.allternit.com) — 0 errors.
- `pnpm vitest run src/lib/design` — 80/80 (11 files), incl. 7 new `content-artifact-sync` tests (create/append/idempotency keys, MIME passthrough, gateway-first mapping, body fetch for gateway-only, offline fallback, local-only merge).
- `node scripts/release-preflight.mjs` — **35/0**.
- PR checks: all green except the known account-wide Vercel deploy rate limit (per repo convention, merged anyway).

## Incidents

- Tests caught two real implementation bugs pre-merge: (1) `skillId`/`skillName` body fields were silently dropped (missing serde camelCase aliases); (2) the list endpoint's cursor branch computed all three bind placeholder indexes before pushing any bind, collapsing `?2/?3/?4` into `?2` so the id comparison ran against the timestamp — pagination returned page 1 again. Both fixed and regression-covered.
- First live-smoke retention check appeared to fail; root cause was operator error — the first gateway process still held port 18013 when the env-override instance started, so appends hit the old process (default cap 50). Re-run with a verified port handoff showed correct pruning (`[4,5,6]` under cap 3).
- PR #411 was initially created with a shell-mangled body (heredoc inside command substitution executed backticks); body corrected via `gh pr edit --body-file` before merge.

## Honest deferrals

- **Phase 2 (explicitly out of scope):** chat persist step, cowork `a://artifact/<id>` links, gizzi-code `artifact` client commands, typed renderers for deck/prototype/mobile, IndexedDB demoted from offline-fallback to read-through cache.
- **Phase 3:** publish tiers per the §6 decisions (shared Pages project, version-snapshot publish, immutable deployments, sandbox-policy publish gate) — not started.
- IDs are `art_<uuid4>`/`ver_<uuid4>` rather than the doc's `<ulid>` (crate not in the tree); uniqueness contract identical, noted in the PR.
- The 4 `provision_*` + 1 rails test failures above are pre-existing machine-state issues (stale `allternitos_control_plane` binary) — flagged here for the next session that touches agent_cloud routes; not fixed per the "note, don't silently fix" rule.

## Desktop rebuild

Desktop rebuild for this session lands immediately after this attestation (gateway + platform assets are bundled): sidecar copy from the shared checkout, `CSC_IDENTITY_AUTO_DISCOVERY=false npm run dist`, bundle-verify `grep -rl "content-artifacts"` on the packaged assets, preserve the new 8-file build set, retire only the previous latest.
