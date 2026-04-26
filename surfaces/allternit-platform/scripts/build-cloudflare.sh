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

set -euo pipefail

API_DIR="src/app/api"
API_TEMP="src/_api_cf_excluded"

cleanup() {
  if [ -d "$API_TEMP" ] && [ ! -d "$API_DIR" ]; then
    mv "$API_TEMP" "$API_DIR"
    echo "[build-cloudflare] Restored $API_DIR"
  fi
}
trap cleanup EXIT

echo "[build-cloudflare] Hiding $API_DIR from Next.js app router..."
mv "$API_DIR" "$API_TEMP"

echo "[build-cloudflare] Running static export build..."
CLOUDFLARE_PAGES=1 node_modules/.bin/next build

echo "[build-cloudflare] Build complete."
