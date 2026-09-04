#!/usr/bin/env bash
# update-packaging-hashes.sh — download the current gizzi-code release assets
# and rewrite the sha256 placeholder fields in packaging/{homebrew,scoop,
# chocolatey,arch}. Run this at release time, after the GitHub release assets
# for the version in packaging (and cmd/gizzi-code/package.json) are published.
#
# Usage:
#   bash script/update-packaging-hashes.sh              # uses latest release
#   bash script/update-packaging-hashes.sh 1.0.2        # explicit version
#   TAG_PREFIX=gizzi-code bash script/update-packaging-hashes.sh 1.0.2
#
# The release workflow (.github/workflows/release-gizzi-code.yml) tags releases
# "gizzi-code/<version>" (no leading v) and names assets
# gizzi-code-v<version>-<target>.<ext>. Override with TAG_V=v if that changes.
set -euo pipefail

REPO="Gizziio/allternit-platform"
TAG_PREFIX="${TAG_PREFIX:-gizzi-code}"
TAG_V="${TAG_V-}"

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if [ $# -ge 1 ]; then
  VERSION="$1"
else
  VERSION="$(curl -fsSL "https://api.github.com/repos/${REPO}/releases/latest" \
    | sed -n 's/.*"tag_name": *"\([^"]*\)".*/\1/p' \
    | sed -e "s|^${TAG_PREFIX}/||" -e 's/^v//')"
fi

if [ -z "$VERSION" ]; then
  echo "Error: could not resolve version" >&2
  exit 1
fi

TAG="${TAG_PREFIX}/${TAG_V}${VERSION}"
BASE="https://github.com/${REPO}/releases/download/${TAG}"
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

hash_file="$WORK/hashes.txt"
: > "$hash_file"
ok=true
for target in darwin-arm64 darwin-x64 linux-arm64 linux-x64 windows-x64; do
  ext="tar.gz"
  case "$target" in
    windows-*) ext="zip" ;;
  esac
  asset="gizzi-code-v${VERSION}-${target}.${ext}"
  url="${BASE}/${asset}"
  echo "Downloading ${asset}..."
  if ! curl -fL --retry 3 -o "$WORK/$asset" "$url"; then
    echo "Warning: ${url} not downloadable yet — leaving __SHA256_$(echo "$target" | tr 'a-z-' 'A-Z_')__ placeholder" >&2
    ok=false
    continue
  fi
  digest="$(shasum -a 256 "$WORK/$asset" | awk '{print $1}')"
  echo "${target} ${digest}" >> "$hash_file"
  echo "  sha256: ${digest}"
done

replace() {
  local file="$1" key="$2" target="$3"
  local digest
  digest="$(awk -v t="$target" '$1 == t {print $2}' "$hash_file")"
  if [ -n "$digest" ]; then
    perl -pi -e "s/__SHA256_${key}__/${digest}/g" "$file"
  fi
}

replace packaging/homebrew/gizzi-code.rb DARWIN_ARM64 darwin-arm64
replace packaging/homebrew/gizzi-code.rb DARWIN_X64 darwin-x64
replace packaging/homebrew/gizzi-code.rb LINUX_ARM64 linux-arm64
replace packaging/homebrew/gizzi-code.rb LINUX_X64 linux-x64
replace packaging/scoop/gizzi-code.json WINDOWS_X64 windows-x64
replace packaging/chocolatey/tools/chocolateyinstall.ps1 WINDOWS_X64 windows-x64
replace packaging/arch/PKGBUILD LINUX_X64 linux-x64
replace packaging/arch/PKGBUILD LINUX_ARM64 linux-arm64
replace cli-package/install/winget/Allternit.GizziCode.yaml WINDOWS_X64 windows-x64
replace cli-package/install/gizzi.rb DARWIN_ARM64 darwin-arm64
replace cli-package/install/gizzi.rb DARWIN_X64 darwin-x64
replace cli-package/install/gizzi.rb LINUX_ARM64 linux-arm64
replace cli-package/install/gizzi.rb LINUX_X64 linux-x64

if $ok; then
  echo ""
  echo "All hashes updated for ${TAG}."
else
  echo ""
  echo "Some assets were missing; remaining placeholders kept." >&2
  exit 1
fi
