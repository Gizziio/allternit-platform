#!/usr/bin/env bash
set -euo pipefail
cd /Users/joe/Desktop/allternit-workspace/allternit-session-desktop-cloud-mvp

echo "=== Phase 24: Capacity monitoring and autoscaling signals ==="
echo

echo "--- Line-count gate (<1500 LOC per module) ---"
wc -l cmd/allternit-api/src/bot_desktop_capacity.rs

echo
echo "--- Capacity monitor unit tests ---"
cargo test -q -p allternit-api bot_desktop_capacity

echo
echo "--- API desktop tests (regression) ---"
cargo test -q -p allternit-api bot_desktop

echo
echo "--- Current capacity snapshot ---"
curl -s -H "Authorization: Bearer dev" http://127.0.0.1:8013/api/v1/desktop-capacity | head -c 500
echo

echo
echo "--- Simulate high utilization in monitor log ---"
grep -E "capacity monitor sample|autoscale" /tmp/allternit-api-capacity.log | tail -5 || true

echo
echo "=== Phase 24 demo complete ==="
