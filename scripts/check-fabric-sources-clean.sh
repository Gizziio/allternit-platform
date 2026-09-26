#!/usr/bin/env bash
# Fabric source hygiene gate — fails if any tracked source file under the
# subscription-fabric trees contains a NUL byte. Executors' file writes have
# twice embedded NUL bytes into TS sources (2026-09-26: resolve.ts P4 review
# catch; scheduler.ts/supervisor.ts/bin/allternit.js hygiene sweep) which made
# git treat the files as binary and silently broke grep/code-review on them.
#
# NOTE: do NOT use `grep $'\x00'` for this — bash cannot pass NUL in an
# argument, so $'\x00' expands to an empty pattern and matches EVERY line,
# i.e. every file "fails". The perl /\x00/ test below matches the real byte.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

fail=0
while IFS= read -r f; do
  if perl -ne 'if (/\x00/) { exit 0 } END { exit 1 }' "$f"; then
    echo "NUL byte in $f" >&2
    fail=1
  fi
done < <(git ls-files \
  'services/subscription-gateway/*.ts' \
  'services/subscription-gateway/*.sql' \
  'services/subscription-gateway/*.yaml' \
  'cmd/cli/*.ts' \
  'cmd/cli/bin/*.js' \
  'platform/packages/subscription-fabric-contracts/*.ts' \
  'platform/packages/subscription-adapter-sdk/*.ts')

if [ "$fail" -ne 0 ]; then
  echo "check-fabric-sources-clean: FAIL" >&2
  exit 1
fi
echo "check-fabric-sources-clean: OK"
