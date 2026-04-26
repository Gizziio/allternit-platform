# Allternit Backend - Native Binary Distribution

**Self-hosted Allternit platform** - distributed as compiled binaries, no Docker required.

## 🚀 Quick Install

```bash
# One-line install (Linux/macOS)
curl -s https://install.allternit.com/backend | sudo bash

# With specific version
ALLTERNIT_VERSION=1.0.0 curl -s https://install.allternit.com/backend | sudo bash
```

## 📦 What's Included

| Binary | Purpose | Port |
|--------|---------|------|
| `allternit-api` | Main API gateway | 4096 |
| `allternit-kernel` | Agent kernel service | 3004 |
| `allternit-memory` | Memory/persistence service | 3200 |
| `allternit-workspace` | Terminal/workspace service | 3021 |
| `allternit-web` | Web UI server | 3001 |

## 📁 Installation Layout

```
/opt/allternit/                      # Installation directory
├── bin/
│   ├── allternit-api               # Main API binary
│   ├── allternit-kernel            # Kernel service
│   ├── allternit-memory            # Memory service
│   ├── allternit-workspace         # Workspace service
│   └── allternit-web               # Web UI server
├── web/                      # Static web assets
└── lib/                      # Shared libraries

/etc/allternit/
└── backend.yaml              # Main configuration

/var/lib/allternit/                 # Data directory
├── allternit.db                    # SQLite database
└── ...

/var/log/allternit/                 # Log files
├── allternit.log
└── ...
```

## 🔧 System Requirements

- **OS**: Linux (Ubuntu 20.04+, Debian 11+, RHEL 8+) or macOS 12+
- **Architecture**: x86_64 or ARM64
- **RAM**: 2GB minimum, 4GB recommended
- **Storage**: 10GB free space
- **Network**: Ports 3001, 4096 open

## 🛠️ Building from Source

### Prerequisites

```bash
# Install Rust
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh

# Install dependencies (Ubuntu/Debian)
sudo apt-get update
sudo apt-get install -y build-essential pkg-config libssl-dev

# Install dependencies (macOS)
brew install openssl
```

### Build Release Binaries

```bash
# Clone repository
git clone https://github.com/allternit/backend.git
cd backend

# Build all binaries
./scripts/build-release.sh

# Or build individually
cargo build --release -p allternit-api
cargo build --release -p allternit-kernel
cargo build --release -p allternit-memory
```

### Create Release Package

```bash
# Create distribution package
./distribution/backend/scripts/package-release.sh

# Output: allternit-backend-1.0.0-x86_64-linux.tar.gz
```

## 📦 Packaging

### Supported Formats

| Format | Status | Command |
|--------|--------|---------|
| Raw binaries | ✅ | `tar.gz` archive |
| `.deb` (Debian/Ubuntu) | ✅ | `dpkg -i allternit-backend.deb` |
| `.rpm` (RHEL/CentOS) | ✅ | `rpm -i allternit-backend.rpm` |
| Homebrew (macOS) | ✅ | `brew install allternit/tap/backend` |
| AUR (Arch) | 🔄 | `yay -S allternit-backend` |

### Build Debian Package

```bash
cd distribution/backend
./scripts/build-deb.sh
```

### Build RPM Package

```bash
cd distribution/backend
./scripts/build-rpm.sh
```

## 🔐 Security

### File Permissions

```bash
# Config files (readable only by root)
chmod 640 /etc/allternit/backend.yaml
chown root:root /etc/allternit/backend.yaml

# Data directory (allternit user)
chown -R allternit:allternit /var/lib/allternit
chmod 750 /var/lib/allternit

# Log directory
chown -R allternit:allternit /var/log/allternit
chmod 755 /var/log/allternit
```

### Systemd Security Features

The systemd services include:
- `NoNewPrivileges=true` - Cannot gain privileges
- `ProtectSystem=strict` - Read-only filesystem
- `ProtectHome=true` - No access to /home
- `PrivateTmp=true` - Private /tmp
- `ReadWritePaths` - Limited write access

## 🌐 Network Configuration

### Firewall Rules

```bash
# UFW (Ubuntu)
sudo ufw allow 4096/tcp  # API
sudo ufw allow 3001/tcp  # Web UI

# firewalld (RHEL)
sudo firewall-cmd --permanent --add-port=4096/tcp
sudo firewall-cmd --permanent --add-port=3001/tcp
sudo firewall-cmd --reload
```

### Nginx Reverse Proxy

```nginx
server {
    listen 80;
    server_name allternit.yourdomain.com;
    
    location / {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
    
    location /api/ {
        proxy_pass http://localhost:4096/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

## 🔄 Updates

### Automatic Updates

```bash
# Enable automatic updates
sudo allternitctl updates enable

# Check for updates
sudo allternitctl updates check

# Apply update
sudo allternitctl updates apply
```

### Manual Update

```bash
# Re-run installer (preserves config)
curl -s https://install.allternit.com/backend | sudo bash

# Or download and install specific version
curl -LO https://github.com/allternit/backend/releases/download/v1.1.0/allternit-backend-1.1.0-x86_64-linux.tar.gz
tar -xzf allternit-backend-1.1.0-x86_64-linux.tar.gz
sudo ./install.sh
```

## 🧹 Uninstallation

```bash
# Full uninstall
curl -s https://install.allternit.com/backend | sudo bash -s -- --uninstall

# Or manual
sudo systemctl stop allternit-api allternit-kernel allternit-memory allternit-web
sudo systemctl disable allternit-api allternit-kernel allternit-memory allternit-web
sudo rm -rf /opt/allternit /etc/allternit /var/lib/allternit /var/log/allternit
sudo rm /etc/systemd/system/allternit-*.service
sudo systemctl daemon-reload
```

## 📊 Monitoring

### Systemd Status

```bash
# Check all services
sudo systemctl status 'allternit-*'

# View logs
sudo journalctl -u allternit-api -f
sudo journalctl -u allternit-kernel -f
```

### Health Check

```bash
# API health
curl http://localhost:4096/health

# Full status
allternitctl status
```

## 🆘 Troubleshooting

### Service Won't Start

```bash
# Check logs
sudo journalctl -u allternit-api -n 100

# Verify config
sudo allternitctl config validate

# Check permissions
ls -la /var/lib/allternit
ls -la /var/log/allternit
```

### Port Already in Use

```bash
# Find process using port 4096
sudo lsof -i :4096

# Kill process or change port in /etc/allternit/backend.yaml
```

## 📄 License

MIT License - See LICENSE file for details.
