# VM Setup Guide

## Overview

This guide covers building and releasing VM images for A2R.

**Repository:** `https://github.com/Gizziio/a2rchitech`  
**Releases:** Images are published as GitHub Releases on this repository

---

## Building VM Images

### Option 1: CI/CD Build (Recommended)

Trigger the GitHub Actions workflow to build images automatically:

```bash
# Using GitHub CLI
cd /Users/macbook/Desktop/a2rchitech-workspace/a2rchitech

# Trigger the workflow
gh workflow run vm-images.yml \
  --field version=1.1.0 \
  --field upload_release=true

# Or trigger via GitHub web UI:
# 1. Go to https://github.com/Gizziio/a2rchitech/actions
# 2. Select "Build VM Images"
# 3. Click "Run workflow"
# 4. Enter version (e.g., 1.1.0)
# 5. Check "Upload to GitHub Releases"
# 6. Run
```

The workflow will:
1. Build VM images for x86_64 and ARM64
2. Package them with compression (zstd)
3. Create a GitHub Release
4. Upload images as release assets

### Option 2: Local Build (Linux Only)

For development or custom images:

```bash
cd /Users/macbook/Desktop/a2rchitech-workspace/a2rchitech

# Build the executor binary
cargo build --release -p a2r-vm-executor

# Build VM images
cargo run --release -p a2r-vm-image-builder -- build --ubuntu-version 22.04

# Images will be in ~/.a2r/vm-images/
```

**Requirements:**
- Linux system (Ubuntu/Debian recommended)
- `debootstrap`, `qemu-utils`, `e2fsprogs`, `zstd` packages
- 10 GB free disk space
- sudo access

---

## Release Structure

After the CI/CD workflow completes, the GitHub Release will contain:

```
Release: v1.1.0
Assets:
├── vmlinux-6.5.0-a2r-x86_64              # Linux kernel (x86_64)
├── vmlinux-6.5.0-a2r-arm64               # Linux kernel (ARM64)
├── initrd.img-6.5.0-a2r-x86_64           # Initial ramdisk (x86_64)
├── initrd.img-6.5.0-a2r-arm64            # Initial ramdisk (ARM64)
├── ubuntu-22.04-a2r-v1.1.0.ext4.zst      # Rootfs compressed (x86_64)
├── ubuntu-22.04-a2r-v1.1.0-arm64.ext4.zst # Rootfs compressed (ARM64)
├── version-1.1.0-amd64.json              # Metadata + checksums
└── version-1.1.0-arm64.json              # Metadata + checksums
```

---

## Manual Release (if needed)

If you need to manually upload images to an existing release:

```bash
# Build locally first
cargo run --release -p a2r-vm-image-builder -- build

# Create release (if not exists)
gh release create v1.1.0 \
  --title "VM Images v1.1.0" \
  --notes "A2R VM Images v1.1.0"

# Upload assets
gh release upload v1.1.0 \
  ~/.a2r/vm-images/vmlinux-* \
  ~/.a2r/vm-images/initrd.img-* \
  ~/.a2r/vm-images/*.ext4.zst \
  ~/.a2r/vm-images/version-*.json
```

---

## Downloading Images (Users)

Once images are released, users can download them:

### Using the CLI
```bash
# Download latest images
a2r vm setup

# Or force re-download
a2r vm setup --force
```

### Using the Image Builder directly
```bash
cargo run --release -p a2r-vm-image-builder -- download

# Check for updates
cargo run --release -p a2r-vm-image-builder -- check-update
```

### Direct Download
```bash
# Download from GitHub Releases
wget https://github.com/Gizziio/a2rchitech/releases/download/v1.1.0/ubuntu-22.04-a2r-v1.1.0.ext4.zst

# Decompress
zstd -d ubuntu-22.04-a2r-v1.1.0.ext4.zst
```

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         A2R Desktop App                         │
│  (Electron + TypeScript)                                        │
│                                                                 │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────────────┐ │
│  │   Onboarding │───▶│  VM Manager │───▶│   Socket Server     │ │
│  │   Wizard     │    │             │    │   (Unix socket)     │ │
│  └─────────────┘    └──────┬──────┘    └─────────────────────┘ │
│                            │                                    │
│                            ▼                                    │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │                    Apple Virtualization                      ││
│  │                     (macOS) / Firecracker (Linux)            ││
│  │                                                              ││
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  ││
│  │  │a2r-vm-      │  │  Toolchains │  │   Workspace Mount   │  ││
│  │  │executor     │  │node,python  │  │   /workspace        │  ││
│  │  └──────┬──────┘  └─────────────┘  └─────────────────────┘  ││
│  └─────────┼────────────────────────────────────────────────────┘│
└────────────┼─────────────────────────────────────────────────────┘
             │
             │  Unix Socket (/var/run/a2r/desktop-vm.sock)
             │
┌────────────┼─────────────────────────────────────────────────────┐
│            ▼           A2R CLI                                    │
│  ┌─────────────────────────────────────────────────────────────┐  │
│  │  $ a2r vm exec "npm test"                                  │  │
│  │                                                            │  │
│  │  1. Check socket exists                                   │  │
│  │  2. Connect via Unix socket                               │  │
│  │  3. Send command to a2r-vm-executor                       │  │
│  │  4. Stream results back                                   │  │
│  └─────────────────────────────────────────────────────────────┘  │
└───────────────────────────────────────────────────────────────────┘
```

---

## Development Workflow

### Build Everything

```bash
cd /Users/macbook/Desktop/a2rchitech-workspace/a2rchitech

# 1. Build VM executor (runs inside VM)
cargo build --release -p a2r-vm-executor

# 2. Build image builder
cargo build --release -p a2r-vm-image-builder

# 3. Build CLI with desktop connector
cargo build --release -p a2rchitech-cli

# 4. Build desktop app
cd 7-apps/shell/desktop
npm install
npm run build
```

### Testing the Flow

```bash
# Terminal 1: Start desktop app
cd 7-apps/shell/desktop
npm run dev

# Terminal 2: Test CLI connection
./target/release/a2rchitech vm status
./target/release/a2rchitech vm exec "echo hello from vm"
```

---

## Troubleshooting

### "Desktop app not available"
- Check if socket exists: `ls /var/run/a2r/desktop-vm.sock`
- Check fallback: `ls ~/.a2r/desktop-vm.sock`
- Ensure Desktop app is running

### "VM images not found"
- Download: `a2r vm setup`
- Or build locally (Linux): `a2r-vm-image-builder build`

### "Failed to connect to Desktop app"
- Check Desktop app logs
- Verify socket permissions
- Try restarting Desktop app

### Build failures on macOS
- Local image building is Linux-only
- Use download mode: `a2r-vm-image-builder download`

---

## Versioning

VM images follow semantic versioning:
- **Major**: Breaking changes (new kernel, different base OS)
- **Minor**: New toolchains, updates
- **Patch**: Bug fixes, security updates

Current version: **1.1.0**
