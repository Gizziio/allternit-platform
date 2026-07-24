#!/usr/bin/env bash
# Build Mesh.xcframework from the gomobile module in this directory.
# Idempotent: removes any previous output first. Safe to re-run.
set -euo pipefail

cd "$(dirname "$0")"
export PATH="$PATH:$HOME/go/bin"

OUT="Mesh.xcframework"
rm -rf "$OUT"

gomobile bind \
  -target=ios \
  -iosversion=17.0 \
  -ldflags=-w \
  -o "$OUT" \
  .

echo "Built: $(pwd)/$OUT"
