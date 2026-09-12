# Checkpoint — artphase3-0912

## Goal
A:// Artifacts Phase 3 (issue #389): hosted publish/unpublish/status gateway
routes + deploy plumbing + minimal web actions + design-doc updates, per
docs/design/artifacts-api.md §6 decisions (2026-09-12).

## Just did
- V150__content_artifact_publishes.sql (publish state + per-user route map).
- content_artifact_publish.rs: POST/GET/DELETE /content-artifacts/:id/publish;
  sandbox-policy gate (422, names policy); version-snapshot semantics; publisher
  trait with real WranglerPagesPublisher (env ALLTERNIT_ARTIFACT_PUBLISHER=wrangler)
  and FsPublisher dev default (immutable deployments + removable routes under
  <data_dir>/artifact-publish/); 7 tests incl. gate, snapshot, unpublish-keeps-
  deployment, idempotent republish, scoping. Mounted in main.rs; Phase 1 helpers
  widened to pub(crate) (no behavior change).
- Web: publish/unpublish/status client fns in content-artifact-api.ts;
  GalleryPublishActions.tsx presentational row; NewProjectScreen card wrap; CSS.
- Design doc: §3 publish API, §6 row IMPLEMENTED, §7 Phase 3 implemented.
- tsc --noEmit 0 errors; NewProjectScreen + gallery vitest 24/24 green.

## Next
cargo test -p allternit-api (new tests; known pre-existing failures not mine),
release build, live curl smoke with fs publisher, release-preflight, PR, ritual.

## Open questions
- Resolved: gate = policy containing "network" (case-insensitive). Documented.
- Wrangler unpublish redeploys tree minus route (old deployment URL stays live) —
  stated in design doc §3 and will be in the PR.
