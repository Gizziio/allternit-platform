# 🚀 Next Steps: Convert 76 Templates & Publish to NPM

This document outlines the exact steps to convert all 76 Allternit templates into Universal Plugin SDK format and publish the package.

---

## Phase 1: Validate SDK (5 minutes)

### 1.1 Build and Test

```bash
cd /Users/macbook/allternit-plugin-sdk
npm ci
npm run build
npm test
```

### 1.2 Verify CLI Works

```bash
./bin/allternit-plugin.js --version
./bin/allternit-plugin.js create test-plugin
```

---

## Phase 2: Convert 76 Templates (15-30 minutes)

### 2.1 Set Up Conversion Environment

```bash
# Create output directory
mkdir -p /Users/macbook/allternit-plugins

# Find all template files
cd /Users/macbook/allternit
globstar templates/**/*.tsx > /tmp/templates.list
globstar templates/**/*.ts >> /tmp/templates.list
globstar templates/**/*.js >> /tmp/templates.list

# Count files
wc -l /tmp/templates.list
```

### 2.2 Batch Convert

Create this conversion script:

```bash
# File: /Users/macbook/allternit-plugin-sdk/scripts/convert-all.sh
#!/bin/bash

SDK_DIR="/Users/macbook/allternit-plugin-sdk"
OUTPUT_DIR="/Users/macbook/allternit-plugins"
TEMPLATE_DIR="/Users/macbook/allternit/templates"

cd "$SDK_DIR" || exit 1

# Convert function
convert_template() {
    local template=$1
    local name=$(basename "$template" | sed 's/\.[^.]*$//')
    local output="$OUTPUT_DIR/$name-plugin"
    
    echo "Converting: $name"
    ./bin/allternit-plugin.js convert \
        --input "$template" \
        --output "$output" \
        --format universal \
        --yes 2>/dev/null || echo "  Fallback: Manual conversion needed"
}

# Find and convert
find "$TEMPLATE_DIR" -name "*.tsx" -o -name "*.ts" -o -name "*.js" | while read -r file; do
    convert_template "$file"
done

echo "✅ Conversion complete!"
```

Run it:

```bash
chmod +x scripts/convert-all.sh
./scripts/convert-all.sh
```

### 2.3 Manual Fallback for Failed Conversions

For templates that don't auto-convert well:

```bash
# Manual conversion pattern
mkdir -p /Users/macbook/allternit-plugins/{name}-plugin/{src,docs}

# Copy and wrap
cat > /Users/macbook/allternit-plugins/{name}-plugin/src/index.ts << 'EOF'
import { PluginHost } from '@allternit/plugin-sdk';
import { manifest } from './manifest';

export async function run(host: PluginHost, params: any) {
  // Original template logic here
  // Use host.llm.complete() instead of direct API calls
  // Use host.ui.renderMarkdown() for output
}

export { manifest };
EOF
```

### 2.4 Validate All Plugins

```bash
# Validation script
for dir in /Users/macbook/allternit-plugins/*/; do
    echo "Validating: $(basename "$dir")"
    cd "$dir" || continue
    npm run validate 2>/dev/null || echo "  ⚠️  Needs fixing"
done
```

---

## Phase 3: NPM Organization Setup (10 minutes)

### 3.1 Create NPM Organization

1. Go to https://www.npmjs.com/
2. Login or create account
3. Click "Organizations" → "Create Organization"
4. Name: `allternit`
5. Plan: Free (or paid for private packages)

### 3.2 Get Auth Token

```bash
# Login to npm
npm login

# Create token for CI
npm token create --read-only=false
# Save this token for GitHub Actions
```

### 3.3 Add to GitHub Secrets

1. Go to https://github.com/allternit/plugin-sdk/settings/secrets/actions
2. Click "New repository secret"
3. Name: `NPM_TOKEN`
4. Value: [Paste token from 3.2]
5. Click "Add secret"

---

## Phase 4: Publish v1.0.0 (5 minutes)

### 4.1 Prepare Release

```bash
cd /Users/macbook/allternit-plugin-sdk

# Update version if needed
npm version 1.0.0

# Final build
npm run build

# Verify package contents
npm pack --dry-run
```

### 4.2 Push to GitHub

```bash
git add .
git commit -m "Prepare v1.0.0 release - Universal Plugin SDK"
git tag v1.0.0
git push origin main
git push origin v1.0.0
```

### 4.3 Verify Auto-Publish

The GitHub Action will trigger automatically on the tag:

1. Check Actions tab: https://github.com/allternit/plugin-sdk/actions
2. Wait for "Publish to NPM" workflow to complete
3. Verify at https://www.npmjs.com/package/@allternit/plugin-sdk

### 4.4 Manual Fallback (if needed)

```bash
# If auto-publish fails
npm login
npm publish --access public
```

---

## Phase 5: Documentation Site Deployment (10 minutes)

### 5.1 Build Site

```bash
cd /Users/macbook/allternit-plugin-sdk/website

# Install dependencies
npm install

# Build static site
npm run build

# Output goes to build/ or dist/
```

### 5.2 Deploy Options

**Option A: GitHub Pages**

```bash
# Add to package.json
{
  "scripts": {
    "deploy": "gh-pages -d build"
  }
}

# Deploy
npm run deploy
```

**Option B: Netlify**

1. Go to https://app.netlify.com/
2. "Add new site" → "Import from Git"
3. Select `allternit/plugin-sdk` repo
4. Build command: `cd website && npm run build`
5. Publish directory: `website/build`
6. Deploy

**Option C: Vercel**

```bash
npm i -g vercel
vercel --prod
```

### 5.3 Custom Domain (Optional)

1. Buy domain: `plugins.allternit.com` or `sdk.allternit.com`
2. Add DNS record:
   - Type: CNAME
   - Name: plugins
   - Value: [netlify/vercel/github pages URL]
3. Configure in hosting platform

---

## Phase 6: Announcement (Optional)

### 6.1 Create Release Notes

```bash
cat > RELEASE_NOTES.md << 'EOF'
# @allternit/plugin-sdk v1.0.0

## 🎉 Universal Plugin SDK Released!

Run Allternit plugins on ANY LLM platform:
- Claude Desktop (MCP)
- VS Code (Copilot/Cody)
- OpenAI Codex
- Cursor
- LangChain
- HTTP API

## Features

- ✅ 6 Platform Adapters
- ✅ 76 Templates → Universal Plugins
- ✅ Graceful Degradation
- ✅ Single SDK, Every Platform

## Quick Start

```bash
npm install -g @allternit/plugin-sdk
allternit-plugin create my-plugin
```

## Documentation

https://plugins.allternit.com (or your domain)

## 76 Plugins Available

All templates converted to Universal Plugin format.
EOF
```

### 6.2 Create GitHub Release

1. Go to https://github.com/allternit/plugin-sdk/releases
2. Click "Draft new release"
3. Choose tag: v1.0.0
4. Title: "Universal Plugin SDK v1.0.0"
5. Paste release notes
6. Click "Publish release"

---

## Quick Reference Commands

```bash
# Build SDK
cd /Users/macbook/allternit-plugin-sdk && npm run build

# Convert templates
./scripts/convert-all.sh

# Validate plugins
npm run validate

# Publish manually (fallback)
npm publish --access public

# Test CLI
./bin/allternit-plugin.js --help
```

---

## Checklist

- [ ] SDK builds successfully
- [ ] All 76 templates converted
- [ ] Plugins validated
- [ ] NPM org `@allternit` created
- [ ] NPM_TOKEN added to GitHub secrets
- [ ] Version tagged and pushed
- [ ] Package published to NPM
- [ ] Docs site deployed
- [ ] GitHub release created

---

## Success Metrics

After completion:
- ✅ Package available: `npm install @allternit/plugin-sdk`
- ✅ 76 plugins in `/Users/macbook/allternit-plugins/`
- ✅ Docs live at your chosen domain
- ✅ GitHub Actions auto-publish working

---

## Support

Issues? Check:
1. [GitHub Issues](https://github.com/allternit/plugin-sdk/issues)
2. [Documentation](https://plugins.allternit.com)
3. Run `allternit-plugin doctor` for diagnostics
