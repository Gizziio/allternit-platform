#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# Allternit Platform — Cloudflare Pages Build
#
# Usage:
#   ./scripts/build-cloudflare-platform.sh [--no-zip]
#
# Outputs:
#   surfaces/allternit-platform/dist/        (static export)
#   allternit-websites/projects/platform-allternit/deploy.zip
#
# Notes:
#   API routes are server-side only — they're excluded from the CF Pages build
#   because: (a) static export can't serve them, (b) in tunnel mode all API
#   calls route through the local desktop anyway.
# ─────────────────────────────────────────────────────────────────────────────

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PLATFORM_DIR="$REPO_ROOT/surfaces/allternit-platform"
WEBSITES_DIR="$HOME/Desktop/allternit-websites/projects/platform-allternit"

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

cd "$PLATFORM_DIR"

if [ ! -d node_modules ]; then
  warn "node_modules missing — running pnpm install"
  pnpm install --frozen-lockfile
fi

# ---------------------------------------------------------------------------
# Stash API routes — they require a running server and cannot be statically
# exported. In tunnel mode the browser calls the local desktop directly.
# ---------------------------------------------------------------------------
API_DIR="$PLATFORM_DIR/src/app/api"
API_STASH="$PLATFORM_DIR/src/app/_api_cf_stash"

restore_api() {
  if [ -d "$API_STASH" ]; then
    mv "$API_STASH" "$API_DIR"
    ok "API routes restored"
  fi
}
trap restore_api EXIT INT TERM

# ---------------------------------------------------------------------------
# Check for Clerk publishable key
# ---------------------------------------------------------------------------
if [ -z "${NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY:-}" ]; then
  # Try reading from .env.production
  PROD_KEY=$(grep -E "^NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_" "$PLATFORM_DIR/.env.production" 2>/dev/null | cut -d= -f2 | head -1 || true)
  if [ -z "$PROD_KEY" ]; then
    die "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY is not set.\n  Set it in .env.production or export it before running this script:\n  NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_live_xxx ./scripts/build-cloudflare-platform.sh"
  fi
  export NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY="$PROD_KEY"
  ok "Clerk key loaded from .env.production"
fi

step "Stashing API routes for static export…"
if [ -d "$API_DIR" ]; then
  mv "$API_DIR" "$API_STASH"
  ok "API routes stashed (will be restored after build)"
else
  warn "No src/app/api directory found — skipping stash"
fi

step "Building platform for Cloudflare Pages (static export)…"
# Explicitly export both Clerk vars at shell level so .env.local can never
# shadow them. Setting a var to "" in a one-liner can be silently ignored by
# some shells/npm runners — export guarantees it wins over .env.local.
export NEXT_PUBLIC_ALLTERNIT_PLATFORM_DISABLE_CLERK=""
export NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY="${NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY:-pk_live_Y2xlcmsucGxhdGZvcm0uYWxsdGVybml0LmNvbSQ}"
export NEXT_PUBLIC_CLERK_SIGN_IN_URL="${NEXT_PUBLIC_CLERK_SIGN_IN_URL:-/sign-in}"
export NEXT_PUBLIC_CLERK_SIGN_UP_URL="${NEXT_PUBLIC_CLERK_SIGN_UP_URL:-/sign-up}"

NODE_OPTIONS="--max-old-space-size=6144" \
  CLOUDFLARE_PAGES=1 \
  pnpm build

DIST_DIR="$PLATFORM_DIR/dist"
[ -d "$DIST_DIR" ] || die "Build failed — dist/ not found"

ok "Static export → $DIST_DIR"

# Restore API routes immediately (trap also handles abnormal exit)
restore_api
trap - EXIT INT TERM

if [ "$CREATE_ZIP" = true ]; then
  step "Creating deploy.zip…"
  mkdir -p "$WEBSITES_DIR"

  cd "$DIST_DIR"
  zip -r "$WEBSITES_DIR/deploy.zip" . -x "*.DS_Store"

  SIZE=$(du -sh "$WEBSITES_DIR/deploy.zip" | cut -f1)
  ok "deploy.zip ($SIZE) → $WEBSITES_DIR/deploy.zip"
  echo ""
  echo "Upload to Cloudflare Pages:"
  echo "  Project name:  platform-allternit"
  echo "  Custom domain: platform.allternit.com"
  echo "  Zip file:      $WEBSITES_DIR/deploy.zip"
fi
