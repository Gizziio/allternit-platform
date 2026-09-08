# Checkpoint — cu4-rebrand

## Goal
Rebrand the computer-use tool contract to vendor-neutral Allternit branding: add
`allternitToolType`/`computerToolVersion` alongside legacy `anthropicType`, add
computer_20251124 action-set support, update tests + 5 docs files. Touch only
sdk/allternit-sdk/** and docs/public/**.

## Just did
- computer-use.ts: versioned action enums (20250124 = 16 actions, 20251124 = +zoom),
  toolVersion/enableZoom options, region param, allternitToolType/computerToolVersion
  metadata emitted alongside legacy anthropicType (switches with version).
- Rebuilt tracked dist for the capability only (reverted unrelated pre-existing
  dist/index.js drift).
- Tests: updated 20250124 test + added 20251124 zoom/region coverage — both pass.
- Full tool-belt suite: 24 passed, 2 failed — failures are pre-existing on main
  (bash/code injectable runner tests), identical in shared checkout.
- tsc: only pre-existing error (missing generated ./gen) — no new errors.
- docs-lint: PASS. Updated all 5 docs files (Allternit type primary, upstream
  types framed as legacy-compat adapters).

## Next
- Commit, push session/cu4-rebrand, open PR (do NOT merge).

## Open questions
- None.
