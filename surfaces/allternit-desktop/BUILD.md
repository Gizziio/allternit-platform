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

### Step 3b: Stage mesh-node sidecar

mesh-node is the tsnet userspace sidecar (`infrastructure/mesh/tsnet-ios/cmd/mesh-node`) that joins the Allternit tailnet without a system VPN — it's what lets the desktop app reach gizzi instances at `100.64.0.0/10` addresses. The packaged app resolves it from `resources/bin/mesh-node[.exe]` (see `src/main/mesh-manager.ts`).

Stage it for your current platform:

```bash
npm run prepare:mesh-node
```

# Step 3c: Stage allternit-api Rust binary

The desktop shell embeds the Rust API backend at `resources/bin/allternit-api[.exe]`.
If you have already built it (`cargo build --release -p allternit-api`), copy it in:

```bash
npm run prepare:api-binary
```

This is also called automatically by `npm run build:electron`, `npm run dist`,
etc. If no local binary exists, the script downloads the platform-locked archive
from the manifest in `src/main/manifest.ts`.

The script (`scripts/prepare-mesh-node.cjs`) acquires the binary in this order:

1. **Vendor copy** — copies from the repo vendor tree `cmd/gizzi-code/vendor/mesh-node/<platform>-<arch>/` (the same binary gizzi-code's `mesh.ts` uses) if present.
2. **Build from source** — runs `infrastructure/mesh/tsnet-ios/build-sidecar.sh` (darwin-arm64, linux-x64), or an equivalent `go build` for win32-x64, when Go is on PATH.
3. **Release download** — downloads the latest `gizzi-code/*` GitHub release asset (v0.2.2+ archives ship `mesh-node` next to `gizzi-code`) and extracts just the sidecar.

The script is idempotent (skips when `resources/bin/mesh-node` already exists) and is already wired into `build:electron`, `build:electron:dmg`, `pack`, and `dist`. The staged binary is gitignored like the rest of `resources/bin/`.

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

# Step 3b: Stage mesh-node sidecar (vendor copy → go build → release download)
echo "→ Staging mesh-node..."
npm run prepare:mesh-node

# Step 4: Build desktop
echo "→ Building desktop app..."
npm install
npm run build
npm run build:electron:dmg

echo "✅ Build complete! Check release/ directory"
```

## Code Signing & Notarization

The packaging config contains explicit placeholders for platform signing. Set the
following environment variables before running `npm run dist` to produce signed
release artifacts.

### macOS

| Variable | Purpose |
|----------|---------|
| `APPLE_ID` | Apple developer account email |
| `APPLE_ID_PASSWORD` | App-specific password (not your Apple ID password) |
| `APPLE_TEAM_ID` | 10-character Apple Developer Team ID |

`electron-builder` will pick the first valid Developer ID identity automatically
(`build.mac.identity: null`). The `scripts/notarize.cjs` afterSign hook runs only
when all three env vars are present, so local unsigned builds continue to work.

### Windows

| Variable | Purpose |
|----------|---------|
| `CSC_LINK` | URL or path to the PKCS#12 certificate file |
| `CSC_KEY_PASSWORD` | Password for the certificate |
| `WIN_CSC_LINK` | Windows-only override for `CSC_LINK` |
| `WIN_CSC_KEY_PASSWORD` | Windows-only override for `CSC_KEY_PASSWORD` |

Set `build.win.certificateFile` / `certificatePassword` to a real value when using
a checked-in certificate. Leaving them as `null` lets `electron-builder` fall back
to the standard `CSC_*` environment variables.

### Linux

AppImage and `.deb` packages are not code-signed. Ensure the package metadata in
`build.linux`, `build.appImage`, and `build.deb` is updated before publishing.

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
