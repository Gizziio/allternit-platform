---
status: done
files_changed:
  - cmd/allternit-api/src/brain_routes.rs
  - surfaces/ai.allternit.com/src/nav/nav.types.ts
  - surfaces/ai.allternit.com/src/nav/nav.policy.ts
  - surfaces/ai.allternit.com/src/shell/ViewRegistry.tsx
  - surfaces/ai.allternit.com/src/shell/ShellRail.tsx
  - surfaces/ai.allternit.com/src/services/brain-api.ts
  - surfaces/ai.allternit.com/src/views/brain/BrainView.tsx
  - surfaces/ai.allternit.com/src/views/brain/brain-utils.ts
  - surfaces/ai.allternit.com/src/views/brain/brain-utils.test.ts
  - surfaces/ai.allternit.com/src/views/brain/BrainView.test.tsx
  - .steering/checkpoint.md
  - docs/META_M4_NOTES.md
tests_green: true
deviations:
  - "cmd/allternit-api is a RUST (axum) service, not Go as the session habitually assumed. The D2 brains LIST endpoint (GET /api/v1/brains, user-scoped) already existed, so no endpoint was added; instead two minimal response gaps were fixed in brain_routes.rs: (1) the list rows now carry clone_url (derived from request host via the existing clone_url_for — R4 fork needs it without a provision-time round-trip), and (2) parse_frontmatter now collects dashed YAML lists into JSON arrays — without this, M3 learning pages' provenance_refs degraded into junk '- gate' keys and R3's 'provenance refs shown' was impossible through the pages API."
  - "surfaces/ai.allternit.com is a Vite + React 18 SPA with in-shell view switching (ViewType union + ViewRegistry + ShellRail), NOT a Next.js app as repo docs claim. The Brain section follows that: no react-router route, one 'brain' view key with internal list -> detail state."
  - "src/shell/rail/rail.config.tsx (RAIL_CONFIG) is dead code — grep confirms zero consumers; ShellRail.tsx's hardcoded RailItems are the live rail. Left untouched."
  - "pnpm typecheck fails with 4 PRE-EXISTING errors in untouched files (capsule.registry.ts 'studio' ViewType, DesignPage.tsx better-auth Session, blocksuite-icons-lit virtual-module shim x2). Zero errors in any file this phase created or modified; left as-is per scope."
  - "Dev API on localhost:8013 was unreachable during the phase, so the Gherkin 'real data' scenario is verified by the API oneshot tests + the component tests with mocked service responses, not a live server (build map allows documenting instead)."
  - "Environment note: the workspace had no node_modules; a full-workspace `pnpm install --ignore-scripts` was needed to run vitest/tsc (native builds skipped; no manifest/lockfile changes)."
  - "Known-dirs group order (decisions, runbooks, ideas, pains, learnings) then alphabetical, '(root)' last — spec pinned only 'grouped by directory'; locked in by unit test."
remaining:
  - "Brain list entries have no human name (brains table has no name column); the UI shows short id + created date. If names are wanted, that's a V33-schema follow-up."
  - "Page cards are plain (not collapsible); long brains will want collapsing or pagination."
  - "Clone URLs for brains provisioned before this change are computed identically at list time, so no backfill is needed — but they depend on the request host headers being correct behind the deployment proxy."
  - "The 4 pre-existing typecheck errors remain for their owning tracks."
---
# M4 — brain as a first-class web surface section: completion notes

## What was built (spec .steering/spec.md R1–R4, task docs/META_M4_TASK.md)

### R1 — first-class Brain section + brains list

- The D2 list endpoint already existed; no new route. The surface gets a
  top-level nav entry: `"brain"` in `ViewType` (nav.types.ts), a singleton
  policy row (nav.policy.ts), a lazy `BrainView` registry entry with
  ErrorBoundary (ViewRegistry.tsx, mirroring `labs`), and a `RailItem` with
  the phosphor `Brain` icon in HOME TABS (ShellRail.tsx).

### R2 — brain detail: grouped pages + badges

- `GET /api/v1/brains/:id/pages` consumed via `src/services/brain-api.ts`
  (typed wrappers, readJson idiom, React Query) → `groupPagesByDirectory`
  (known dirs decisions/runbooks/ideas/pains/learnings first, then
  alphabetical, `(root)` last); each page card shows frontmatter badges
  (type/status/domain/confidence as Pills) and markdown content via
  react-markdown + remark-gfm inside `.allternit-markdown` (DiscoveryFeed
  idiom).

### R3 — Learning Feed

- The learnings group renders as "Learning Feed": `learningFeed` sorts
  newest-first (frontmatter.added desc, path tiebreak), stale lessons
  (`status: stale`) are dimmed (`opacity-50` + stale Pill), provenance refs
  are shown in small mono (normalized from the dashed-list array OR a
  comma-separated string).
- API side: `parse_frontmatter` now emits dashed YAML lists as JSON arrays,
  so M3's `provenance_refs` actually reach the surface.

### R4 — fork = clone URL + copy

- `list_brains` rows now include `clone_url` (request-host-derived, same
  `clone_url_for` as provision); every brain card shows it with a copy
  button (local copyToClipboard helper + Copy→Check feedback, the
  LibraryItemDialog idiom).

### Empty state

- No brains → shared `EmptyState` explaining `gizzi brain init` /
  `POST /api/v1/brains`; a brain with no pages gets its own empty state.

## Tests

- API: `frontmatter_dashed_lists_become_arrays` (dashed lists → arrays,
  valued keys stay strings, list-less empty key keeps old empty-string
  behavior) + extended `provisioning_and_per_user_isolation` (list rows
  carry clone_url). `cargo test -p allternit-api brain_routes`: 9/9 pass.
- Surface: `brain-utils.test.ts` (10 — group ordering, feed sort, stale
  detection, provenance normalization, badge extraction) +
  `BrainView.test.tsx` (2 — empty-state create hint; feed dims the stale
  card, newest-first, provenance visible for array and comma-string forms).
- Full surface sweep: `npx vitest run` → 108 files / 829 tests pass, 0
  failures. `pnpm typecheck` → only 4 pre-existing errors in untouched
  files.

## Constraints honored

- Read-only surface — no mutations anywhere in the UI.
- No new dependencies (react-markdown, remark-gfm, React Query,
  phosphor-icons all already present).
- API change confined to brain_routes.rs response shaping; no schema, no
  route changes.
