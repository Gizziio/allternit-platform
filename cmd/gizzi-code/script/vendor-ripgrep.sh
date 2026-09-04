#!/usr/bin/env bash
# Vendor ripgrep into gizzi-code's distribution tree:
# vendor/ripgrep/<arch>-<platform>/rg — downloaded from the official
# BurntSushi/ripgrep releases.
#
# Usage:
#   script/vendor-ripgrep.sh [version]   # default version: 15.1.0
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
GIZZI_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
VDIR="$GIZZI_DIR/vendor/ripgrep"
VER="${1:-15.1.0}"

mkdir -p "$VDIR"
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT
cd "$WORK"

fetch() {
  local triple="$1" layout="$2" kind="$3"  # kind: tar.gz|zip
  local url="https://github.com/BurntSushi/ripgrep/releases/download/${VER}/ripgrep-${VER}-${triple}.${kind}"
  echo "== ${layout} <- ${url}"
  if [ "$kind" = "zip" ]; then
    curl -fsSL "$url" -o rg.zip && unzip -o -q rg.zip
    local dir="ripgrep-${VER}-${triple}"
    mkdir -p "$VDIR/$layout"
    cp "$dir/rg.exe" "$VDIR/$layout/rg.exe"
  else
    curl -fsSL "$url" -o rg.tgz && tar xzf rg.tgz
    local dir="ripgrep-${VER}-${triple}"
    mkdir -p "$VDIR/$layout"
    cp "$dir/rg" "$VDIR/$layout/rg"
    chmod +x "$VDIR/$layout/rg"
  fi
}

fetch "aarch64-apple-darwin" "arm64-darwin" "tar.gz"
fetch "x86_64-apple-darwin" "x64-darwin" "tar.gz"
fetch "aarch64-unknown-linux-gnu" "arm64-linux" "tar.gz"
fetch "x86_64-unknown-linux-musl" "x64-linux" "tar.gz"
fetch "x86_64-pc-windows-msvc" "x64-win32" "zip"

echo "vendor tree:"
ls -R "$VDIR"
