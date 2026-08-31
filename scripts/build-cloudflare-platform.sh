#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# platform.allternit.com — Cloudflare Pages Build
#
# Usage:
#   ./scripts/build-cloudflare-platform.sh [--no-zip]
#
# Outputs:
#   surfaces/platform.allternit.com/dist/  (Vite production build)
#   allternit-websites/projects/platform.allternit.com/deploy.zip
# ─────────────────────────────────────────────────────────────────────────────

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CONSOLE_DIR="$REPO_ROOT/surfaces/platform.allternit.com"
WEBSITES_DIR="$HOME/Desktop/allternit-websites/projects/platform.allternit.com"

CREATE_ZIP=true
for arg in "$@"; do
  [[ "$arg" == "--no-zip" ]] && CREATE_ZIP=false
done

GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

step() { echo -e "\n${BLUE}▶ $*${NC}"; }
ok()   { echo -e "${GREEN}✓ $*${NC}"; }
warn() { echo -e "${YELLOW}⚠ $*${NC}"; }
die()  { echo -e "${RED}✗ $*${NC}"; exit 1; }

cd "$CONSOLE_DIR"

if [ ! -d node_modules ]; then
  warn "node_modules missing — running pnpm install"
  pnpm install --frozen-lockfile
fi

# ---------------------------------------------------------------------------
# Check for Clerk publishable key
# ---------------------------------------------------------------------------
if [ -z "${VITE_CLERK_PUBLISHABLE_KEY:-}" ]; then
  # Try reading from .env.local, then .env.production
  LOCAL_KEY=$(grep -E "^VITE_CLERK_PUBLISHABLE_KEY=pk_" "$CONSOLE_DIR/.env.local" 2>/dev/null | cut -d= -f2 | head -1 || true)
  PROD_KEY=$(grep -E "^VITE_CLERK_PUBLISHABLE_KEY=pk_" "$CONSOLE_DIR/.env.production" 2>/dev/null | cut -d= -f2 | head -1 || true)
  FOUND_KEY="${LOCAL_KEY:-${PROD_KEY:-}}"
  if [ -z "$FOUND_KEY" ]; then
    die "VITE_CLERK_PUBLISHABLE_KEY is not set.\n  Set it in .env.local or export it before running this script:\n  VITE_CLERK_PUBLISHABLE_KEY=pk_live_xxx ./scripts/build-cloudflare-platform.sh"
  fi
  export VITE_CLERK_PUBLISHABLE_KEY="$FOUND_KEY"
  ok "Clerk key loaded from local env"
fi

step "Building platform.allternit.com for Cloudflare Pages…"
export VITE_ALLTERNIT_GATEWAY_URL="${VITE_ALLTERNIT_GATEWAY_URL:-https://api.allternit.com}"
export VITE_ALLTERNIT_CLOUD_API_URL="${VITE_ALLTERNIT_CLOUD_API_URL:-https://allternit-cloud-api.fly.dev}"

NODE_OPTIONS="--max-old-space-size=6144" \
  CLOUDFLARE_PAGES=1 \
  pnpm build

DIST_DIR="$CONSOLE_DIR/dist"
[ -d "$DIST_DIR" ] || die "Build failed — dist/ not found"

ok "Build output → $DIST_DIR"

if [ "$CREATE_ZIP" = true ]; then
  step "Creating deploy.zip…"
  mkdir -p "$WEBSITES_DIR"

  cd "$DIST_DIR"
  zip -r "$WEBSITES_DIR/deploy.zip" . -x "*.DS_Store"

  SIZE=$(du -sh "$WEBSITES_DIR/deploy.zip" | cut -f1)
  ok "deploy.zip ($SIZE) → $WEBSITES_DIR/deploy.zip"
  echo ""
  echo "Upload to Cloudflare Pages:"
  echo "  Project name:  allternit-platform"
  echo "  Custom domain: platform.allternit.com"
  echo "  Zip file:      $WEBSITES_DIR/deploy.zip"
fi
