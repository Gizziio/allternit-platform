# Build Guide - Gizzi Thin Client

Comprehensive guide for building the Gizzi Thin Client for development and production.

## Table of Contents

- [Prerequisites](#prerequisites)
- [Development Setup](#development-setup)
- [Build Process](#build-process)
- [Platform-Specific Builds](#platform-specific-builds)
- [Code Signing](#code-signing)
- [Automated Builds](#automated-builds)

## Prerequisites

### Required Software

| Software | Version | Purpose |
|----------|---------|---------|
| Node.js | 18.x LTS | Runtime environment |
| npm | 9.x+ | Package manager |
| Python | 3.9+ | Native module compilation |
| Git | 2.x+ | Version control |

### macOS Specific

```bash
# Install Xcode Command Line Tools
xcode-select --install

# Install Rosetta 2 (for Apple Silicon)
softwareupdate --install-rosetta --agree-to-license
```

### Windows Specific

```powershell
# Install Windows Build Tools
npm install --global windows-build-tools

# Or use Visual Studio Build Tools
# https://visualstudio.microsoft.com/downloads/#build-tools-for-visual-studio-2022
```

### Linux Specific

```bash
# Ubuntu/Debian
sudo apt-get update
sudo apt-get install -y build-essential libgtk-3-dev libnotify-dev libnss3 libxss1

# Fedora
sudo dnf install -y gcc-c++ make gtk3-devel libnotify-devel nss libXScrnSaver
```

## Development Setup

### 1. Clone and Install

```bash
# Clone the repository
git clone https://github.com/a2r/thin-client.git
cd thin-client

# Install dependencies
npm install

# Verify installation
npm run typecheck
```

### 2. Environment Setup

Create a `.env` file in the project root:

```env
# Development API endpoints
RENDERER_VITE_API_URL=http://localhost:4096
RENDERER_VITE_COMPUTER_USE_URL=http://localhost:8080

# Feature flags
RENDERER_VITE_ENABLE_AGENT_MODE=true
RENDERER_VITE_ENABLE_COMPUTER_USE=true
```

### 3. Start Development

```bash
# Start all development processes
npm run dev

# This runs three processes:
# 1. Vite dev server (port 5178)
# 2. TypeScript watch for main process
# 3. Electron app with hot reload
```

### 4. Development Workflow

```bash
# Terminal 1 - Main process watch
npm run dev:main

# Terminal 2 - Renderer dev server
npm run dev:renderer

# Terminal 3 - Electron
npm run dev:electron
```

## Build Process

### Build Architecture

The build process compiles three separate entry points:

1. **Main Process** (`src/main/`) - Electron main process
2. **Preload Script** (`src/preload/`) - IPC bridge
3. **Renderer** (`src/renderer/`) - React UI

### Build Commands

```bash
# Full build (all processes)
npm run build

# Individual builds
npm run build:main      # Main process only
npm run build:preload   # Preload script only
npm run build:renderer  # Renderer only

# Clean build artifacts
npm run clean
```

### Build Output Structure

```
dist/
├── main/
│   ├── index.js         # Compiled main process
│   ├── index.js.map     # Source map
│   └── ...
├── preload/
│   ├── index.js         # Compiled preload
│   └── ...
└── renderer/
    ├── index.html       # HTML entry
    ├── assets/          # Bundled assets
    └── ...
```

## Platform-Specific Builds

### macOS

#### Unsigned Build (Development)

```bash
# Build for macOS (universal binary)
npm run build:prod -- --mac

# Build for Intel only
npm run build:prod -- --mac --x64

# Build for Apple Silicon only
npm run build:prod -- --mac --arm64
```

#### Signed Build (Distribution)

```bash
# Set environment variables
export APPLE_ID="your-apple-id@example.com"
export APPLE_APP_SPECIFIC_PASSWORD="your-app-specific-password"
export APPLE_TEAM_ID="YOUR_TEAM_ID"

# Build signed
npm run build:prod -- --mac
```

Output:
- `release/Gizzi Thin Client-0.1.0.dmg` - Disk image for distribution
- `release/Gizzi Thin Client-0.1.0-mac.zip` - ZIP for auto-updater

### Windows

#### Unsigned Build (Development)

```bash
# Build for Windows
npm run build:prod -- --win

# Build portable version only
npm run build:prod -- --win portable

# Build NSIS installer only
npm run build:prod -- --win nsis
```

#### Signed Build (Distribution)

```bash
# Set environment variables
set WIN_CSC_LINK=path/to/certificate.p12
set WIN_CSC_KEY_PASSWORD=certificate-password

# Build signed
npm run build:prod -- --win
```

Output:
- `release/Gizzi Thin Client Setup 0.1.0.exe` - NSIS installer
- `release/Gizzi Thin Client 0.1.0.exe` - Portable executable

### Linux

```bash
# Build for Linux (all targets)
npm run build:prod -- --linux

# Build specific formats
npm run build:prod -- --linux AppImage
npm run build:prod -- --linux deb
npm run build:prod -- --linux rpm
npm run build:prod -- --linux snap
```

Output:
- `release/gizzi-thin-client-0.1.0-x86_64.AppImage` - AppImage
- `release/gizzi-thin-client_0.1.0_amd64.deb` - Debian package

## Code Signing

### macOS Code Signing

#### Requirements
- Apple Developer account ($99/year)
- macOS 10.15+
- Xcode Command Line Tools

#### Setup

1. **Create certificates in Apple Developer Portal**
   - Developer ID Application
   - Developer ID Installer

2. **Install certificates**
   ```bash
   # Double-click .cer files to install in Keychain
   # Set trust level to "Always Trust" for codesigning
   ```

3. **Configure entitlements** (`build/entitlements.mac.plist`):
   ```xml
   <?xml version="1.0" encoding="UTF-8"?>
   <!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
   <plist version="1.0">
     <dict>
       <key>com.apple.security.cs.allow-jit</key>
       <true/>
       <key>com.apple.security.cs.allow-unsigned-executable-memory</key>
       <true/>
       <key>com.apple.security.cs.allow-dyld-environment-variables</key>
       <true/>
       <key>com.apple.security.automation.apple-events</key>
       <true/>
     </dict>
   </plist>
   ```

4. **Notarization** (automated by electron-builder):
   ```bash
   export APPLE_ID="developer@example.com"
   export APPLE_APP_SPECIFIC_PASSWORD="xxxx-xxxx-xxxx-xxxx"
   export APPLE_TEAM_ID="XXXXXXXXXX"
   
   npm run build:prod -- --mac
   ```

### Windows Code Signing

#### Options
1. **EV Code Signing Certificate** - Best for SmartScreen
2. **Standard Code Signing Certificate** - Basic signing
3. **Azure Code Signing** - Cloud-based signing

#### Setup with Standard Certificate

1. **Export certificate as P12**:
   - Include private key
   - Set export password

2. **Build with signing**:
   ```bash
   set WIN_CSC_LINK=C:\path\to\certificate.p12
   set WIN_CSC_KEY_PASSWORD=your-password
   
   npm run build:prod -- --win
   ```

## Automated Builds

### GitHub Actions Workflow

Create `.github/workflows/build.yml`:

```yaml
name: Build and Release

on:
  push:
    tags:
      - 'v*'

jobs:
  build:
    strategy:
      matrix:
        os: [macos-latest, windows-latest, ubuntu-latest]
    runs-on: ${{ matrix.os }}
    
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: 18
          
      - name: Install dependencies
        run: npm ci
        
      - name: Build
        run: npm run build:prod
        env:
          APPLE_ID: ${{ secrets.APPLE_ID }}
          APPLE_APP_SPECIFIC_PASSWORD: ${{ secrets.APPLE_APP_SPECIFIC_PASSWORD }}
          APPLE_TEAM_ID: ${{ secrets.APPLE_TEAM_ID }}
          WIN_CSC_LINK: ${{ secrets.WIN_CSC_LINK }}
          WIN_CSC_KEY_PASSWORD: ${{ secrets.WIN_CSC_KEY_PASSWORD }}
          
      - name: Upload artifacts
        uses: actions/upload-artifact@v4
        with:
          name: build-${{ matrix.os }}
          path: release/
```

### Local Build Script

Create `scripts/build.sh`:

```bash
#!/bin/bash
set -e

echo "🔨 Building Gizzi Thin Client..."

# Clean previous builds
npm run clean

# Install dependencies
npm ci

# Build all platforms
npm run build

# Package for current platform
echo "📦 Packaging..."
npm run build:prod

echo "✅ Build complete!"
echo "📁 Artifacts in: ./release/"
```

## Troubleshooting Builds

### Common Issues

#### "Electron failed to install"
```bash
# Clear npm cache and reinstall
npm cache clean --force
rm -rf node_modules
npm install
```

#### "Code signing failed"
```bash
# macOS - Check certificate
security find-identity -v -p codesigning

# Windows - Verify certificate
signtool verify /pa "path/to/app.exe"
```

#### "Build timeout"
```bash
# Increase electron-builder timeout
export ELECTRON_BUILDER_TIMEOUT=600000
npm run build:prod
```

### Build Verification

```bash
# Verify macOS signing
codesign --verify --deep --strict --verbose=2 "Gizzi Thin Client.app"

# Verify Windows signing
Get-AuthenticodeSignature "Gizzi Thin Client.exe"

# Verify Linux package
dpkg-deb --info gizzi-thin-client_*.deb
```

## Build Checklist

Before releasing:

- [ ] All tests pass (`npm test`)
- [ ] Type checking passes (`npm run typecheck`)
- [ ] Linting passes (`npm run lint`)
- [ ] Version bumped in `package.json`
- [ ] Changelog updated
- [ ] Code signing certificates valid
- [ ] Test on clean VM
- [ ] Auto-updater tested
- [ ] Documentation updated

## Resources

- [Electron Build Guide](https://www.electron.build/)
- [Apple Code Signing](https://developer.apple.com/support/code-signing/)
- [Windows Code Signing](https://docs.microsoft.com/en-us/windows-hardware/drivers/dashboard/code-signing-cert-manage)
- [Electron Security](https://www.electronjs.org/docs/latest/tutorial/security)
