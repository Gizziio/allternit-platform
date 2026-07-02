#!/usr/bin/env bash
set -euo pipefail

# Allternit Office Add-in — Production Deploy Script
# Usage: ./deploy.sh [s3-bucket|vercel|netlify|azure]

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

DEPLOY_TARGET="${1:-}"

echo "🚀 Allternit Office Add-in Deploy"
echo "=================================="

# ── Validate env ─────────────────────────────────────────────────────────────
if [ -z "${VITE_ALLTERNIT_GATEWAY_URL:-}" ]; then
  echo "❌ VITE_ALLTERNIT_GATEWAY_URL is not set"
  exit 1
fi

if [ -z "${VITE_ALLTERNIT_PLATFORM_URL:-}" ]; then
  echo "❌ VITE_ALLTERNIT_PLATFORM_URL is not set"
  exit 1
fi

if [ -z "${ALLTERNIT_OFFICE_APP_BASE_URL:-}" ]; then
  echo "❌ ALLTERNIT_OFFICE_APP_BASE_URL is not set"
  exit 1
fi

if [ -z "${ALLTERNIT_OFFICE_APP_GUID:-}" ]; then
  echo "⚠️  ALLTERNIT_OFFICE_APP_GUID not set — generating random GUID (bad for production)"
fi

# ── Build ────────────────────────────────────────────────────────────────────
echo ""
echo "📦 Building..."
npm run build

# ── Verify manifest ──────────────────────────────────────────────────────────
echo ""
echo "📋 Verifying manifest..."
MANIFEST_GUID=$(grep -oP '(?<=<Id>)[^<]+' manifest.xml || true)
echo "  GUID: $MANIFEST_GUID"

if echo "$MANIFEST_GUID" | grep -q "a1b2c3d4"; then
  echo "❌ Manifest contains placeholder GUID! Set ALLTERNIT_OFFICE_APP_GUID."
  exit 1
fi

MANIFEST_REQ=$(grep -oP '(?<=<Set Name=")[^"]+' manifest.xml | head -1)
echo "  Requirement Set: $MANIFEST_REQ"

if [ "$MANIFEST_REQ" = "ExcelApi" ]; then
  echo "❌ Manifest still requires ExcelApi — Word/PPT will be blocked."
  exit 1
fi

# ── Deploy ───────────────────────────────────────────────────────────────────
echo ""
echo "🌍 Deploy target: ${DEPLOY_TARGET:-(none specified)}"

case "$DEPLOY_TARGET" in
  s3)
    BUCKET="${S3_BUCKET:-}"
    if [ -z "$BUCKET" ]; then
      echo "❌ S3_BUCKET env var not set"
      exit 1
    fi
    aws s3 sync dist/ "s3://$BUCKET/" --delete
    echo "✅ Uploaded to s3://$BUCKET/"
    ;;

  azure)
    STORAGE_ACCOUNT="${AZURE_STORAGE_ACCOUNT:-}"
    if [ -z "$STORAGE_ACCOUNT" ]; then
      echo "❌ AZURE_STORAGE_ACCOUNT env var not set"
      exit 1
    fi
    az storage blob upload-batch \
      --account-name "$STORAGE_ACCOUNT" \
      --source dist/ \
      --destination \$web \
      --overwrite
    echo "✅ Uploaded to Azure Blob \$web"
    ;;

  vercel)
    if ! command -v vercel &> /dev/null; then
      echo "❌ Vercel CLI not installed. Run: npm i -g vercel"
      exit 1
    fi
    vercel --prod dist/
    echo "✅ Deployed to Vercel"
    ;;

  netlify)
    if ! command -v netlify &> /dev/null; then
      echo "❌ Netlify CLI not installed. Run: npm i -g netlify-cli"
      exit 1
    fi
    netlify deploy --prod --dir=dist/
    echo "✅ Deployed to Netlify"
    ;;

  *)
    echo ""
    echo "Build complete. dist/ folder is ready for deployment."
    echo ""
    echo "To deploy, run one of:"
    echo "  ./deploy.sh s3      (requires S3_BUCKET, aws cli)"
    echo "  ./deploy.sh azure   (requires AZURE_STORAGE_ACCOUNT, az cli)"
    echo "  ./deploy.sh vercel  (requires vercel cli)"
    echo "  ./deploy.sh netlify (requires netlify cli)"
    echo ""
    echo "Or manually upload dist/ to your CDN."
    ;;
esac

echo ""
echo "🎉 Done!"
