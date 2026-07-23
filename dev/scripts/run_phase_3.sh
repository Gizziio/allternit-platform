#!/bin/bash
set -e

# RETIRED (2026-07-23): the capsule-runtime concept was superseded by gizzi-code
# capsules. The Python runtime and its acceptance tests were removed (tests
# archived to archive/tests-acceptance-capsule/). This runner also depended on
# scripts/law_setup.sh, which no longer exists. Kept as a pointer only.
echo "run_phase_3.sh is retired — capsule-runtime was deleted; see archive/tests-acceptance-capsule/" >&2
exit 1
