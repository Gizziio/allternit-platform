#!/usr/bin/env bash
# ensure-sdk-dist.sh — build packages/sdk dist if it is missing or stale.
#
# Why this exists:
#   packages/sdk/dist is gitignored (only dist/gen is tracked, vendored from
#   the canonical release repo). A fresh clone/worktree therefore has a dist/
#   containing ONLY gen/, and any src/ newer than the last build leaves stale
#   output behind. Both cases make `bun run typecheck` fail with TS2307
#   ("Cannot find module '../dist/...'") in packages/sdk/scripts/verify-sdk.ts,
#   and make `bun test` silently resolve @allternit/sdk against a stale build.
#
# What this does:
#   - No-op if dist/index.js exists AND no packages/sdk/src file is newer
#     than it (find -newer check).
#   - Otherwise runs the SDK build (packages/sdk/scripts/build.mjs — plain
#     tsc emit; ~1.8k pre-existing type errors are the known baseline and do
#     not fail the build).
#   - Exits non-zero if the sentinel dist/index.js is still missing after the
#     build, so callers fail loudly instead of typechecking a broken tree.
#
# Usage: bash script/ensure-sdk-dist.sh   (from anywhere; resolves its own root)
# Set GIZZI_SKIP_SDK_DIST=1 to skip (e.g. CI images that pre-build the SDK).

set -u

if [ "${GIZZI_SKIP_SDK_DIST:-0}" = "1" ]; then
  echo "ensure-sdk-dist: skipped (GIZZI_SKIP_SDK_DIST=1)"
  exit 0
fi

cd "$(dirname "$0")/.."

SDK="packages/sdk"
SENTINEL="$SDK/dist/index.js"

if [ ! -d "$SDK/src" ]; then
  echo "ERROR: ensure-sdk-dist: $SDK/src not found (run from the gizzi-code tree)" >&2
  exit 1
fi

stale=0
if [ ! -f "$SENTINEL" ]; then
  stale=1
  reason="missing $SENTINEL (fresh clone/worktree: only tracked dist/gen is present)"
elif find "$SDK/src" -type f -name '*.ts' -newer "$SENTINEL" | grep -q .; then
  stale=1
  reason="packages/sdk/src is newer than $SENTINEL"
fi

if [ "$stale" -eq 1 ]; then
  echo "ensure-sdk-dist: rebuilding packages/sdk dist ($reason)"
  (cd "$SDK" && bun run build)
  if [ ! -f "$SENTINEL" ]; then
    echo "ERROR: ensure-sdk-dist: build finished but $SENTINEL is still missing" >&2
    exit 1
  fi
  echo "ensure-sdk-dist: dist rebuilt"
fi

exit 0
