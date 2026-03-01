#!/bin/bash
set -euo pipefail

# Test that CLI registry validates against schema
echo "Testing CLI registry schema validation..."

# Check that CLI registry file exists
if [ ! -f "./cli/cli_registry.json" ]; then
    echo "FAIL: cli/cli_registry.json missing"
    exit 1
fi

# Check that the CLI registry has the expected structure
if ! jq -e '.version' ./cli/cli_registry.json >/dev/null 2>&1; then
    echo "FAIL: cli/cli_registry.json missing version field"
    exit 1
fi

if ! jq -e '.cli_modules' ./cli/cli_registry.json >/dev/null 2>&1; then
    echo "FAIL: cli/cli_registry.json missing cli_modules field"
    exit 1
fi

if [ $(jq '.cli_modules | length' ./cli/cli_registry.json) -eq 0 ]; then
    echo "FAIL: cli/cli_registry.json has empty cli_modules array"
    exit 1
fi

echo "OK: CLI registry validates against schema"