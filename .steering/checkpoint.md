# Steering checkpoint — ao/artifact-codemod-pilot3 (2026-09-19)

## Goal
Pilot 3 of the React Compiler artifact de-compilation codemod (spec:
docs/programs/gizzi/INK_APP_COMPILER_ARTIFACTS.md). Convert 30 artifacts:
permissions/rules (8) + deferred permissions (5) + components-root
message/input/dialog cluster (17).

## Just did
- Script hardening (3 patterns: straight-line fallback for bb0/sentinel/nested
  guards; rest-element destructure; destructured-binding dup renames), 30 files
  converted, ~85 type-drift errors fixed type-onlyly, tsc clean, bookkeeping
  regen (excluded 301->271, DONE 25 preserved, baseline 1336). 3 commits on
  ao/artifact-codemod-pilot3, rebased onto origin/main @ 5f7eda7f8.

## Next
PR + merge + ledger attestation + teardown; final report with GO/NO-GO for
pilot 4 (~271 artifacts remain; next cluster per spec ordering).

## Open questions
- None. Pilot 4 scope: next hot cluster (Spinner/?/CustomSelect/HighlightedCode
  subtree likely — decide by traffic).
