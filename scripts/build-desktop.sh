#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# Allternit Desktop — Full Build Pipeline
#
# Usage:
#   ./scripts/build-desktop.sh [--skip-platform] [--skip-api] [--skip-electron]
#
# What it does:
#   1. Build Next.js platform as standalone server  →  surfaces/allternit-platform/.next/standalone/
#   2. Copy standalone server to                    →  surfaces/allternit-desktop/resources/platform-server/
#   3. Build Rust allternit-api binary              →  target/release/allternit-api
#   4. Copy binary to                               →  surfaces/allternit-desktop/resources/bin/allternit-api
#   5. Build Electron (TypeScript + electron-builder) → surfaces/allternit-desktop/release/
#   6. Print SHA256 checksums for manifest.ts
# ─────────────────────────────────────────────────────────────────────────────

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PLATFORM_DIR="$REPO_ROOT/surfaces/allternit-platform"
DESKTOP_DIR="$REPO_ROOT/surfaces/allternit-desktop"
RESOURCES_DIR="$DESKTOP_DIR/resources"
TARGET_DIR="$REPO_ROOT/target/release"

SKIP_PLATFORM=false
SKIP_GIZZI=false
SKIP_API=false
SKIP_ELECTRON=false

for arg in "$@"; do
  case "$arg" in
    --skip-platform) SKIP_PLATFORM=true ;;
    --skip-gizzi)    SKIP_GIZZI=true ;;
    --skip-api)      SKIP_API=true ;;
    --skip-electron) SKIP_ELECTRON=true ;;
  esac
done

# ── Colours ──────────────────────────────────────────────────────────────────
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

step()  { echo -e "\n${BLUE}▶ $*${NC}"; }
ok()    { echo -e "${GREEN}✓ $*${NC}"; }
warn()  { echo -e "${YELLOW}⚠ $*${NC}"; }
die()   { echo -e "${RED}✗ $*${NC}"; exit 1; }

# ── 1. Next.js platform standalone build ─────────────────────────────────────
if [ "$SKIP_PLATFORM" = false ]; then
  step "Building Next.js platform (standalone mode)…"

  cd "$PLATFORM_DIR"

  # Ensure deps are installed
  if [ ! -d node_modules ]; then
    warn "node_modules missing — running pnpm install"
    pnpm install --frozen-lockfile
  fi

  # Build with desktop mode flag so next.config.ts sets output: 'standalone'
  ALLTERNIT_BUILD_MODE=desktop pnpm build

  STANDALONE_DIR="$PLATFORM_DIR/.next/standalone"
  [ -d "$STANDALONE_DIR" ] || die "Standalone build failed — .next/standalone not found"

  # Copy standalone server to desktop resources
  DEST="$RESOURCES_DIR/platform-server"
  rm -rf "$DEST"
  mkdir -p "$DEST"

  # Copy the standalone server and its bundled node_modules
  cp -r "$STANDALONE_DIR/." "$DEST/"

  # Copy static assets (CSS, JS, images) that standalone doesn't include itself
  if [ -d "$PLATFORM_DIR/.next/static" ]; then
    mkdir -p "$DEST/.next/static"
    cp -r "$PLATFORM_DIR/.next/static/." "$DEST/.next/static/"
  fi

  # Copy public/ assets
  if [ -d "$PLATFORM_DIR/public" ]; then
    mkdir -p "$DEST/public"
    cp -r "$PLATFORM_DIR/public/." "$DEST/public/"
  fi

  ok "Platform server → $DEST"
  cd "$REPO_ROOT"
fi

# ── 2. Gizzi-code binary (AI runtime — the brain) ────────────────────────────
if [ "$SKIP_GIZZI" = false ]; then
  step "Building gizzi-code binary…"

  GIZZI_DIR="$REPO_ROOT/cmd/gizzi-code"
  [ -d "$GIZZI_DIR" ] || die "gizzi-code not found at $GIZZI_DIR"

  cd "$GIZZI_DIR"

  # Install deps if needed
  if [ ! -d node_modules ]; then
    warn "gizzi-code node_modules missing — running bun install"
    bun install
  fi

  # Detect target triple for this machine
  ARCH=$(uname -m | sed 's/arm64/arm64/;s/x86_64/x64/')
  OS=$(uname | tr '[:upper:]' '[:lower:]' | sed 's/darwin/darwin/')
  GIZZI_TARGET="${OS}-${ARCH}"   # e.g. darwin-arm64

  bun run script/build-production.ts --target="$GIZZI_TARGET"

  GIZZI_BIN="$GIZZI_DIR/dist/gizzi-code"
  [ -f "$GIZZI_BIN" ] || die "gizzi-code build failed — binary not found at $GIZZI_BIN"

  mkdir -p "$RESOURCES_DIR/bin"
  cp "$GIZZI_BIN" "$RESOURCES_DIR/bin/gizzi-code"
  chmod +x "$RESOURCES_DIR/bin/gizzi-code"

  ok "gizzi-code → $RESOURCES_DIR/bin/gizzi-code"
  cd "$REPO_ROOT"
fi

# ── 3. Rust allternit-api binary (operator API — VM, rails, terminal) ─────────
if [ "$SKIP_API" = false ]; then
  step "Building Rust allternit-api binary…"

  cd "$REPO_ROOT"

  # Build the API binary (standalone workspace — has its own [workspace])
  cargo build --release --manifest-path api/core/allternit-api/Cargo.toml

  BINARY="$TARGET_DIR/allternit-api"
  [ -f "$BINARY" ] || die "Rust build failed — binary not found at $BINARY"

  # Copy to desktop resources
  mkdir -p "$RESOURCES_DIR/bin"
  cp "$BINARY" "$RESOURCES_DIR/bin/allternit-api"
  chmod +x "$RESOURCES_DIR/bin/allternit-api"

  ok "allternit-api → $RESOURCES_DIR/bin/allternit-api"

  # Also build the Swift VM manager CLI (macOS only)
  if [ "$(uname)" = "Darwin" ]; then
    step "Building Swift VM manager CLI…"
    swift build -c release --package-path "$DESKTOP_DIR/native/vm-manager"
    VM_CLI="$DESKTOP_DIR/native/vm-manager/.build/release/vm-manager-cli"
    [ -f "$VM_CLI" ] || die "Swift build failed — vm-manager-cli not found"
    cp "$VM_CLI" "$RESOURCES_DIR/bin/vm-manager-cli"
    ok "vm-manager-cli → $RESOURCES_DIR/bin/vm-manager-cli"
  fi
fi

# ── 3. Electron TypeScript + electron-builder ─────────────────────────────────
if [ "$SKIP_ELECTRON" = false ]; then
  step "Building Electron app…"

  cd "$DESKTOP_DIR"

  # Install deps if needed
  if [ ! -d node_modules ]; then
    warn "node_modules missing — running npm install"
    npm install
  fi

  # Compile TypeScript
  npm run build

  # Package with electron-builder
  npm run dist

  ok "Electron app built → $DESKTOP_DIR/release/"
fi

# ── 4. Patch SHA256 checksums into manifest.ts ───────────────────────────────
MANIFEST_FILE="$DESKTOP_DIR/src/main/manifest.ts"

patch_checksum() {
  local platform_key="$1"
  local binary_path="$2"

  [ -f "$binary_path" ] || { warn "Binary not found for $platform_key: $binary_path"; return; }

  if command -v sha256sum &>/dev/null; then
    local checksum
    checksum=$(sha256sum "$binary_path" | awk '{print $1}')
  else
    local checksum
    checksum=$(shasum -a 256 "$binary_path" | awk '{print $1}')
  fi

  # Replace the empty-string value for this key in the checksums block
  # Pattern: '<platform_key>':   '' → '<platform_key>':   '<sha256>'
  # Uses a delimiter that won't appear in keys or hashes (#)
  sed -i.bak "s#'${platform_key}':   *''#'${platform_key}':   '${checksum}'#g" "$MANIFEST_FILE"
  ok "Checksum patched → $platform_key: $checksum"
}

step "Patching SHA256 checksums into $MANIFEST_FILE…"

BINARY_PATH="$RESOURCES_DIR/bin/allternit-api"
if [ -f "$BINARY_PATH" ]; then
  ARCH=$(uname -m | sed 's/arm64/aarch64/')
  OS=$(uname | tr '[:upper:]' '[:lower:]' | sed 's/darwin/macos/')
  PLATFORM_KEY="${ARCH}-${OS}"
  patch_checksum "$PLATFORM_KEY" "$BINARY_PATH"
  rm -f "${MANIFEST_FILE}.bak"
else
  warn "Binary not found at $BINARY_PATH — checksums not patched."
fi

echo ""
ok "Build complete! App: $DESKTOP_DIR/release/"
