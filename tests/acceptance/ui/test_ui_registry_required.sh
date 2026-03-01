#!/bin/bash
set -e

# ROOT is one level up from tests/acceptance/ui/.. wait
# /Users/macbook/Desktop/a2rchitech-workspace/a2rchitech/tests/acceptance/ui
ROOT="$(pwd)"

echo "Running AT-UI-0001: UI registry is required"

# 1. Ensure it passes currently
python3 scripts/validate_law.py > /dev/null
echo "Pre-check: OK"

# 2. Move registry
mv ui/ui_registry.json ui/ui_registry.json.bak

# 3. Ensure it fails
if python3 scripts/validate_law.py > /tmp/ui_fail.log 2>&1; then
    echo "FAIL: validate_law passed without ui_registry.json"
    mv ui/ui_registry.json.bak ui/ui_registry.json
    exit 1
else
    echo "Success: validate_law failed as expected"
    grep "ui/ui_registry.json" /tmp/ui_fail.log
fi

# 4. Restore
mv ui/ui_registry.json.bak ui/ui_registry.json
echo "AT-UI-0001: PASSED"
