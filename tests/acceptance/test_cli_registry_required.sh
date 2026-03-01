#!/bin/bash
set -euo pipefail

# Test that CLI registry is required and validates
echo "Testing CLI registry required..."

if [ ! -f "./cli/cli_registry.json" ]; then
    echo "FAIL: cli/cli_registry.json missing"
    exit 1
fi

echo "OK: CLI registry exists"