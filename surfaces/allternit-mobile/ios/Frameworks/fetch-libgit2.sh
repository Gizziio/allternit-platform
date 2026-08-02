#!/usr/bin/env bash
# Fetch the prebuilt libgit2.xcframework (D3 spike) and make it Swift-importable.
#
# Source: light-tech/LibGit2-On-iOS v1.3.1 release (public-domain build scripts;
# libgit2 v1.3.1 + OpenSSL + libssh2 + pcre, statically merged into one archive
# per slice). Slices: ios-arm64, ios-arm64_x86_64-simulator,
# ios-arm64_x86_64-maccatalyst.
#
# The release ships no Clang module map, so Swift cannot `import` it as-is.
# We inject the module map from the same project's Clibgit2.xcframework
# (v1.3.0 release) into each slice's Headers/ as `module Clibgit2`.
#
# Idempotent: removes any previous output first. Safe to re-run.
set -euo pipefail

cd "$(dirname "$0")"

LIBGIT2_URL="https://github.com/light-tech/LibGit2-On-iOS/releases/download/v1.3.1/libgit2.xcframework.zip"
CLIBGIT2_URL="https://github.com/light-tech/LibGit2-On-iOS/releases/download/v1.3.0/Clibgit2.xcframework.zip"

OUT="libgit2.xcframework"
rm -rf "$OUT"

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

curl -sL -o "$TMP/libgit2.zip" "$LIBGIT2_URL"
unzip -q -o "$TMP/libgit2.zip" -d "$TMP"
mv "$TMP/libgit2.xcframework" "$OUT"

curl -sL -o "$TMP/clibgit2.zip" "$CLIBGIT2_URL"
unzip -q -o "$TMP/clibgit2.zip" -d "$TMP/clibgit2"

for slice in "$OUT"/*/; do
  cp "$TMP/clibgit2/Clibgit2.xcframework/ios-arm64/Headers/module.modulemap" \
     "$slice/Headers/module.modulemap"
done

echo "Fetched + module-mapped: $(pwd)/$OUT"
