#!/usr/bin/env bash
# build-cloudflare.sh
#
# Builds the platform for Cloudflare Pages static export.
#
# The src/app/api directory contains server-only route handlers that import
# native Node.js binaries (better-sqlite3, node-pty, ssh2, etc.) which cannot
# run during Next.js static generation. This script temporarily moves the API
# directory out of the app router scope for the duration of the build, then
# restores it regardless of whether the build succeeds or fails.
#
# Safe to run from any working directory — always operates relative to the
# surfaces/allternit-platform package root.

set -euo pipefail

# Resolve the package root as the directory containing this script's parent.
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PACKAGE_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$PACKAGE_ROOT"

API_DIR="src/app/api"
API_TEMP="src/_api_cf_excluded"

cleanup() {
  if [ -d "$API_TEMP" ] && [ ! -d "$API_DIR" ]; then
    mv "$API_TEMP" "$API_DIR"
    echo "[build-cloudflare] Restored $API_DIR"
  fi
}
trap cleanup EXIT

# Guard against double-stashing (e.g. if the script is re-run after a partial failure
# that left the API dir in the temp location but never restored it).
if [ -d "$API_TEMP" ] && [ ! -d "$API_DIR" ]; then
  echo "[build-cloudflare] Warning: $API_TEMP already exists and $API_DIR is missing." >&2
  echo "[build-cloudflare] Restoring from previous interrupted build before continuing..." >&2
  mv "$API_TEMP" "$API_DIR"
fi

echo "[build-cloudflare] Hiding $API_DIR from Next.js app router..."
mv "$API_DIR" "$API_TEMP"

echo "[build-cloudflare] Running static export build (CLOUDFLARE_PAGES=1)..."
export CLOUDFLARE_PAGES=1
node_modules/.bin/next build

echo "[build-cloudflare] Build complete. Output is in $PACKAGE_ROOT/out"
