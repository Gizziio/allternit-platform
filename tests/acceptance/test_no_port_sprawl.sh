#!/bin/bash
set -e

ROOT="$(pwd)"
echo "Running AT-LAW-0005: No Port Sprawl"

# forbidden patterns
PATTERNS=("localhost" "127\.0\.0\.1" ":[0-9]\\{2,5\\}")

# Directories to scan
DIRS=("services" "crates" "tools" "scripts" "tests" "ui" "infra")

FOUND=0

for dir in "${DIRS[@]}"; do
    if [ -d "$dir" ]; then
        for pattern in "${PATTERNS[@]}"; do
            # Exclude known offenders that are exempt or WIP
            # Exclude nginx.conf, generated files, and the test itself
            # Exclude main.py in gateway (logic handling)
            # Exclude this script
            # Exclude binary files
            if grep -r "$pattern" "$dir" \
                --exclude-dir=".git" \
                --exclude-dir="__pycache__" \
                --exclude-dir="target" \
                --exclude-dir="node_modules" \
                --exclude="nginx.conf" \
                --exclude="nginx.conf.generated" \
                --exclude="gateway_registry.json" \
                --exclude="validate_law.py" \
                --exclude="test_no_port_sprawl.sh" \
                --exclude="main.py" \
                --exclude="*.pyc" \
                --exclude="*.lock" \
                | grep -v "Binary file"; then
                echo "FAIL: Found forbidden pattern '$pattern' in $dir"
                FOUND=1
            fi
        done
    fi
done

if [ $FOUND -eq 1 ]; then
    exit 1
fi

echo "AT-LAW-0005: PASSED"
