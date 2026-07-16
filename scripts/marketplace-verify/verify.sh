#!/usr/bin/env bash
# One-command marketplace verification (no builds, no vitest, no typecheck):
#   1. every *.test.ts marketplace suite under plain Node via the local shim
#   2. intake worker end-to-end smoke against a fake registry
#   3. rustfmt parse/format checks for the registry crate
#   4. registry SQL smoke suite against a scratch PostgreSQL (skipped when
#      psql is unavailable)
# Usage: scripts/marketplace-verify/verify.sh
set -uo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"

echo "── node suites (vitest shim) ────────────────────────────────"
node --import "data:text/javascript,import { register } from 'node:module'; register('file://$ROOT/scripts/marketplace-verify/hooks.mjs');" \
  scripts/marketplace-verify/run-all.mjs
NODE_STATUS=$?

echo ""
echo "── intake worker smoke ──────────────────────────────────────"
node --import "data:text/javascript,import { register } from 'node:module'; register('file://$ROOT/scripts/marketplace-verify/hooks.mjs');" \
  services/registry/intake-worker/worker-smoke.mjs
WORKER_STATUS=$?

echo ""
echo "── rustfmt checks (registry crate) ──────────────────────────"
RUST_STATUS=0
if command -v rustfmt >/dev/null 2>&1; then
  for file in services/registry/apps-registry/src/*.rs; do
    if ! rustfmt --check --edition 2024 "$file" >/dev/null 2>&1; then
      echo "rustfmt FAILED: $file"
      RUST_STATUS=1
    fi
  done
  [ "$RUST_STATUS" -eq 0 ] && echo "rustfmt clean"
else
  echo "rustfmt not found; skipped"
fi

echo ""
echo "── registry SQL smoke ───────────────────────────────────────"
SQL_STATUS=0
if command -v psql >/dev/null 2>&1 || [ -x /opt/homebrew/opt/postgresql@16/bin/psql ]; then
  services/registry/apps-registry/scripts/sql-smoke.sh >/dev/null 2>&1 \
    && echo "SQL smoke passed" \
    || { echo "SQL smoke FAILED"; SQL_STATUS=1; }
else
  echo "psql not found; skipped"
fi

echo ""
if [ "$NODE_STATUS" -eq 0 ] && [ "$WORKER_STATUS" -eq 0 ] && [ "$RUST_STATUS" -eq 0 ] && [ "$SQL_STATUS" -eq 0 ]; then
  echo "ALL MARKETPLACE VERIFICATION PASSED"
else
  echo "VERIFICATION FAILED (node=$NODE_STATUS worker=$WORKER_STATUS rustfmt=$RUST_STATUS sql=$SQL_STATUS)"
  exit 1
fi
