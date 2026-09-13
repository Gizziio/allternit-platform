# checkpoint — artpolish-0912

Goal: small fixes batch (LibraryItemDialog CSP, multi-file tree sync, critique vision parts) + credentialed wrangler publish smoke; full ritual to merged + attested + desktop rebuilt + cleaned.

Resumed 2026-09-12 ~20:50 local: all four deliverables + wrangler smoke already complete (see below). Remaining ritual: merge newest main → verify → PR → ledger → desktop rebuild → cleanup.

Just did (resume):
- Merged origin/main (siblings #441/#442 landed): checkpoint.md conflict resolved (ours); **migration renumbered V159→V160** — relay-0912 also picked V159 on main (`V159__content_artifact_relay.sql`), collision resolved by renumbering mine to `V160__content_artifact_files.sql`. Merge commit 599cde5a5. Both file + relay routers mounted in main.rs.
- release-preflight 35/0 on merged state; vitest artifact+design+library 17 files/168 tests green (incl. LibraryItemDialog CSP 5/5); bun critique tests 8/8; gizzi typecheck clean; ai.allternit.com tsc clean; root pnpm typecheck red ONLY on pre-existing office-pptx-engine replaceAll errors (file untouched since 84b09178b, zero diff vs main).
- Fixed merge-hygiene regression: auto-merge had kept stale base side of BotChatSessionView.tsx (silently reverting main's botdefault-0912 fix); restored main's version (64fe57ae0).
- Pushed; PR #444 open: https://github.com/Gizziio/allternit-platform/pull/444

In flight: full `cargo test -p allternit-api` (bash-3bixqdp1) — merge PR after it lands.

Next: `gh pr merge 444 --merge` → shared checkout pull --ff-only → ledger attestation (STEER_GUARD_OFF=1) → desktop rebuild (gizzi-code dist already built fresh from worktree; stage sidecars; background npm run dist; bundle-grep markers; preserve 8-file set, retire then-latest) → cleanup (worktree remove, branch delete local+remote).

Just did (pre-resume):
- (1) LibraryItemDialog CSP: WebsitePreview srcdoc now `injectSandboxCsp(injectSandboxStorageShim(html))` (CSP first); removed `allow-same-origin` from the srcdoc iframe (same hole class as #396); exported WebsitePreview; 5/5 new vitest green.
- (2) Multi-file tree sync: gateway `content_artifact_file_routes.rs` (list/GET/PUT/DELETE `/content-artifacts/:id/files[/*path]`, migration V160 `content_artifact_files` (renumbered twice: V157→V159→V160 as siblings took numbers)), mounted in main.rs; web `content-artifact-api.ts` file client + `project-file-store.ts` whole-tree write-through (every save/delete/rename) and cache-cold whole-tree read-through fill; 16/16 store vitest green, 3/3 cargo route tests green.
- (3) Vision critique: critique.ts `supportsVisionParts` (capabilities.input.image AND not SubprocessLanguageModel), `panelistMessage` (image parts vs markdown-ref fallback), `vision` flag in JSON + SSE critique.start; DesignCritiquePanel shows forwarding mode; 8/8 bun tests green.
- docs/design/artifacts-api.md §2/§3 updated for the file tree.
- Wrangler smoke prep: OAuth as allternitpbc@gmail.com confirmed; created Pages project `allternit-artifacts-smoke` (production branch main). `ALLTERNIT_LOCAL_DEV_BYPASS=1` for localhost auth.
- Committed all three deliverables; merged origin/main (checkpoint.md conflict resolved; main.rs auto-merged).
- Verification: web surface tsc 0 errors (root pnpm typecheck red ONLY on pre-existing office-pptx-engine replaceAll lib errors, untouched by this session, same on origin/main); cargo lib file-route tests 3/3; gizzi typecheck re-running after fixing 2 critique.ts errors.

In flight: gizzi typecheck (bash-2ddk01wl); cargo release build (bash-wwrb9y9h, includes V157 + merged main).

Next: full cargo test -p allternit-api (bash-0jo87pwc, running) → final release build on merged code → push + PR → ledger → desktop rebuild → cleanup.

Open questions: re-check relay's migration number right before PR in case they add more.

## Wrangler smoke — COMPLETE (all times UTC, 2026-09-13)
- Gateway: worktree release binary, ALLTERNIT_ARTIFACT_PUBLISHER=wrangler, ALLTERNIT_ARTIFACT_PAGES_PROJECT=allternit-artifacts-smoke, ALLTERNIT_LOCAL_DEV_BYPASS=1, port 18099, data dir /tmp/artpolish-smoke-data. OAuth: allternitpbc@gmail.com.
- 00:48:25Z artifact created art_3563fb72-089b-45e2-b244-ade4cbdcc569 ("A:// artifacts publish smoke").
- 00:50:06→00:50:17Z POST /publish (v1 snapshot) → real wrangler deploy, deployment https://579dc6ff.allternit-artifacts-smoke.pages.dev, route u-b544b0406548/art_3563fb72-089b-45e2-b244-ade4cbdcc569/.
- 00:50:29Z route HTTP 200, body contains SMOKE_V1. URL: https://allternit-artifacts-smoke.pages.dev/u-b544b0406548/art_3563fb72-089b-45e2-b244-ade4cbdcc569/
- 00:50:38Z appended v2 (SMOKE_V2) → 00:50:43Z route STILL serves SMOKE_V1 (snapshot semantics, decision 2 proven live).
- 00:50:52→00:51:04Z DELETE /publish ok → 00:51:36Z route HTTP 404 (edge cache stale ~30s, then consistently 404 six checks to 00:52:38Z).
- Bonus live check of new file routes on the same server: PUT/GET/INDEX /files/styles.css round-trip OK (sha256 ee49b0e9…).
- Only the smoke Pages project was touched; no production project deployed.
