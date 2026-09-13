# Session summary — 2026-09-11-2024 artifactsapi-0911 (kimi, artifacts-api design)

## What was done
Design-before-build session for the **A:// Artifacts API** (mapping doc §2 row
16, Eoj amendment 2026-09-11). Delivered the design doc and tracking issues
only — no implementation.

- `docs/design/artifacts-api.md` — full design, Register 1 voice, DECIDED vs
  OPEN marked: goals/non-goals; data model (`content_artifacts` /
  `content_artifact_versions`, V146+, `allternit.db`, provenance reusing
  GalleryEntry field names, sandbox_policy reference); API shape
  (`/api/v1/content-artifacts` CRUD + versions + list, real JSON examples,
  idempotency keys — a new convention for this crate, error shape unchanged);
  storage (inline ≤256KB + disk file store; IndexedDB stores demoted to
  read-through caches, gateway canonical); bounded per-surface notes; sharing
  tiers (local decided, static export exists, Cloudflare Pages publish OPEN ×4,
  A:// mesh relay OPEN ×2); 3-phase plan (one ~PR-#378-sized session each);
  risks (local-first limits, sandbox codification via the ArtifactRenderer
  iframe policy, version retention unknown).
- `.steering/plans/plan-artifactsapi-0911.md`, `.steering/checkpoint.md`
  updated per ritual.
- Tracking issues: epic #386 (A:// Artifacts API Phase 2 program) + phases
  #387 (gateway CRUD + design persistence), #388 (cross-surface consumption),
  #389 (publish tiers — blocked on Eoj's §6 answers).

## How it was grounded
Every claim cross-checked against real code before writing: ArtifactRenderer.tsx
(sandboxed srcDoc iframe `allow-scripts allow-forms allow-modals` + storage
shim), artifact-parser.ts (`splitOnArtifacts` — the in-session wire format the
API deliberately does not replace), gallery-store.ts + project-file-store.ts
(the two IndexedDB stores that become caches), artifact-export.ts (static
export tiers), artifact_routes.rs + main.rs:783 (mount pattern, AuthUser,
spawn_blocking/rusqlite transaction conventions), migrations V1–V145 (V146 is
the next slot), docs/NATIVE_SESSIONS.md + AGENT_EMAIL_RAIL.md (doc tone).

## Key design decisions (DECIDED)
- New `content_artifact*` tables/routes sit **next to** the existing
  sectioned-document `artifacts` model — no migration of existing rows; the
  user-facing name stays "artifact" for both, `content-artifact` prefix is
  internal only.
- Versions are append-only from day one, aligned with the upcoming
  file-versions work.
- Viewer-pays AI artifacts OUT (Eoj amendment); no public-by-default anything.
- Gateway on :8013 is canonical; clients sync.

## Verification
Docs-only session — verification is citation accuracy (each path re-opened and
read during the session) + markdown review. PR #385 merged `d0bdc625c`.
Vercel check failure on the PR is the known account-wide environmental issue;
merged per standing instruction.

## Incidents / deferrals
- None blocking. Deferred by design: publish/relay tiers need Eoj's answers
  (6 OPEN questions in the doc §6); version-retention policy settles in Phase 2.
- No desktop rebuild: docs-only session, ritual skip rule applies (the desktop
  bundles nothing touched).
