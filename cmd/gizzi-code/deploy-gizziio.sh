#!/bin/bash
# Deploy Gizzi Code install site to install.gizziio.com

set -e

echo "╔══════════════════════════════════════════════════════════════╗"
echo "║                                                              ║"
echo "║   🚀 Deploying to install.gizziio.com                        ║"
echo "║                                                              ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo ""

# Deploy to Cloudflare Pages
echo "📦 Deploying to Cloudflare Pages..."

if [ -z "$CLOUDFLARE_API_TOKEN" ]; then
    echo ""
    echo "⚠️  CLOUDFLARE_API_TOKEN not set"
    echo ""
    echo "Please either:"
    echo "  1. Set the token: export CLOUDFLARE_API_TOKEN=your_token"
    echo "  2. Or deploy via dashboard:"
    echo ""
    echo "     https://dash.cloudflare.com → Pages → Upload assets"
    echo "     Drag: install-site/public/"
    echo "     Project name: gizzi-install"
    echo ""
    exit 1
fi

wrangler pages deploy install-site/public \
    --project-name=gizzi-install \
    --branch=main \
    --commit-dirty=true

echo ""
echo "✅ Deployed to Cloudflare Pages!"
echo ""
echo "═══════════════════════════════════════════════════════════════"
echo "DNS SETUP REQUIRED"
echo "═══════════════════════════════════════════════════════════════"
echo ""
echo "In your Cloudflare DNS for gizziio.com:"
echo ""
echo "  Type:  CNAME"
echo "  Name:  install"
echo "  Target: gizzi-install.pages.dev"
echo "  Proxy: Enabled (orange cloud)"
echo ""
echo "═══════════════════════════════════════════════════════════════"
echo "TESTING"
echo "═══════════════════════════════════════════════════════════════"
echo ""
echo "After DNS propagates (few minutes):"
echo ""
echo "  curl -I https://install.gizziio.com/install"
echo "  curl -fsSL https://install.gizziio.com/install | cat"
echo "  curl https://install.gizziio.com/version"
echo ""
