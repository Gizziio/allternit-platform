# Checkpoint — artphase1-0912

**Goal:** Land Artifacts API Phase 1 (gateway CRUD + design-session persistence) per docs/design/artifacts-api.md; version retention cap 50 implemented at append time; PR merge, ledger, desktop rebuild, cleanup.

**Just did:** V148 migration (content_artifacts + content_artifact_versions + content_artifact_idempotency). content_artifact_routes.rs complete (create/read/list/append/PATCH/versions/soft-delete, idempotency header+body key with 24h TTL sweep, retention cap via ALLTERNIT_CONTENT_ARTIFACT_MAX_VERSIONS default 50, inline ≤256KB + file storage under <data_dir>/content-artifacts/). Mounted in main.rs. 6 route tests written; cargo check clean; cargo test running. Web: content-artifact-sync.ts (save-through + gateway-first read w/ IndexedDB fallback + local merge), wired into DesignModeView (save) and NewProjectScreen (read). Design vitest green 80/80 incl. 7 new sync tests. typecheck running.

**Next:** cargo test results → release build → live curl smoke → release-preflight → commits → PR.

**Open questions:** Gallery `type` is a UI category slug, not MIME — gateway stores MIME; merged entries reuse local category or 'other' (documented in PR).
