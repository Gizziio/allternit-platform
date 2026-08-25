#!/usr/bin/env bash
set -euo pipefail
cd /Users/joe/Desktop/allternit-workspace/allternit-session-desktop-cloud-mvp

echo "=== Phase 25: Billing / metering for desktop usage ==="
echo

echo "--- Line-count gate (<1500 LOC per module) ---"
wc -l cmd/allternit-api/src/bot_desktop_billing.rs

echo
echo "--- API desktop tests (regression) ---"
cargo test -q -p allternit-api bot_desktop

echo
echo "--- Pricing seeded in DB ---"
sqlite3 "/Users/joe/Library/Application Support/allternit/allternit.db" \
  "SELECT provider, os, price_per_minute FROM desktop_pricing;"

echo
echo "--- Usage summary with cost ---"
curl -s -H "Authorization: Bearer dev" http://127.0.0.1:8013/api/v1/desktop-usage/summary
echo

echo
echo "--- Usage line items ---"
curl -s -H "Authorization: Bearer dev" http://127.0.0.1:8013/api/v1/desktop-usage | head -c 700
echo

echo
echo "=== Phase 25 demo complete ==="
