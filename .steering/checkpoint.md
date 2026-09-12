# Checkpoint — artphase3-0912

## Goal
A:// Artifacts Phase 3 (issue #389): hosted publish/unpublish/status gateway
routes + deploy plumbing + minimal web actions + design-doc updates, per
docs/design/artifacts-api.md §6 decisions (2026-09-12).

## Just did
Read AGENTS.md ritual, design doc, Phase 1 content_artifact_routes.rs
(merged PR #411). Worktree created at origin/main (8abc71e76, includes sibling
artphase2-0912 merge #418). Latest migration V149 → mine is V150. No wrangler
code exists anywhere in the Rust tree — publisher must be new behind env switch.

## Next
Implement V150 migration + content_artifact_publish.rs + tests; mount in
main.rs; web surface actions; design doc; verify; PR; ritual.

## Open questions
- sandbox_policy gate semantics: reject any policy containing "network"
  (case-insensitive); document in error + PR. (Decided locally; design only
  says "requests network access".)
- Wrangler route removal: wrangler CLI can't remove per-route static content
  without redeploy; unpublish = redeploy tree minus artifact, old deployment
  URL stays live (faithful to decision 3). Will state in PR.
