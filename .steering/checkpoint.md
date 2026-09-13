# checkpoint — artpolish-0912

Goal: small fixes batch (LibraryItemDialog CSP, multi-file tree sync, critique vision parts) + credentialed wrangler publish smoke; full ritual to merged + attested + desktop rebuilt + cleaned.

Just did:
- (1) LibraryItemDialog CSP: WebsitePreview srcdoc now `injectSandboxCsp(injectSandboxStorageShim(html))` (CSP first); removed `allow-same-origin` from the srcdoc iframe (same hole class as #396); exported WebsitePreview; 5/5 new vitest green.
- (2) Multi-file tree sync: gateway `content_artifact_file_routes.rs` (list/GET/PUT/DELETE `/content-artifacts/:id/files[/*path]`, V156 migration `content_artifact_files`), mounted in main.rs; web `content-artifact-api.ts` file client + `project-file-store.ts` whole-tree write-through (every save/delete/rename) and cache-cold whole-tree read-through fill; 16/16 store vitest green. Fixed split('/') empty-first-segment path-validation bug caught by cargo tests.
- (3) Vision critique: critique.ts `supportsVisionParts` (capabilities.input.image AND not SubprocessLanguageModel), `panelistMessage` (image parts vs markdown-ref fallback), `vision` flag in JSON + SSE critique.start; DesignCritiquePanel shows forwarding mode; 8/8 bun tests green.
- docs/design/artifacts-api.md §2/§3 updated for the file tree.
- Wrangler smoke prep: OAuth as allternitpbc@gmail.com confirmed; created Pages project `allternit-artifacts-smoke` (production branch main). Discovered `ALLTERNIT_LOCAL_DEV_BYPASS=1` for localhost auth.

In flight: cargo test file routes (bash-rp74ttlv); cargo release build (bash-wwrb9y9h); pnpm typecheck (bash-jbnpx1sh).

Next: verify cargo tests green → commits → full verification gates → wrangler smoke with release binary → PR ritual.

Open questions: relay-0912 may also want V156 (their worktree has no migration yet; re-check before merge).
