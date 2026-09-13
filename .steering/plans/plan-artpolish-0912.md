# plan-artpolish-0912 — small fixes batch + credentialed wrangler publish smoke

Session: artpolish-0912 (parallel with onlook-ast-0912, relay-0912). References #389.

## Deliverables

1. **LibraryItemDialog CSP** (web)
   - `surfaces/ai.allternit.com/src/views/library/LibraryItemDialog.tsx`: apply
     `injectSandboxCsp` from `src/components/artifact/sandbox-csp.ts` to the
     `WebsitePreview` srcdoc (currently only `injectSandboxStorageShim`).
   - New vitest asserting the CSP meta + `data-allternit-artifact-csp` marker in srcdoc.
   - Files: LibraryItemDialog.tsx, new test colocated or under src/views/library/__tests__.

2. **Multi-file tree sync** (gateway Rust + web store)
   - Gateway: new table `content_artifact_files` (migration V156 — verify not
     taken by relay-0912 before merge; bump if collided), routes on the
     existing content_artifact_router:
     - `GET /content-artifacts/:id/files` — index (path, sha256, updatedAt)
     - `GET /content-artifacts/:id/files/*path` — read one file body (text)
     - `PUT /content-artifacts/:id/files/*path` — upsert write-through
     - `DELETE /content-artifacts/:id/files/*path` — remove
   - Web: `content-artifact-api.ts` gains file client fns;
     `project-file-store.ts` writes through EVERY file (not just /index.html)
     and read-through-fills missing local files from the gateway index.
     Keep the /index.html → artifact-version append sync unchanged.
   - Tests: Rust route tests (axum-test, follow existing conventions in
     content_artifact_routes.rs); web store test update.

3. **Vision-part critique panelists** (gizzi + web panel)
   - `cmd/gizzi-code/src/runtime/server/routes/critique.ts`: when the resolved
     model supports image input (`capabilities.input.image`) and the language
     model is NOT a subprocess CLI brain, forward attached images as real
     `{type:"image"}` content parts; otherwise keep markdown-ref fallback.
     Export pure helpers + bun tests.
   - `DesignCritiquePanel.tsx`: show when images were forwarded as vision
     parts (from critique.start event) vs markdown refs.

4. **Credentialed wrangler publish smoke**
   - Build gateway from this worktree (`cargo build --release -p allternit-api`).
   - Run with `ALLTERNIT_ARTIFACT_PUBLISHER=wrangler`,
     `ALLTERNIT_ARTIFACT_PAGES_PROJECT=allternit-artifacts-smoke`, temp data dir,
     local port. Auth: wrangler OAuth (allternitpbc@gmail.com) already on machine.
   - Create artifact "A:// artifacts publish smoke" → publish v1 → verify route
     serves snapshot → append v2 → verify live stays v1 → unpublish → verify 404.
   - Capture URLs + timestamps; document in ledger. Smoke project only, never
     touch production Pages projects. On failure: capture exact error, document honestly.

## Verify gate
- `pnpm typecheck` 0 errors
- vitest: artifact components + design green (incl. new CSP test)
- `node scripts/release-preflight.mjs` 35/0
- Rust: `cargo test -p allternit-api` (new file routes tests; known pre-existing
  failures not mine) + `cargo build --release -p allternit-api`
- gizzi: `bun run typecheck` in cmd/gizzi-code + bun test for critique helpers

## Ritual
- Commits on session/artpolish-0912, checkpoint.md at milestones, steering plan kept current.
- Merge newest origin/main right before PR; `gh pr merge --merge`; record PR + SHA.
- Ledger attestation in shared checkout on main (STEER_GUARD_OFF=1).
- Desktop rebuild from merged main: fresh gizzi-code binary from worktree build
  (bun run script/build-production.js), copy other 5 sidecars from shared
  checkout (its gizzi-code sidecar is stale), background
  `CSC_IDENTITY_AUTO_DISCOVERY=false npm run dist`, wait for notification,
  bundle-grep markers (`data-allternit-artifact-csp` path + critique vision),
  ls shared release/ at copy time, preserve new 8-file set, retire ONLY
  then-latest set.
- Cleanup: worktree remove, branch local+remote delete, scratch removed.

## Ownership (do not touch)
- onlook-ast-0912: surgical panel / aio-targeting / DesignModeView wiring
- relay-0912: content_artifact_publish.rs semantics, relay routes, gallery stores
- Do NOT edit: content-artifact-sync.ts, gallery-store.ts, artifact renderer core.
