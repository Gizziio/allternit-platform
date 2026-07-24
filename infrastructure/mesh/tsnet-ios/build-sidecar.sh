#!/usr/bin/env bash
# Build the mesh-node tsnet sidecar into gizzi-code's vendor tree, matching
# the layout used by vendor/cloudflared: vendor/mesh-node/<platform>-<arch>/mesh-node
# (the platform-arch convention is `${process.platform}-${process.arch}` in
# gizzi-code's tunnel.ts/mesh.ts). Idempotent: safe to re-run.
set -euo pipefail

cd "$(dirname "$0")"

OUT_BASE="../../../cmd/gizzi-code/vendor/mesh-node"

PLATFORMS=(
  darwin-arm64
  linux-amd64
)

for pa in "${PLATFORMS[@]}"; do
  GOOS="${pa%-*}"
  GOARCH="${pa#*-}"
  out="$OUT_BASE/$pa/mesh-node"
  mkdir -p "$(dirname "$out")"
  CGO_ENABLED=0 GOOS="$GOOS" GOARCH="$GOARCH" \
    go build -ldflags="-s -w" -o "$out" ./cmd/mesh-node
  echo "Built: $out"
done
