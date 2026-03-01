#!/usr/bin/env bash
set -euo pipefail

tmpfile=$(mktemp)
trap 'rm -f "$tmpfile"' EXIT

scripts/rcp-001-codebase-generate.sh > "$tmpfile"

diff -u CODEBASE.md "$tmpfile"
