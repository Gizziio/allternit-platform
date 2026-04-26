# Allternit Node Deployment Package

This directory contains the **official deployment artifacts** for the Allternit Node Agent.

## 📦 What's Here

| File/Directory | Purpose |
|----------------|---------|
| `install.sh` | Universal installer for Linux/macOS |
| `install-windows.ps1` | Windows PowerShell installer |
| `services/` | System service definitions (systemd, launchd) |
| `cloud-init/` | Cloud provider initialization scripts |
| `docker/` | Docker containerization files |
| `ansible/` | Ansible deployment playbooks |
| `terraform/` | Terraform provisioning modules |

## 🚀 Quick Deploy

### One-Line Install (Production)

```bash
# Linux/macOS
curl -sL https://install.allternit.io | sudo Allternit_TOKEN=xxx bash

# Windows (PowerShell as Administrator)
iwr -useb https://install.allternit.io/windows | iex
```

### Alternative URLs

```bash
# GitHub CDN (faster)
curl -sL https://raw.githubusercontent.com/allternit/node/main/deploy/install.sh | sudo Allternit_TOKEN=xxx bash

# Direct from repo
curl -sL https://raw.githubusercontent.com/allternit/node/main/deploy/install.sh -o install.sh
chmod +x install.sh
sudo ./install.sh
```

## 📁 Directory Structure

```
deploy/
├── install.sh              # Main installer (Linux/macOS)
├── install-windows.ps1     # Windows installer
├── README.md               # This file
├── services/
│   ├── allternit-node.service       # systemd unit (Linux)
│   ├── io.allternit.node.plist      # launchd plist (macOS)
│   └── allternit-node-windows.xml   # Windows service config
├── cloud-init/
│   ├── ubuntu.yaml         # Ubuntu cloud-init
│   ├── debian.yaml         # Debian cloud-init
│   └── amazon-linux.yaml   # Amazon Linux cloud-init
├── docker/
│   ├── Dockerfile          # Node agent container
│   └── docker-compose.yml  # Docker Compose setup
├── ansible/
│   ├── playbook.yml        # Ansible deployment
│   └── roles/
│       └── allternit-node/
└── terraform/
    ├── aws/
    ├── gcp/
    ├── azure/
    └── hetzner/
```

## 🔧 Installation Methods

### Method 1: One-Line Install (Recommended)

```bash
curl -sL https://install.allternit.io | sudo Allternit_TOKEN=xxx bash
```

### Method 2: Manual Download

```bash
# Download installer
curl -LO https://github.com/allternit/node/releases/latest/download/install.sh

# Verify checksum
sha256sum install.sh
# Compare with checksum from GitHub releases

# Run installer
sudo Allternit_TOKEN=xxx bash install.sh
```

### Method 3: Package Manager

```bash
# Homebrew (macOS/Linux)
brew install allternit/tap/node

# APT (Ubuntu/Debian)
curl -fsSL https://packages.allternit.io/gpg | sudo apt-key add -
echo "deb [arch=amd64] https://packages.allternit.io stable main" | sudo tee /etc/apt/sources.list.d/allternit.list
sudo apt update && sudo apt install allternit-node

# YUM (RHEL/CentOS)
cat > /etc/yum.repos.d/allternit.repo << EOF
[allternit]
name=Allternit Repository
baseurl=https://packages.allternit.io/rpm/\$basearch
enabled=1
gpgcheck=1
gpgkey=https://packages.allternit.io/gpg
EOF
sudo yum install allternit-node
```

### Method 4: Docker

```bash
docker run -d \
  --name allternit-node \
  --restart unless-stopped \
  -v /var/run/docker.sock:/var/run/docker.sock \
  -e Allternit_TOKEN=xxx \
  -e Allternit_NODE_ID=my-node \
  ghcr.io/allternit/node:latest
```

### Method 5: Kubernetes

```bash
helm repo add allternit https://charts.allternit.io
helm install allternit-node allternit/node \
  --namespace allternit-system \
  --create-namespace \
  --set token=xxx
```

### Method 6: Configuration Management

**Ansible:**
```yaml
- hosts: all
  roles:
    - role: allternit.node
      allternit_token: xxx
      allternit_node_id: "{{ inventory_hostname }}"
```

**Puppet:**
```puppet
include allternit::node
class { 'allternit::node':
  token => 'xxx',
}
```

**Chef:**
```ruby
include_recipe 'allternit-node::default'

node.normal['allternit-node']['token'] = 'xxx'
```

## 🌩️ Cloud Provider Deployment

### AWS

```bash
# Using AWS CLI
aws ec2 run-instances \
  --image-id ami-0c55b159cbfafe1f0 \
  --instance-type t3.medium \
  --user-data file://deploy/cloud-init/amazon-linux.yaml
```

### GCP

```bash
gcloud compute instances create allternit-node-1 \
  --image-family ubuntu-2204-lts \
  --metadata-from-file startup-script=deploy/cloud-init/ubuntu.yaml
```

### Azure

```bash
az vm create \
  --resource-group myResourceGroup \
  --name allternit-node-1 \
  --image Canonical:0001-com-ubuntu-server-jammy:22_04-lts:latest \
  --custom-data deploy/cloud-init/ubuntu.yaml
```

### Hetzner

```bash
hcloud server create \
  --name allternit-node-1 \
  --user-data-from-file deploy/cloud-init/ubuntu.yaml
```

## 🔐 Security

### Verify Installer Signature

```bash
# Download signature
curl -LO https://install.allternit.io/install.sh.sig

# Verify GPG signature
gpg --verify install.sh.sig install.sh
```

### Verify Binary Checksum

```bash
# Download checksums
curl -LO https://github.com/allternit/node/releases/latest/download/SHA256SUMS

# Verify
sha256sum -c SHA256SUMS
```

### Offline Installation

```bash
# 1. On connected machine
curl -LO https://github.com/allternit/node/releases/latest/download/allternit-node-linux-x86_64
curl -LO https://github.com/allternit/node/releases/latest/download/SHA256SUMS

# 2. Verify
sha256sum -c SHA256SUMS

# 3. Transfer to offline machine
scp allternit-node-linux-x86_64 user@offline-host:/tmp/

# 4. Install manually
sudo mkdir -p /opt/allternit/bin
sudo mv /tmp/allternit-node-linux-x86_64 /opt/allternit/bin/allternit-node
sudo chmod +x /opt/allternit/bin/allternit-node
```

## 📊 Deployment Options

### Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `Allternit_TOKEN` | Yes | - | Node authentication token |
| `Allternit_NODE_ID` | No | Auto | Custom node ID |
| `Allternit_CONTROL_PLANE` | No | wss://control.allternit.io | Control plane URL |
| `Allternit_VERSION` | No | latest | Specific version |
| `Allternit_INSTALL_DIR` | No | /opt/allternit | Installation path |
| `Allternit_CONFIG_DIR` | No | /etc/allternit | Config path |
| `Allternit_LOG_DIR` | No | /var/log/allternit | Log path |
| `Allternit_LABELS` | No | - | Node capabilities |

### Example: Custom Deployment

```bash
Allternit_TOKEN=xxx \
Allternit_NODE_ID=prod-node-us-east-1 \
Allternit_CONTROL_PLANE=wss://us-east.control.allternit.io \
Allternit_LABELS=production,us-east,high-memory \
Allternit_INSTALL_DIR=/usr/local/allternit \
curl -sL https://install.allternit.io | sudo bash
```

## 🔍 Verification

After installation:

```bash
# Check service status
sudo systemctl status allternit-node

# View logs
sudo journalctl -u allternit-node -n 50

# Verify binary
allternit-node --version

# Check config
sudo cat /etc/allternit/node.env

# Test Docker integration
docker ps
```

## 🧹 Uninstallation

```bash
# Using uninstaller
curl -sL https://install.allternit.io | sudo bash -s -- --uninstall

# Manual removal
sudo systemctl stop allternit-node
sudo systemctl disable allternit-node
sudo rm -rf /opt/allternit /etc/allternit /var/log/allternit
sudo rm /etc/systemd/system/allternit-node.service
sudo systemctl daemon-reload
```

## 📝 Changelog

### v0.1.0 (Current)
- Initial release
- Linux/macOS/Windows support
- systemd and launchd integration
- Docker auto-installation
- Binary download from GitHub Releases
- Source build fallback

## 🆘 Support

**Installation Issues:**
- Check logs: `sudo journalctl -u allternit-node`
- Test connection: `curl -I https://control.allternit.io`
- Verify Docker: `docker ps`

**Contact:**
- Documentation: https://docs.allternit.io
- Discord: https://discord.gg/allternit
- GitHub Issues: https://github.com/allternit/node/issues
- Email: support@allternit.io

## 📄 License

Deployment scripts are licensed under MIT. See [LICENSE](../LICENSE) for details.
