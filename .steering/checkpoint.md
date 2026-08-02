# Steering checkpoint

<!-- The working agent maintains this file. The Stop hook consults the steering
     agent ONLY when this file's content changes since the last review. Update it
     at meaningful checkpoints: a subtask finished, a design decision made, before
     a risky change. Remove questions once they are answered. -->

## Goal

M4 (spec: .steering/spec.md R1–R4, task: docs/META_M4_TASK.md): Brain as a
first-class ai.allternit.com surface section, then NOTES + sentinel +
`git add surfaces cmd .steering docs && git commit -m "feat(surfaces):
Brain section — pages, learning feed, fork (M4)"`.

## Just did

- API (cmd/allternit-api, Rust axum — not Go): GET /api/v1/brains list
  endpoint ALREADY existed (D2). Two minimal gaps fixed in
  src/brain_routes.rs: (1) list_brains now includes clone_url per row
  (derived from request host, same clone_url_for as provision — R4 needs it
  without a second round-trip); (2) parse_frontmatter now collects dashed
  YAML lists into JSON arrays — M3 learning pages' provenance_refs
  previously degraded into junk keys, which would have made R3's
  "provenance refs shown" impossible. Tests: extended
  provisioning_and_per_user_isolation (clone_url assertion) + new unit test
  frontmatter_dashed_lists_become_arrays. cargo test -p allternit-api
  brain_routes: 9/9 pass.
- Surface (Vite + React SPA — not Next.js): "brain" ViewType + policy row +
  ViewRegistry entry (lazy + ErrorBoundary, mirrors labs) + RailItem
  (phosphor Brain) in HOME TABS; src/services/brain-api.ts (typed fetch
  wrappers, readJson idiom); src/views/brain/{BrainView.tsx,brain-utils.ts}
  — brains card grid with clone-URL copy (Copy→Check feedback), in-view
  detail with pages grouped by directory (known dirs first) + Pill badges
  (type/status/domain/confidence) + ReactMarkdown/remark-gfm content,
  learnings rendered as Learning Feed (newest-first, stale dimmed
  opacity-50 + stale Pill, provenance refs shown), EmptyState with
  gizzi brain init / POST /api/v1/brains hint, loading/error-retry idioms.
  Read-only, no new deps.
- Verification: npx vitest run src/views/brain → 12/12 pass (10 utils + 2
  component: empty state, stale dimming + provenance visible). FULL surface
  sweep: 108 files / 829 tests pass, 0 failures. pnpm typecheck → only 4
  PRE-EXISTING errors in untouched files (capsule.registry, DesignPage,
  blocksuite-icons-lit shim). Dev API not reachable on :8013 — documented
  per build map. rail.config.tsx confirmed DEAD code (no consumers) —
  correctly left untouched. docs/META_M4_NOTES.md + sentinel written.

## Next

The prescribed commit:
`git add surfaces cmd .steering docs && git commit -m "feat(surfaces):
Brain section — pages, learning feed, fork (M4)"`.
Fix and retry if the gate blocks.

## Open questions

- (none)
