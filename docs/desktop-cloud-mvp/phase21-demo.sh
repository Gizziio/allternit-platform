#!/usr/bin/env bash
set -euo pipefail
cd /Users/joe/Desktop/allternit-workspace/allternit-session-desktop-cloud-mvp

echo "=== Phase 21: Multi-host Incus pool ==="
echo

echo "--- Line-count gate (<1500 LOC per feature) ---"
wc -l \
  cmd/allternit-computer-cloud/src/incus_pool.rs \
  cmd/allternit-computer-cloud/src/driver.rs

echo
echo "--- Incus pool unit tests ---"
cargo test -q -p allternit-computer-cloud incus_pool

echo
echo "--- API desktop tests (regression) ---"
cargo test -q -p allternit-api bot_desktop

echo
echo "--- Runtime: API started with INCUS_URL (single-host pool) ---"
grep -E "Incus driver ready" /tmp/allternit-api-pool.log | tail -1

echo
echo "--- Provision Linux still routes to Incus (image missing on VPS) ---"
curl -s -X POST \
  "http://127.0.0.1:8013/api/v1/bots/router-test-1/desktop/provision?os=linux" \
  -H "Authorization: Bearer dev"
echo

echo
echo "=== Phase 21 demo complete ==="
