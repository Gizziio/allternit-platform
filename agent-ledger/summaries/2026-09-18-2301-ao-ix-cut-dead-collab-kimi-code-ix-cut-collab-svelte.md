# 2026-09-18-2301 ao/ix-cut-dead-collab — cut ix collab/svelte dead code

Session: ao/ix-cut-dead-collab (kimi-code subagent) · PR #651 · merge SHA 54110c8fae1d98d1bbd0f647e0858084ce62e678

## What was done

Owner decision 2026-09-18 (CUT): removed the never-implemented, unbuildable
`src/collab` and `src/svelte` subtrees from `platform/packages/ix` plus their
documentation. The undeclared-deps sweep showed these subtrees import 5 packages
(`yjs`, `y-webrtc`, `y-protocols`, `lib0`, `svelte`) that are absent from
pnpm-lock.yaml entirely — the code could not compile, and implementing it would be
a multi-day feature build with zero demand evidence.

Commit `a2e93a522` — 12 files changed, 8 insertions, 2,496 deletions:

- Deleted `platform/packages/ix/src/collab/` (8 files: yjs-adapter, yjs-client,
  yjs-protocols, yjs-types, yjs.d.ts shim, capsule-registry, visual-editor, index)
- Deleted `platform/packages/ix/src/svelte/` (2 files: renderer, index)
- Removed `export * from './collab'` from `src/index.ts`
- Trimmed README sections documenting the removed features (Svelte renderer,
  Real-time Collaboration, architecture tree, roadmap bullet list)

## Verification evidence

- Premise check on main @ 5506dc52f: the 5 undeclared imports confined to
  `src/collab` + `src/svelte` (grep, both quote styles)
- No consumers: only in-package importer was `src/index.ts`; zero repo-wide
  source importers of `@allternit/ix` outside ix (sdk dist hits are stale build
  artifacts, not source)
- package.json exports map never exposed `./collab` or `./svelte` subpaths —
  no subpath removal needed (noted in PR body)
- ix NOT in gizzi-code burn zone: 0 matches in
  cmd/gizzi-code/script/typecheck-burndown/queue.json → burn oracle skipped
- `pnpm --filter @allternit/ix build` ✅ (tsc clean)
- `pnpm --filter @allternit/ix typecheck` ✅
- `pnpm --filter @allternit/ix test` ✅ 170/170 across 7 files
- `pnpm install --frozen-lockfile` exit 0; `git diff pnpm-lock.yaml` empty —
  lockfile byte-unchanged, zero deps added; the 5 packages confirmed absent
  from the lockfile
- `node scripts/release-preflight.mjs` — 52 passed, 0 failed
- Post-cut grep under platform/packages/ix: zero remaining
  yjs/y-webrtc/y-protocols/lib0/svelte imports
- `docs/programs/gizzi/DORMANT_STUB_DECISIONS.md`: ix not listed — no row update

## Incidents / deferrals

None. No runtime behavior change (the removed code could not build). Reviving
collab/svelte later is a fresh feature build, not a revert — the deleted files
remain reachable via git history at a2e93a522.
