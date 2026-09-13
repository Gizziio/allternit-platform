# checkpoint — artpolish-0912

Goal: small fixes batch (LibraryItemDialog CSP, multi-file tree sync, critique vision parts) + credentialed wrangler publish smoke; full ritual to merged + attested + desktop rebuilt + cleaned.

Just did:
- (1) LibraryItemDialog CSP: WebsitePreview srcdoc now `injectSandboxCsp(injectSandboxStorageShim(html))` (CSP first); removed `allow-same-origin` from the srcdoc iframe (same hole class as #396); exported WebsitePreview; 5/5 new vitest green.
- (2) Multi-file tree sync: gateway `content_artifact_file_routes.rs` (list/GET/PUT/DELETE `/content-artifacts/:id/files[/*path]`, migration V157 `content_artifact_files` — V156 taken by relay-0912), mounted in main.rs; web `content-artifact-api.ts` file client + `project-file-store.ts` whole-tree write-through (every save/delete/rename) and cache-cold whole-tree read-through fill; 16/16 store vitest green, 3/3 cargo route tests green.
- (3) Vision critique: critique.ts `supportsVisionParts` (capabilities.input.image AND not SubprocessLanguageModel), `panelistMessage` (image parts vs markdown-ref fallback), `vision` flag in JSON + SSE critique.start; DesignCritiquePanel shows forwarding mode; 8/8 bun tests green.
- docs/design/artifacts-api.md §2/§3 updated for the file tree.
- Wrangler smoke prep: OAuth as allternitpbc@gmail.com confirmed; created Pages project `allternit-artifacts-smoke` (production branch main). `ALLTERNIT_LOCAL_DEV_BYPASS=1` for localhost auth.
- Committed all three deliverables; merged origin/main (checkpoint.md conflict resolved; main.rs auto-merged).
- Verification: web surface tsc 0 errors (root pnpm typecheck red ONLY on pre-existing office-pptx-engine replaceAll lib errors, untouched by this session, same on origin/main); cargo lib file-route tests 3/3; gizzi typecheck re-running after fixing 2 critique.ts errors.

In flight: gizzi typecheck (bash-2ddk01wl); cargo release build (bash-wwrb9y9h, includes V157 + merged main).

Next: full cargo test -p allternit-api → wrangler smoke with release binary → release-preflight 35/0 → push + PR → ledger → desktop rebuild → cleanup.

Open questions: re-check relay's migration number right before PR in case they add more.
