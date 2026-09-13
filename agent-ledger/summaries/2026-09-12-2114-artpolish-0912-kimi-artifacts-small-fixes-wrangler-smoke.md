# artpolish-0912 — small fixes batch + credentialed wrangler publish smoke

- **Session:** `session/artpolish-0912` (parallel with onlook-ast-0912, relay-0912)
- **Agent family:** kimi-code
- **PR:** #444 — merge commit `c955d4ce2bf6498f921eb9457aa271d7a86d0338`
- **References:** issue #389 (Phase-3 deferrals), #396 (same CSP gap class)
- **Date:** 2026-09-12

## What was done

Three ledger deferrals plus the real (credentialed) publish smoke that Phase 3 deferred:

### 1. LibraryItemDialog CSP (web)

`LibraryItemDialog.tsx`'s `WebsitePreview` srcdoc iframe injected only the storage shim — the same gap class #396 fixed elsewhere. Now `injectSandboxCsp(injectSandboxStorageShim(html))` (CSP first, so the meta lands in `<head>`), consuming the existing exported `ARTIFACT_CSP` pipeline from `src/components/artifact/sandbox-csp.ts`; `allow-same-origin` removed from the srcdoc iframe (same hole class as #396). `WebsitePreview` exported for the test. New vitest (`LibraryItemDialog.test.tsx`, 5 tests) asserts the CSP meta + `data-allternit-artifact-csp` marker in the srcdoc and the absence of `allow-same-origin`.

### 2. Multi-file tree sync (gateway Rust + web store)

`project-file-store.ts` previously synced only `/index.html` to the gateway. Now the whole per-project file tree syncs:

- **Gateway** — new `content_artifact_file_routes.rs`: `GET /api/v1/content-artifacts/:id/files` (index: path/sha256/updatedAt), `GET/PUT/DELETE …/files/*path` (read/upsert/delete). User-scoped (404 cross-user, not 403, to avoid id oracle), soft-delete aware, path-validated (no `..`, no absolute, no backslash, segments ≤ 255 chars), sha256 recorded per file. New table `content_artifact_files` — **migration V160** (renumbered twice: V157 → V159 → V160; V156–V159 were consumed on main by cowork + relay-0912 migrations, and V159 specifically collided with `V159__content_artifact_relay.sql` when relay-0912 merged, so the file-tree migration landed as V160). Router mounted in `main.rs` alongside the existing artifact routers.
- **Web** — `content-artifact-api.ts` gains a file-tree client (`listArtifactFiles/readArtifactFile/writeArtifactFile/deleteArtifactFile`); `project-file-store.ts` write-throughs every local save/delete/rename for every file (not just `/index.html`) and read-through-fills the whole tree from the gateway index on cold cache, following the existing read-through-cache pattern. The `/index.html` → artifact-version append sync is unchanged.
- **Rust was genuinely required** — no gateway route existed for non-index files, so this is not web-only; justified per the spec's "decide from the actual code".

### 3. Vision-part critique panelists (gizzi + web panel)

`cmd/gizzi-code/src/runtime/server/routes/critique.ts`: attached images previously rode as markdown refs in the critique text turn for every brain. Now `supportsVisionParts(model)` (capabilities.input.image AND the model is not a `SubprocessLanguageModel` — subprocess CLI brains can't take binary parts) decides: capable brains get real `{type:"image"}` multimodal content parts via `panelistMessage`; text-only/subprocess brains keep the markdown-ref fallback. `vision: true/false` flag in the JSON response and SSE `critique.start` event; `DesignCritiquePanel.tsx` shows the forwarding mode to the user. Pure helpers exported; 8 bun tests (`test/server/critique-message.test.ts`).

### 4. Credentialed wrangler publish smoke (the real Phase-3 deferral)

Ran the REAL publish path end-to-end with wrangler OAuth (allternitpbc@gmail.com) against a dedicated smoke Pages project `allternit-artifacts-smoke` — **no production Pages project was touched** (allternit, allternit-services, etc. untouched).

Setup: worktree release binary, `ALLTERNIT_ARTIFACT_PUBLISHER=wrangler`, `ALLTERNIT_ARTIFACT_PAGES_PROJECT=allternit-artifacts-smoke`, `ALLTERNIT_LOCAL_DEV_BYPASS=1`, port 18099, temp data dir `/tmp/artpolish-smoke-data`.

Evidence (all UTC, 2026-09-13):

| Time | Event |
|------|-------|
| 00:48:25Z | Artifact created `art_3563fb72-089b-45e2-b244-ade4cbdcc569` ("A:// artifacts publish smoke") |
| 00:50:06–00:50:17Z | POST /publish (v1 snapshot) → real wrangler deploy, deployment `https://579dc6ff.allternit-artifacts-smoke.pages.dev` |
| 00:50:29Z | Per-user route HTTP 200, body contains SMOKE_V1 — `https://allternit-artifacts-smoke.pages.dev/u-b544b0406548/art_3563fb72-089b-45e2-b244-ade4cbdcc569/` |
| 00:50:38Z | Appended v2 (SMOKE_V2) |
| 00:50:43Z | Route still serves SMOKE_V1 — snapshot semantics (publish is a point-in-time bundle, live unaffected by appends) proven live |
| 00:50:52–00:51:04Z | DELETE /publish → ok |
| 00:51:36Z | Route HTTP 404 (edge cache stale ~30s, then consistently 404 across six checks to 00:52:38Z) |

Bonus on the same server: live round-trip of the NEW file routes — PUT/GET/INDEX `/files/styles.css` OK (sha256 ee49b0e9…).

## How it works (notes for the next agent)

- CSP order matters: `injectSandboxCsp` must run AFTER the storage shim so the meta is inserted at the top of `<head>`; both are no-ops on already-tagged HTML (idempotent).
- File routes follow the existing `content_artifact_routes.rs` conventions exactly (user_id from auth ext, soft-delete filter, `ApiError` responses). The web store treats the gateway as authoritative for files not present locally, and local as authoritative otherwise — same stance as the pre-existing index.html read-through.
- Critique vision gating keys off `capabilities.input.image` from the model registry AND the model class; do not drop the SubprocessLanguageModel exclusion or CLI-brained panelists will crash on binary parts.

## Verification evidence

- `node scripts/release-preflight.mjs` — **35/0** on the merged state.
- vitest `src/components/artifact src/lib/design src/views/library src/views/design` — **17 files / 168 tests, all green** (incl. 5 new LibraryItemDialog CSP tests, 16 project-file-store tests).
- `cargo test -p allternit-api content_artifact` — **25/25 green** (new file routes + merged relay suite).
- Full `cargo test -p allternit-api` — **1053 passed / 5 failed**, and the 5 are exactly the known pre-existing set called out in the session spec (4× `agent_cloud_routes::tests::provision_*`, `rails::tests::gate_data_plane_round_trip`) — none from this session.
- `cargo build --release -p allternit-api` — clean (8m12s).
- gizzi-code: `bun run typecheck` clean; `bun test test/server/critique-message.test.ts` 8/8.
- `surfaces/ai.allternit.com` tsc — 0 errors. Root `pnpm typecheck` fails only on pre-existing `packages/@allternit/office-pptx-engine/src/slide-transfer.ts` `replaceAll` lib errors (file last touched by 84b09178b, zero diff vs main — noted as pre-existing, not fixed here).

## Incidents / merge hygiene

- **V159 migration collision:** relay-0912 and this session both picked V159 independently. Resolved by renumbering the file-tree migration to V160 (relay kept V159).
- **Silent auto-merge regression:** merging origin/main auto-resolved `BotChatSessionView.tsx` toward this branch's stale base side, which would have reverted botdefault2-0912's (PR #443) session-metadata model-pin fix. Caught by diff-reviewing the full PR delta; restored main's version in `64fe57ae0`.
- Shared checkout is NOT on main (it's on `ao/platform-console-agents` with uncommitted WIP) — the ledger attestation was committed from a temporary worktree on main instead of disturbing it; local `main` ref fast-forwarded to origin/main first.

## Honest deferrals

- Root `pnpm typecheck` office-pptx-engine `replaceAll` errors are pre-existing and untouched (deliberately out of scope; same red on main).
- The 5 pre-existing cargo test failures above remain (out of scope).
- Smoke Pages project `allternit-artifacts-smoke` remains in the Cloudflare account (kept for future publish-path smokes; it serves 404 for the deleted route).
- Old artifact rows' file trees are not backfilled — read-through fill happens naturally on first open of a project.
