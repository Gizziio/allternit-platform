# Phase 4 — end-to-end verification (real backend, real CLI, real app)

Read `docs/HTML_ARTIFACTS_MAP.md` and all three prior NOTES files first — all
three phases are reviewed and approved. This phase makes NO source changes
to `cmd/allternit-api`, `cmd/gizzi-code`, or the iOS app unless you discover
a genuine integration bug in how they fit together (a real bug found here is
in scope to fix; scope creep or polish is not — if you're unsure which one
something is, document it and ask rather than just doing it).

## Goal

Prove the whole loop works with real running processes, not fixtures:
`gizzi html-artifact publish` → a real `allternit-api` instance → the real
iOS app's Artifacts Library, twice (first publish, then a redeploy of the
same key) so the version-increment/single-row behavior is visible end to
end in the actual UI, not just via curl/sqlite3 (Phases 1/2 already proved
that half).

## Known constraint — do not fabricate real auth

Phase 3 found the iOS Simulator's fresh install has no authenticated Clerk
session, and correctly declined to fabricate one or weaken real auth to get
around it — do the same. Instead, use the pre-existing, legitimate
dev-fallback path that already exists in this codebase specifically for
local development (grep to confirm current exact form before relying on
it — it was documented by an earlier investigation as `APIClient`'s
debug-build fallback sending `x-allternit-user-id: dev-ios-tester` /
`Bearer dev-api-token`, and `allternit-api`'s `ALLTERNIT_LOCAL_DEV_BYPASS`).
This is not a workaround you're inventing — it's an existing mechanism
built for exactly this purpose. If it turns out not to actually work
end-to-end (e.g. the dev token isn't accepted by a locally-run
`allternit-api`), document precisely what happens and how far you got
rather than forcing it.

## Steps

1. Build and run `allternit-api` from this worktree (Phase 1's approved
   backend) against a throwaway `ALLTERNIT_DATA_DIR`, with
   `ALLTERNIT_LOCAL_DEV_BYPASS=true` (same setup Phases 1/2 already proved
   works).
2. From `cmd/gizzi-code` in this same worktree, publish a real artifact via
   the `html-artifact publish` command's real handler (Phase 2 already
   showed the interactive CLI entrypoint can't boot in this worktree due to
   pre-existing unrelated missing deps — reuse Phase 2's workaround of
   invoking the exported handler directly, or fix the underlying dep gap if
   it's quick; your call, document which). Confirm via the API directly
   (curl/sqlite3) that it landed as version 1.
3. Redeploy the same `--key` with different content. Confirm version 2,
   same canvas id, same row (this repeats Phase 2's own verification —
   that's fine, the point here is doing it once more as a precondition for
   step 4, not re-litigating it).
4. Build and launch the iOS app in the Simulator (Phase 3 already proved
   this builds and launches clean — reuse that setup, including the
   `Mesh.xcframework` prerequisite copy it documented). Get past the
   Clerk/loading screen using the dev-fallback path. Trigger
   `refreshFromBackend()` (however the UI exposes it — check
   `ArtifactsLibraryView.swift`) pointed at your local `allternit-api`
   instance from step 1.
5. Confirm in the actual running app: the artifact appears in the Artifacts
   Library, opening it renders the real HTML (tabs/callout/etc. from
   whatever `ArtifactInput` you published) inside the sandboxed WebView, and
   its stored `version` matches what step 3 produced (2, not 1 — proving the
   redeploy-in-place is visible through the real UI, not just the API).
6. Tear down all test servers/simulators/scratch data afterward. Never touch
   the real dev database, real Clerk session state, or real pairing state on
   this machine.

## Deliverable

`docs/HTML_ARTIFACTS_PHASE_4_NOTES.md`, same frontmatter contract as prior
phases. Prose: exact commands run, exact output/screenshots-described, and
an honest final verdict — does the full loop actually work end to end right
now, or is there a real remaining gap (name it precisely, don't paper over
it). This is the last phase — after this, summarize the whole 4-phase
effort's final state (what's shippable now vs. what a human should look at
before merging `ao/html-artifacts` to `main`, e.g. the still-unverified
paired-device auth path Phase 2 flagged, or anything else you found along
the way that's out of scope to fix but worth flagging).
