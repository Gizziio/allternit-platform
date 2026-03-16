# A2R Backend Distribution - Native Binary Approach

## Overview

Following the **a2r-node** deployment pattern, A2R Backend is distributed as **compiled native binaries** (not Docker containers). This provides:

- ✅ Simple installation (`curl | bash`)
- ✅ Native systemd/launchd integration
- ✅ No Docker dependency
- ✅ Smaller footprint (~50MB vs 500MB+ containers)
- ✅ Better performance (no container overhead)

## Distribution Structure

```
distribution/backend/
├── deploy/
│   ├── install.sh              # Universal installer (curl | bash)
│   ├── README.md               # Installation documentation
│   └── services/               # System service definitions
│       ├── a2r-api.service     # systemd unit (Linux)
│       └── io.a2r.backend.plist # launchd plist (macOS)
│
├── scripts/
│   ├── build-release.sh        # Build release binaries
│   ├── build-deb.sh           # Build .deb package
│   └── build-rpm.sh           # Build .rpm package
│
├── homebrew/
│   └── a2r-backend.rb         # Homebrew formula
│
└── .github/workflows/
    └── release.yml            # GitHub Actions release automation
```

## Installation Methods

### 1. One-Line Install (Recommended)

```bash
curl -s https://install.a2r.io/backend | sudo bash
```

This installs:
- Binaries to `/opt/a2r/bin/`
- Config to `/etc/a2r/backend.yaml`
- Data to `/var/lib/a2r/`
- systemd services (auto-enabled)

### 2. Package Managers

```bash
# Homebrew (macOS/Linux)
brew install a2r/tap/backend

# APT (Ubuntu/Debian)
sudo apt install a2r-backend

# YUM (RHEL/CentOS)
sudo yum install a2r-backend
```

### 3. Manual Download

```bash
# Download release
curl -LO https://github.com/a2r/backend/releases/latest/download/a2r-backend-1.0.0-x86_64-linux.tar.gz

# Extract and install
tar -xzf a2r-backend-1.0.0-x86_64-linux.tar.gz
cd a2r-backend-1.0.0-x86_64-linux
sudo ./install.sh
```

## Release Process

### 1. Build Binaries

```bash
cd distribution/backend
./scripts/build-release.sh
```

Outputs:
- `a2r-backend-{version}-x86_64-linux.tar.gz`
- `a2r-backend-{version}-aarch64-linux.tar.gz`
- `a2r-backend-{version}-x86_64-macos.tar.gz`
- `a2r-backend-{version}-aarch64-macos.tar.gz`

### 2. Create GitHub Release

```bash
git tag -a v1.0.0 -m "Release v1.0.0"
git push origin v1.0.0
```

GitHub Actions automatically:
- Builds all platform binaries
- Creates .deb package
- Generates SHA256 checksums
- Publishes GitHub Release with artifacts

### 3. Update Homebrew

```bash
# Calculate new SHA256s
shasum -a 256 dist/*.tar.gz

# Update formula
sed -i '' 's/PLACEHOLDER_SHA256_X86_64_MACOS/actual_hash/' homebrew/a2r-backend.rb

# Commit and push
git add homebrew/a2r-backend.rb
git commit -m "Update a2r-backend to v1.0.0"
git push
```

## Service Architecture

Each binary is a separate systemd service:

| Service | Binary | Port | Purpose |
|---------|--------|------|---------|
| a2r-api | `a2r-api` | 4096 | Main API gateway |
| a2r-kernel | `a2r-kernel` | 3004 | Agent kernel |
| a2r-memory | `a2r-memory` | 3200 | Memory/persistence |
| a2r-web | `a2r-web` | 3001 | Web UI server |

### systemd Service Features

- **Auto-restart**: Always restart on crash
- **Security hardening**: `NoNewPrivileges`, `ProtectSystem`, `PrivateTmp`
- **Resource limits**: File descriptors, memory, CPU
- **Journal logging**: Structured logs via journald

### Service Commands

```bash
# Check status
sudo systemctl status a2r-api

# View logs
sudo journalctl -u a2r-api -f

# Restart service
sudo systemctl restart a2r-api

# Stop all services
sudo systemctl stop 'a2r-*'
```

## Configuration

Default config location: `/etc/a2r/backend.yaml`

```yaml
server:
  host: 0.0.0.0
  port: 4096

api:
  cors_origins:
    - "http://localhost:3000"
    - "http://localhost:5173"

security:
  jwt_secret: "auto-generated-on-install"
  api_key: "auto-generated-on-install"

database:
  type: sqlite
  path: /var/lib/a2r/a2r.db

services:
  kernel:
    enabled: true
    port: 3004
  memory:
    enabled: true
    port: 3200
```

## Comparison: Native vs Docker

| Aspect | Native (This) | Docker |
|--------|---------------|--------|
| Install size | ~50MB | ~500MB+ |
| Memory overhead | None | ~100MB+ |
| Startup time | <1s | 5-10s |
| Update process | Binary swap | Pull + restart |
| Service management | systemd | docker-compose |
| Logs | journald | docker logs |
| Security | systemd hardening | container isolation |

## Integration with A2R Desktop

The A2R Desktop (thin client) connects to these backend services:

```
┌─────────────────┐      HTTP/WebSocket      ┌──────────────────┐
│   A2R Desktop   │ ◄──────────────────────► │   A2R Backend    │
│   (50MB client) │   http://your-vps:4096   │  (Your VPS/host) │
└─────────────────┘                          └──────────────────┘
                                                      │
                                              ┌───────┴───────┐
                                              ▼               ▼
                                        ┌─────────┐     ┌──────────┐
                                        │ a2r-api │     │ a2r-web  │
                                        │ :4096   │     │ :3001    │
                                        └────┬────┘     └──────────┘
                                             │
                                        ┌────┴────┐
                                        ▼         ▼
                                  ┌────────┐  ┌─────────┐
                                  │kernel  │  │ memory  │
                                  │:3004   │  │ :3200   │
                                  └────────┘  └─────────┘
```

## Migration from Source

For existing source-based deployments:

```bash
# 1. Stop current services
pm2 stop all  # or however you run it now

# 2. Install binary version
curl -s https://install.a2r.io/backend | sudo bash

# 3. Migrate data (if needed)
sudo cp -r /path/to/old/data/* /var/lib/a2r/
sudo chown -R a2r:a2r /var/lib/a2r

# 4. Start new services
sudo systemctl start a2r-api a2r-kernel a2r-memory a2r-web
```

## Uninstallation

```bash
# Full uninstall (preserves data)
curl -s https://install.a2r.io/backend | sudo bash -s -- --uninstall

# Complete removal (including data)
sudo rm -rf /opt/a2r /etc/a2r /var/lib/a2r /var/log/a2r
```

## Future Enhancements

- [ ] Auto-update mechanism (`a2rctl updates check`)
- [ ] RPM package builder
- [ ] Windows installer (NSIS)
- [ ] Arch Linux AUR package
- [ ] Nix package
- [ ] Snap package
- [ ] Flatpak (for desktop bundle)

## References

- Based on: `8-cloud/a2r-node/deploy/` pattern
- Thin client model: A2R Desktop connects to user-hosted backend
- Similar to: ChatGPT Enterprise self-hosted, Claude for Work
