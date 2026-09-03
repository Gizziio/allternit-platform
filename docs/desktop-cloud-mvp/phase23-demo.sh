#!/usr/bin/env bash
set -euo pipefail
cd /Users/joe/Desktop/allternit-workspace/allternit-session-desktop-cloud-mvp

echo "=== Phase 23: Desktop quotas and usage tracking ==="
echo

echo "--- Line-count gate (<1500 LOC per module) ---"
wc -l \
  cmd/allternit-api/src/bot_desktop_quotas.rs \
  cmd/allternit-api/src/bot_desktop_routes.rs \
  cmd/allternit-api/src/bot_desktop_templates.rs

echo
echo "--- Quota unit tests ---"
cargo test -q -p allternit-api bot_desktop_quotas

echo
echo "--- API desktop tests (regression) ---"
cargo test -q -p allternit-api bot_desktop

echo
echo "--- Set concurrent quota = 1 for local-dev-user ---"
sqlite3 "/Users/joe/Library/Application Support/allternit/allternit.db" \
  "INSERT OR REPLACE INTO desktop_quotas (user_id, max_concurrent, max_monthly_minutes) VALUES ('local-dev-user', 1, 10000);"
echo "quota set"

echo
echo "--- First provision succeeds ---"
curl -s -X POST \
  "http://127.0.0.1:8013/api/v1/bots/router-test-1/desktop/provision?template_id=preset-macos" \
  -H "Authorization: Bearer dev"
echo

echo
echo "--- Second concurrent provision is blocked ---"
curl -s -X POST \
  "http://127.0.0.1:8013/api/v1/bots/router-test-2/desktop/provision?template_id=preset-macos" \
  -H "Authorization: Bearer dev"
echo

echo
echo "--- Deprovision records usage ---"
curl -s -X POST \
  "http://127.0.0.1:8013/api/v1/bots/router-test-1/desktop/deprovision" \
  -H "Authorization: Bearer dev"
echo
sleep 2
sqlite3 "/Users/joe/Library/Application Support/allternit/allternit.db" \
  "SELECT bot_id, provider, minutes FROM desktop_usage WHERE user_id='local-dev-user' ORDER BY id DESC LIMIT 1;"

echo
echo "=== Phase 23 demo complete ==="
