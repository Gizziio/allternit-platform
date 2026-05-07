#!/bin/bash
# Allternit Fork Brand Stripper
# Usage: ./strip-brand.sh <target-repo-path> <source-name> <replacement-name>
#
# Examples:
#   ./strip-brand.sh ../lobe-chat "Lobe Chat" "Allternit Canvas"
#   ./strip-brand.sh ../docmost "Docmost" "Allternit Wiki"
#   ./strip-brand.sh ../open-webui "Open WebUI" "Allternit AI"
#   ./strip-brand.sh ../affine "AFFiNE" "Allternit Board"

set -e

TARGET="$1"
SOURCE_NAME="${2:-Lobe Chat}"
REPL_NAME="${3:-Allternit Canvas}"
SOURCE_SLUG="${4:-lobe-chat}"
REPL_SLUG="${5:-allternit-canvas}"

if [ ! -d "$TARGET" ]; then
  echo "❌ Target directory does not exist: $TARGET"
  exit 1
fi

echo "🔪 Stripping brand from $TARGET..."
echo "   Replacing '$SOURCE_NAME' → '$REPL_NAME'"
echo "   Replacing '$SOURCE_SLUG' → '$REPL_SLUG'"

# 1. Strip logos and brand assets
find "$TARGET" -type f \( -iname "*logo*" -o -iname "*brand*" -o -iname "*favicon*" \) -not -path "*/node_modules/*" -exec rm -f {} \;

# 2. Strip README and marketing docs
rm -f "$TARGET/README.md" "$TARGET/README.zh-CN.md" "$TARGET/CONTRIBUTING.md" 2>/dev/null || true
rm -rf "$TARGET/.github" 2>/dev/null || true

# 3. Replace brand strings in source files (TS/TSX/JS/JSON/CSS)
find "$TARGET" -type f \( -name "*.ts" -o -name "*.tsx" -o -name "*.js" -o -name "*.jsx" -o -name "*.json" -o -name "*.css" -o -name "*.less" -o -name "*.scss" \) -not -path "*/node_modules/*" -not -path "*/.git/*" | while read -r file; do
  # macOS sed requires -i ''
  sed -i '' "s/$SOURCE_NAME/$REPL_NAME/g" "$file" 2>/dev/null || true
  sed -i '' "s/$SOURCE_SLUG/$REPL_SLUG/g" "$file" 2>/dev/null || true
  sed -i '' "s/LobeHub/Allternit/g" "$file" 2>/dev/null || true
  sed -i '' "s/@lobehui/@allternit/g" "$file" 2>/dev/null || true
  sed -i '' "s/lobehub.com/allternit.local/g" "$file" 2>/dev/null || true
  sed -i '' "s/lobe.chat/allternit.local/g" "$file" 2>/dev/null || true
done

# 4. Replace package.json metadata
if [ -f "$TARGET/package.json" ]; then
  sed -i '' 's/"name": "@lobehub\/chat"/"name": "@allternit\/canvas"/g' "$TARGET/package.json" 2>/dev/null || true
  sed -i '' 's/"name": "docmost"/"name": "allternit-wiki"/g' "$TARGET/package.json" 2>/dev/null || true
  sed -i '' 's/"name": "affine"/"name": "allternit-board"/g' "$TARGET/package.json" 2>/dev/null || true
  sed -i '' 's/"name": "open-webui"/"name": "allternit-ai"/g' "$TARGET/package.json" 2>/dev/null || true
fi

# 5. Add Allternit LICENSE header to key files
LICENSE_HEADER="// Allternit Fork — originally derived from $SOURCE_NAME\n// Reskinned and adapted for the Allternit platform.\n// See ORIGIN.md for upstream attribution.\n"

# 6. Write ORIGIN.md attribution file
cat > "$TARGET/ORIGIN.md" <<EOF
# Origin Attribution

This repository is a hard fork of **$SOURCE_NAME**.

- Original repository: $SOURCE_SLUG
- Fork date: $(date -u +"%Y-%m-%d")
- Fork purpose: Reskin and integration into the Allternit platform.

All original licenses and copyrights remain with the upstream authors.
Modifications are Copyright © Allternit.
EOF

echo "✅ Brand strip complete for $TARGET"
echo "   Next steps:"
echo "   1. Review remaining brand references: grep -ri 'lobe\\|docmost\\|affine\\|open.webui' $TARGET/src --include='*.tsx' --include='*.ts' | head -20"
echo "   2. Replace logo SVGs in $TARGET/public or $TARGET/src/assets"
echo "   3. Update theme tokens to match Allternit design system"
