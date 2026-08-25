#!/usr/bin/env bash
set -euo pipefail
cd /Users/joe/Desktop/allternit-workspace/allternit-session-desktop-cloud-mvp

echo "=== Phase 22: Desktop template registry and presets ==="
echo

echo "--- Line-count gate (<1500 LOC per module) ---"
wc -l \
  cmd/allternit-api/src/bot_desktop_templates.rs \
  cmd/allternit-api/src/bot_desktop_routes.rs

echo
echo "--- Template registry unit tests ---"
cargo test -q -p allternit-api bot_desktop_templates

echo
echo "--- API desktop tests (regression) ---"
cargo test -q -p allternit-api bot_desktop

echo
echo "--- List public Linux presets ---"
curl -s -H "Authorization: Bearer dev" \
  "http://127.0.0.1:8013/api/v1/desktop-templates?os=linux" | head -c 600
echo

echo
echo "--- Provision macOS from preset-macos template -> provider: tart ---"
curl -s -X POST \
  "http://127.0.0.1:8013/api/v1/bots/router-test-1/desktop/provision?template_id=preset-macos" \
  -H "Authorization: Bearer dev"
echo

echo
echo "--- Cleanup ---"
curl -s -X POST \
  "http://127.0.0.1:8013/api/v1/bots/router-test-1/desktop/deprovision" \
  -H "Authorization: Bearer dev"
echo

echo
echo "=== Phase 22 demo complete ==="
