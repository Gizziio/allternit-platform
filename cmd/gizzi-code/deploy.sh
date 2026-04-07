#!/bin/bash
# Gizzi Code Install Site Deployment Script

set -e

echo "╔══════════════════════════════════════════════════════════════╗"
echo "║                                                              ║"
echo "║   GIZZI CODE - Deploy Install Site                           ║"
echo "║                                                              ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo ""

# Check if wrangler is installed
if ! command -v wrangler &> /dev/null; then
    echo "⚠ Wrangler not found. Installing..."
    npm install -g wrangler
fi

# Check authentication
if ! wrangler whoami &> /dev/null; then
    echo "🔐 Please login to Cloudflare:"
    wrangler login
fi

echo ""
echo "📦 Deploying to Cloudflare Pages..."
echo ""

# Deploy
wrangler pages deploy install-site/public \
    --project-name=gizzi-install \
    --branch=main \
    --commit-dirty=true

echo ""
echo "✅ Deployment complete!"
echo ""
echo "Next steps:"
echo "  1. Go to https://dash.cloudflare.com → Pages → gizzi-install"
echo "  2. Add custom domain: gizzi.sh"
echo "  3. Test: curl -fsSL https://gizzi.sh/install | cat"
echo ""
