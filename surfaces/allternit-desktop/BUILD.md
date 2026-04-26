# Desktop Build Guide

## Prerequisites

- Node.js 20+
- npm or pnpm
- For Mac: Xcode Command Line Tools (for native modules)
- For Windows: Windows Build Tools

## Build Steps

### Step 1: Build Platform Server (Next.js)

The desktop app needs the Next.js standalone server bundled.

```bash
cd ../allternit-platform

# Install dependencies
npm install

# Build for desktop (outputs to .next/standalone/)
ALLTERNIT_BUILD_MODE=desktop npm run build

# Verify output
ls -la .next/standalone/server.js
```

### Step 2: Setup Desktop Resources

Copy the platform-server to desktop resources:

```bash
cd ../allternit-desktop

# Create resources directory
mkdir -p resources/platform-server
mkdir -p resources/bin

# Copy platform server
cp -r ../allternit-platform/.next/standalone/* resources/platform-server/

# Copy static assets
cp -r ../allternit-platform/.next/static resources/platform-server/
cp -r ../allternit-platform/public resources/platform-server/ 2>/dev/null || true
```

### Step 3: Download cloudflared

Download Cloudflare Tunnel binary for each platform:

**macOS (ARM64):**
```bash
curl -L --output resources/bin/cloudflared https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-darwin-arm64
chmod +x resources/bin/cloudflared
```

**macOS (x64):**
```bash
curl -L --output resources/bin/cloudflared https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-darwin-amd64
chmod +x resources/bin/cloudflared
```

**Linux:**
```bash
curl -L --output resources/bin/cloudflared https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64
chmod +x resources/bin/cloudflared
```

**Windows:**
```bash
curl -L --output resources/bin/cloudflared.exe https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-amd64.exe
```

### Step 4: Build Desktop App

```bash
# Install desktop dependencies
npm install

# Build TypeScript
npm run build

# Build Electron app (macOS)
npm run build:electron:dmg

# Or build for all platforms
npm run dist
```

### Step 5: Verify Build

Check the output:

```bash
ls -la release/
# Should see:
# - Allternit-1.0.0.dmg (Mac)
# - Allternit-1.0.0.exe (Windows)
# - Allternit-1.0.0.AppImage (Linux)
```

## Automated Build Script

Use this script to build everything:

```bash
#!/bin/bash
set -e

echo "Building Allternit Desktop..."

# Step 1: Build platform
echo "→ Building platform server..."
cd ../allternit-platform
npm install
ALLTERNIT_BUILD_MODE=desktop npm run build

# Step 2: Setup resources
echo "→ Setting up resources..."
cd ../allternit-desktop
mkdir -p resources/platform-server
mkdir -p resources/bin
rm -rf resources/platform-server/*
cp -r ../allternit-platform/.next/standalone/* resources/platform-server/
cp -r ../allternit-platform/.next/static resources/platform-server/

# Step 3: Download cloudflared (detect platform)
echo "→ Downloading cloudflared..."
if [[ "$OSTYPE" == "darwin"* ]]; then
    # macOS - detect architecture
    ARCH=$(uname -m)
    if [[ "$ARCH" == "arm64" ]]; then
        curl -L -o resources/bin/cloudflared https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-darwin-arm64
    else
        curl -L -o resources/bin/cloudflared https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-darwin-amd64
    fi
    chmod +x resources/bin/cloudflared
elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
    curl -L -o resources/bin/cloudflared https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64
    chmod +x resources/bin/cloudflared
fi

# Step 4: Build desktop
echo "→ Building desktop app..."
npm install
npm run build
npm run build:electron:dmg

echo "✅ Build complete! Check release/ directory"
```

## Distribution

After building, upload to install.gizziio.com:

```bash
# Copy to web server
scp release/Allternit-1.0.0.dmg user@install.gizziio.com:/var/www/install/
scp release/Allternit-1.0.0.exe user@install.gizziio.com:/var/www/install/
scp release/Allternit-1.0.0.AppImage user@install.gizziio.com:/var/www/install/
```

Update download links in:
- `allternit-websites/projects/gizziio/source/index.html`
- `www.allternit.com` download page
