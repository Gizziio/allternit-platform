# Steering checkpoint — session/coworkp1-0914

## Goal
Consumer-packaged Cowork P4 (mobile approvals + routines) + P5 updater-feed
lock, landing on main. P1–P3 already merged (#507/#508/#512). Resume of
Kimi session_93cc7789 after 5-hour quota stop.

## Just did
- Forward-merged origin/main (including #513/#514/#515/#516) into this
  worktree. FabricTransportView now has both Routines (this session) and
  Workflows (cu29).
- P4.1 iOS FabricTransportClient + FabricApprovalsView.
- P4.2 routines CRUD + tick; fire carries the routine message as
  `agentic.task`. 4/4 routine_routes tests green.
- P5.1 updater feed locked to `Gizziio/desktop`; preflight 39/0.

## Next
Commit, PR, merge to main, attestation. Signing/notarization remains
owner-gated. iOS simulator click-through not claimed (Mesh.xcframework).

## Open questions
- Cloud continuation out of v1.
- `desktop-v1.2.0` needs APPLE_* secrets — owner action.
