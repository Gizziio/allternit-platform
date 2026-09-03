#!/usr/bin/env bash
set -euo pipefail
cd /Users/joe/Desktop/allternit-workspace/allternit-session-desktop-cloud-mvp

echo "=== Phase 20: Substrate Router (Incus + Tart) ==="
echo

echo "--- Line-count gate (<1500 LOC per module) ---"
wc -l \
  cmd/allternit-computer-cloud/src/router.rs \
  cmd/allternit-api/src/bot_desktop_routes.rs

echo
echo "--- Router unit tests ---"
cargo test -q -p allternit-computer-cloud router

echo
echo "--- API desktop tests ---"
cargo test -q -p allternit-api bot_desktop

echo
echo "--- Runtime: wrapper + API with both drivers ---"
ps aux | grep -E 'tart-host|allternit-api' | grep -v grep | awk '{print $11, $12}'

echo
echo "--- Provision macOS -> expected provider: tart ---"
curl -s -X POST \
  "http://127.0.0.1:8013/api/v1/bots/router-test-1/desktop/provision?os=macos" \
  -H "Authorization: Bearer dev"
echo

echo
echo "--- Provision Linux -> routed to Incus (host lacks nested KVM/image, error is proof of routing) ---"
curl -s -X POST \
  "http://127.0.0.1:8013/api/v1/bots/router-test-2/desktop/provision?os=linux" \
  -H "Authorization: Bearer dev"
echo

echo
echo "--- Cleanup macOS test VM ---"
curl -s -X POST \
  "http://127.0.0.1:8013/api/v1/bots/router-test-1/desktop/deprovision" \
  -H "Authorization: Bearer dev"
echo

echo
echo "=== Phase 20 demo complete ==="
