#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# Allternit Desktop — Full Build Pipeline
#
# Usage:
#   ./scripts/build-desktop.sh [--skip-platform] [--skip-api] [--skip-electron]
# ─────────────────────────────────────────────────────────────────────────────

set -e

# Detect directories
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WORKSPACE_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
PLATFORM_DIR="$WORKSPACE_ROOT/surfaces/allternit-platform"
API_DIR="$WORKSPACE_ROOT/cmd/allternit-api"
GIZZI_DIR="$WORKSPACE_ROOT/cmd/gizzi-code"
DESKTOP_DIR="$WORKSPACE_ROOT/surfaces/allternit-desktop"
RESOURCES_DIR="$DESKTOP_DIR/resources"

# UI Helpers
ok() { echo -e "\033[32m✓\033[0m $1"; }
warn() { echo -e "\033[33m⚠\033[0m $1"; }
die() { echo -e "\033[31m✗\033[0m $1" >&2; exit 1; }
step() { echo ""; echo -e "\033[1;34m▶\033[0m $1"; }

# Parse flags
SKIP_PLATFORM=false
SKIP_API=false
SKIP_ELECTRON=false
for arg in "$@"; do
  case $arg in
    --skip-platform) SKIP_PLATFORM=true ;;
    --skip-api) SKIP_API=true ;;
    --skip-electron) SKIP_ELECTRON=true ;;
  esac
done

cd "$WORKSPACE_ROOT"

# ── 1. Build Platform (standalone) ───────────────────────────────────────────
if [ "$SKIP_PLATFORM" = false ]; then
  step "Building Next.js platform (standalone mode)…"
  cd "$PLATFORM_DIR"
  npm run build:desktop-server
  
  PLATFORM_OUT="$DESKTOP_DIR/resources/platform-server"
  [ -d "$PLATFORM_OUT" ] || die "Platform build failed — output directory not found at $PLATFORM_OUT"
  ok "Platform server → $PLATFORM_OUT"
fi

# ── 2. Build Gizzi Code Binary ───────────────────────────────────────────────
step "Building gizzi-code binary…"
cd "$GIZZI_DIR"
# Detect target triple for this machine
ARCH=$(uname -m | sed 's/arm64/arm64/;s/x86_64/x64/')
OS=$(uname | tr '[:upper:]' '[:lower:]' | sed 's/darwin/darwin/')
GIZZI_TARGET="${OS}-${ARCH}"   # e.g. darwin-arm64

bun install && bun run script/build-production.js --target="$GIZZI_TARGET"

GIZZI_BIN="$GIZZI_DIR/dist/gizzi-code"
# The build script might suffix it with the target, check both
if [ ! -f "$GIZZI_BIN" ]; then
    GIZZI_BIN="$GIZZI_DIR/dist/gizzi-code-$GIZZI_TARGET"
fi

[ -f "$GIZZI_BIN" ] || die "gizzi-code build failed — binary not found at $GIZZI_BIN"

mkdir -p "$RESOURCES_DIR/bin"
cp "$GIZZI_BIN" "$RESOURCES_DIR/bin/gizzi-code"
chmod +x "$RESOURCES_DIR/bin/gizzi-code"
ok "gizzi-code → $RESOURCES_DIR/bin/gizzi-code"

# ── 3. Build Rust API ────────────────────────────────────────────────────────
if [ "$SKIP_API" = false ]; then
  step "Building allternit-api (Rust)…"
  cd "$API_DIR"
  cargo build --release
  
  # Map binary name (Cargo uses underscores, we prefer dashes for distribution)
  # In workspace builds, binary is in the root target dir
  API_BIN="$WORKSPACE_ROOT/../target/release/allternit-api"
  [ -f "$API_BIN" ] || API_BIN="$WORKSPACE_ROOT/../target/release/allternit_api"
  [ -f "$API_BIN" ] || API_BIN="$API_DIR/target/release/allternit-api"
  [ -f "$API_BIN" ] || API_BIN="$API_DIR/target/release/allternit_api"
  [ -f "$API_BIN" ] || die "API build failed — binary not found at $API_BIN"

  mkdir -p "$RESOURCES_DIR/bin"
  cp "$API_BIN" "$RESOURCES_DIR/bin/allternit-api"
  chmod +x "$RESOURCES_DIR/bin/allternit-api"
  ok "allternit-api → $RESOURCES_DIR/bin/allternit-api"
fi

# ── 4. Download Lume Virtualization (macOS) ──────────────────────────────────
if [[ "$OSTYPE" == "darwin"* ]]; then
  step "Downloading Lume virtualization binary…"
  LUME_VERSION="v0.3.9"
  # Strip the 'v' for the filename
  LUME_VER_SHORT=${LUME_VERSION#v}
  
  # Map uname architecture to Lume's naming
  LUME_ARCH=$(uname -m)
  if [ "$LUME_ARCH" = "x86_64" ]; then
    LUME_ARCH="x64"
  fi
  
  LUME_URL="https://github.com/trycua/cua/releases/download/lume-${LUME_VERSION}/lume-${LUME_VER_SHORT}-darwin-${LUME_ARCH}.tar.gz"
  LUME_TMP="/tmp/lume-${LUME_VERSION}.tar.gz"
  
  if [ ! -f "$RESOURCES_DIR/bin/lume" ]; then
    echo "Fetching $LUME_URL…"
    curl -L "$LUME_URL" -o "$LUME_TMP"
    tar -xzf "$LUME_TMP" -C "$RESOURCES_DIR/bin"
    chmod +x "$RESOURCES_DIR/bin/lume"
    rm "$LUME_TMP"
    ok "Lume → $RESOURCES_DIR/bin/lume"
  else
    ok "Lume already present at $RESOURCES_DIR/bin/lume"
  fi
fi

# ── 5. Build Electron App ───────────────────────────────────────────────────
if [ "$SKIP_ELECTRON" = false ]; then
  step "Building Electron app bundle…"
  cd "$DESKTOP_DIR"
  
  # Ensure dependencies are current
  pnpm install

  # Build the renderer and main process
  pnpm run build

  # Package with electron-builder
  pnpm run dist

  ok "Electron app built → $DESKTOP_DIR/release/"
fi

# ── 5. Patch SHA256 checksums into manifest.ts ───────────────────────────────
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
  # Detect platform key for manifest (arch-os)
  ARCH=$(uname -m | sed 's/arm64/aarch64/;s/x86_64/x86_64/')
  OS=$(uname | tr '[:upper:]' '[:lower:]' | sed 's/darwin/macos/')
  PLATFORM_KEY="${ARCH}-${OS}"
  patch_checksum "$PLATFORM_KEY" "$BINARY_PATH"
  rm -f "${MANIFEST_FILE}.bak"
else
  warn "Binary not found at $BINARY_PATH — checksums not patched."
fi

echo ""
ok "Build complete! App: $DESKTOP_DIR/release/"
