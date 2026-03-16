# A2R Backend - Native Binary Distribution

**Self-hosted A2R platform** - distributed as compiled binaries, no Docker required.

## 🚀 Quick Install

```bash
# One-line install (Linux/macOS)
curl -s https://install.a2r.io/backend | sudo bash

# With specific version
A2R_VERSION=1.0.0 curl -s https://install.a2r.io/backend | sudo bash
```

## 📦 What's Included

| Binary | Purpose | Port |
|--------|---------|------|
| `a2r-api` | Main API gateway | 4096 |
| `a2r-kernel` | Agent kernel service | 3004 |
| `a2r-memory` | Memory/persistence service | 3200 |
| `a2r-workspace` | Terminal/workspace service | 3021 |
| `a2r-web` | Web UI server | 3001 |

## 📁 Installation Layout

```
/opt/a2r/                      # Installation directory
├── bin/
│   ├── a2r-api               # Main API binary
│   ├── a2r-kernel            # Kernel service
│   ├── a2r-memory            # Memory service
│   ├── a2r-workspace         # Workspace service
│   └── a2r-web               # Web UI server
├── web/                      # Static web assets
└── lib/                      # Shared libraries

/etc/a2r/
└── backend.yaml              # Main configuration

/var/lib/a2r/                 # Data directory
├── a2r.db                    # SQLite database
└── ...

/var/log/a2r/                 # Log files
├── a2r.log
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
git clone https://github.com/a2r/backend.git
cd backend

# Build all binaries
./scripts/build-release.sh

# Or build individually
cargo build --release -p a2r-api
cargo build --release -p a2r-kernel
cargo build --release -p a2r-memory
```

### Create Release Package

```bash
# Create distribution package
./distribution/backend/scripts/package-release.sh

# Output: a2r-backend-1.0.0-x86_64-linux.tar.gz
```

## 📦 Packaging

### Supported Formats

| Format | Status | Command |
|--------|--------|---------|
| Raw binaries | ✅ | `tar.gz` archive |
| `.deb` (Debian/Ubuntu) | ✅ | `dpkg -i a2r-backend.deb` |
| `.rpm` (RHEL/CentOS) | ✅ | `rpm -i a2r-backend.rpm` |
| Homebrew (macOS) | ✅ | `brew install a2r/tap/backend` |
| AUR (Arch) | 🔄 | `yay -S a2r-backend` |

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
chmod 640 /etc/a2r/backend.yaml
chown root:root /etc/a2r/backend.yaml

# Data directory (a2r user)
chown -R a2r:a2r /var/lib/a2r
chmod 750 /var/lib/a2r

# Log directory
chown -R a2r:a2r /var/log/a2r
chmod 755 /var/log/a2r
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
    server_name a2r.yourdomain.com;
    
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
sudo a2rctl updates enable

# Check for updates
sudo a2rctl updates check

# Apply update
sudo a2rctl updates apply
```

### Manual Update

```bash
# Re-run installer (preserves config)
curl -s https://install.a2r.io/backend | sudo bash

# Or download and install specific version
curl -LO https://github.com/a2r/backend/releases/download/v1.1.0/a2r-backend-1.1.0-x86_64-linux.tar.gz
tar -xzf a2r-backend-1.1.0-x86_64-linux.tar.gz
sudo ./install.sh
```

## 🧹 Uninstallation

```bash
# Full uninstall
curl -s https://install.a2r.io/backend | sudo bash -s -- --uninstall

# Or manual
sudo systemctl stop a2r-api a2r-kernel a2r-memory a2r-web
sudo systemctl disable a2r-api a2r-kernel a2r-memory a2r-web
sudo rm -rf /opt/a2r /etc/a2r /var/lib/a2r /var/log/a2r
sudo rm /etc/systemd/system/a2r-*.service
sudo systemctl daemon-reload
```

## 📊 Monitoring

### Systemd Status

```bash
# Check all services
sudo systemctl status 'a2r-*'

# View logs
sudo journalctl -u a2r-api -f
sudo journalctl -u a2r-kernel -f
```

### Health Check

```bash
# API health
curl http://localhost:4096/health

# Full status
a2rctl status
```

## 🆘 Troubleshooting

### Service Won't Start

```bash
# Check logs
sudo journalctl -u a2r-api -n 100

# Verify config
sudo a2rctl config validate

# Check permissions
ls -la /var/lib/a2r
ls -la /var/log/a2r
```

### Port Already in Use

```bash
# Find process using port 4096
sudo lsof -i :4096

# Kill process or change port in /etc/a2r/backend.yaml
```

## 📄 License

MIT License - See LICENSE file for details.
