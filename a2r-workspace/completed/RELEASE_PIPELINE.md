# A2R Release Pipeline

This document describes the automated build and release pipeline for A2R (A2rchitect Runtime).

## Overview

The release pipeline uses GitHub Actions to build cross-platform binaries, create distribution packages, sign artifacts, and publish GitHub releases.

## Supported Platforms

| Platform | Architecture | Formats | Priority |
|----------|--------------|---------|----------|
| Linux | x86_64 | .deb, .tar.gz | P0 |
| Linux | aarch64 | .deb, .tar.gz | P0 |
| macOS | universal (x86_64 + aarch64) | .dmg, .tar.gz | P1 |
| Windows | x86_64 | .zip | P2 |

## Triggering Releases

### Automatic Releases (Recommended)

Push a git tag to trigger an automatic release:

```bash
# Create and push a version tag
git tag -a v0.1.0 -m "Release v0.1.0"
git push origin v0.1.0
```

The workflow will automatically:
1. Run security audits (zizmor)
2. Build for all platforms
3. Sign artifacts with Sigstore/cosign
4. Create a GitHub release with all artifacts

### Manual Releases

You can also trigger the workflow manually from the GitHub Actions tab.

## Installation

### One-liner Install

```bash
curl -fsSL https://raw.githubusercontent.com/a2rchitech/a2rchitech/main/install.sh | sh
```

With specific version:
```bash
curl -fsSL https://raw.githubusercontent.com/a2rchitech/a2rchitech/main/install.sh | VERSION=0.1.0 sh
```

### Homebrew (macOS/Linux)

```bash
brew tap a2rchitech/tap
brew install a2r
```

### Debian/Ubuntu

```bash
wget https://github.com/a2rchitech/a2rchitech/releases/download/v0.1.0/a2r_0.1.0_amd64.deb
sudo dpkg -i a2r_0.1.0_amd64.deb
```

### Manual Download

Download the appropriate artifact from the [releases page](https://github.com/a2rchitech/a2rchitech/releases).

## Artifact Verification

All artifacts are signed with Sigstore/cosign. To verify:

```bash
# Verify a .deb package
cosign verify-blob \
  --signature a2r_0.1.0_amd64.deb.sig \
  --certificate a2r_0.1.0_amd64.deb.crt \
  a2r_0.1.0_amd64.deb

# Verify checksum
sha256sum -c a2r_0.1.0_amd64.deb.sha256
```

## Workflow Structure

```
┌─────────────┐
│   zizmor    │  Security audit
└──────┬──────┘
       │
       ▼
┌─────────────────────────────────────┐
│           build-linux               │
│  ┌─────────────┐  ┌─────────────┐  │
│  │   x86_64    │  │   aarch64   │  │
│  │  (.deb)     │  │  (.deb)     │  │
│  └─────────────┘  └─────────────┘  │
└─────────────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────┐
│          build-macos                │
│     (universal binary + .dmg)       │
└─────────────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────┐
│         build-windows               │
│          (.zip for now)             │
└─────────────────────────────────────┘
       │
       ▼
┌─────────────┐
│   release   │  GitHub Release
└─────────────┘
```

## File Locations

| File | Purpose |
|------|---------|
| `.github/workflows/release.yml` | Main release workflow |
| `.github/homebrew/a2r.rb` | Homebrew formula template |
| `install.sh` | One-liner install script |
| `Cargo.toml` | Contains cargo-deb/rpm metadata |

## Adding New Build Targets

To add a new target:

1. Add the target to the build matrix in `release.yml`
2. Update the install script (`install.sh`) to detect the new platform
3. Update the Homebrew formula if applicable

## Troubleshooting

### Build Failures

Check the GitHub Actions logs for specific error messages. Common issues:

- Missing dependencies (libssl-dev, etc.)
- Cross-compilation toolchain issues
- Permission errors with artifact signing

### Artifact Signing Issues

If cosign signing fails:
1. Ensure the workflow has `id-token: write` permissions
2. Check that the repository has OIDC enabled
3. Verify Sigstore is accessible from the runner

### Release Not Created

If artifacts are built but the release is not created:
1. Ensure you're pushing a tag (not just a commit)
2. Check that the release job has `contents: write` permission
3. Verify the tag follows the `v*` pattern

## Security Considerations

1. **Pinned Actions**: All GitHub Actions use SHA-pinned versions
2. **Artifact Signing**: All artifacts are signed with Sigstore/cosign
3. **Workflow Audits**: zizmor runs on every release
4. **Minimal Permissions**: Each job has only the permissions it needs
5. **No Persisted Credentials**: `persist-credentials: false` on all checkouts
