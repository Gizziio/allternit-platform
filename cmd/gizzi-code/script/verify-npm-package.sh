#!/usr/bin/env bash
# verify-npm-package.sh — prove a published @allternit/gizzi-code version is
# installable: tarball has dist/ + resolving bin entries, and optional
# platform packages exist at the same version.
#
# npm's metadata can appear minutes before the tarball blob is fetchable
# via anonymous curl (2.0.2 and 2.0.4 both failed that way). This script
# downloads with `npm pack` (the authenticated registry client) and
# exponential backoff, and falls back to curl with the HTTP status logged.
#
# Usage:
#   bash script/verify-npm-package.sh 2.0.4
#   bash script/verify-npm-package.sh @allternit/gizzi-code 2.0.4
set -euo pipefail

if [ $# -eq 1 ]; then
  PKG="@allternit/gizzi-code"
  VERSION="$1"
elif [ $# -eq 2 ]; then
  PKG="$1"
  VERSION="$2"
else
  echo "Usage: $0 [package] <version>" >&2
  exit 2
fi

TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT
TGZ=""

log() { echo "$*"; }

try_npm_pack() {
  local dest="$1"
  mkdir -p "$dest"
  # npm pack writes <name>-<ver>.tgz into dest. --silent still prints the filename.
  local out
  if out=$(npm pack "${PKG}@${VERSION}" --pack-destination "$dest" \
      --fetch-retries=5 --fetch-retry-mintimeout=20000 --fetch-retry-maxtimeout=120000 \
      2>"$TMP/npm-pack.err"); then
    local name
    name=$(printf '%s' "$out" | tail -1 | tr -d '\r')
    if [ -n "$name" ] && [ -s "$dest/$name" ]; then
      printf '%s' "$dest/$name"
      return 0
    fi
    local found
    found=$(ls -1 "$dest"/*.tgz 2>/dev/null | head -1 || true)
    if [ -n "$found" ] && [ -s "$found" ]; then
      printf '%s' "$found"
      return 0
    fi
  fi
  return 1
}

try_curl_tarball() {
  local dest="$1"
  local url
  url=$(npm view "${PKG}@${VERSION}" dist.tarball 2>/dev/null || true)
  if [ -z "$url" ]; then
    echo "npm view dist.tarball empty" >&2
    return 1
  fi
  local code
  code=$(curl -sS -L --retry 2 --retry-delay 2 -o "$dest" -w '%{http_code}' "$url" || true)
  echo "curl $url -> HTTP ${code}" >&2
  if [ "$code" = "200" ] && [ -s "$dest" ]; then
    printf '%s' "$dest"
    return 0
  fi
  rm -f "$dest"
  return 1
}

# Exponential backoff: 5s, 10s, 20s, 40s, then 60s cap. 15 attempts ~ 12 min.
for attempt in $(seq 1 15); do
  if TGZ=$(try_npm_pack "$TMP/reg"); then
    log "Downloaded via npm pack (attempt $attempt): $TGZ"
    break
  fi
  err=$(tr '\n' ' ' <"$TMP/npm-pack.err" 2>/dev/null | head -c 240 || true)
  log "npm pack failed (attempt $attempt): ${err:-unknown}"
  if TGZ=$(try_curl_tarball "$TMP/curl.tgz"); then
    log "Downloaded via curl fallback (attempt $attempt): $TGZ"
    break
  fi
  TGZ=""
  sleep_s=$((5 * (2 ** (attempt - 1))))
  if [ "$sleep_s" -gt 60 ]; then sleep_s=60; fi
  log "Registry tarball not ready (attempt $attempt); sleeping ${sleep_s}s"
  sleep "$sleep_s"
done

if [ -z "$TGZ" ] || [ ! -s "$TGZ" ]; then
  echo "::error::Could not download ${PKG}@${VERSION} from the registry after retries."
  exit 1
fi

FILES=$(tar -tzf "$TGZ")
if ! grep -q '/dist/' <<<"$FILES"; then
  echo "::error::Published $PKG@$VERSION tarball contains no dist/ — the package is broken (dangling bin symlinks). Yank it and fix the publish."
  exit 1
fi

BIN_PATHS=$(tar -xzf "$TGZ" -O package/package.json \
  | python3 -c 'import json,sys; b=json.load(sys.stdin).get("bin",{}); print("\n".join(b.values() if isinstance(b,dict) else [b]))')
if [ -z "$BIN_PATHS" ]; then
  echo "::error::Published $PKG@$VERSION has no bin entries in package.json — nothing to execute after install."
  exit 1
fi
while IFS= read -r p; do
  p="${p#./}"
  if ! grep -qF "package/$p" <<<"$FILES"; then
    echo "::error::Published $PKG@$VERSION bin entry '$p' is missing from the tarball — bin symlinks would dangle. Yank it and fix the publish."
    exit 1
  fi
done <<<"$BIN_PATHS"

OPTS=$(tar -xzf "$TGZ" -O package/package.json \
  | python3 -c 'import json,sys; d=json.load(sys.stdin).get("optionalDependencies",{}); print("\n".join(f"{k} {v}" for k,v in d.items()))')
if [ -z "$OPTS" ]; then
  echo "::error::Published $PKG@$VERSION has no optionalDependencies — cross-platform installs would have no binaries."
  exit 1
fi

while IFS= read -r name_ver; do
  name="${name_ver% *}"
  visible=false
  for attempt in $(seq 1 10); do
    if npm view "$name@$VERSION" version >/dev/null 2>&1; then
      visible=true
      break
    fi
    if [ "$name" = "@allternit/gizzi-code-win32-x64" ]; then
      # Windows is optional; don't burn the full retry budget on it.
      break
    fi
    log "Platform package $name@$VERSION not visible yet (attempt $attempt); sleeping 15s"
    sleep 15
  done
  if [ "$visible" != true ]; then
    if [ "$name" = "@allternit/gizzi-code-win32-x64" ]; then
      echo "::warning::Experimental platform package $name@$VERSION is missing from the registry (Windows build failed or was skipped)."
    else
      echo "::error::Platform package $name@$VERSION is missing from the registry."
      exit 1
    fi
  fi
done <<<"$OPTS"

echo "Verified: published $PKG@$VERSION contains dist/, all bin entries resolve, and all core platform packages exist."
