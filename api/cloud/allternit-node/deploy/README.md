# A2R Node Deployment Package

This directory contains the **official deployment artifacts** for the A2R Node Agent.

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
curl -sL https://install.allternit.com | sudo ALLTERNIT_TOKEN=xxx bash

# Windows (PowerShell as Administrator)
iwr -useb https://install.allternit.com/windows | iex
```

### Alternative URLs

```bash
# GitHub CDN (faster)
curl -sL https://raw.githubusercontent.com/a2r/node/main/deploy/install.sh | sudo ALLTERNIT_TOKEN=xxx bash

# Direct from repo
curl -sL https://raw.githubusercontent.com/a2r/node/main/deploy/install.sh -o install.sh
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
│   ├── a2r-node.service       # systemd unit (Linux)
│   ├── io.a2r.node.plist      # launchd plist (macOS)
│   └── a2r-node-windows.xml   # Windows service config
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
│       └── a2r-node/
└── terraform/
    ├── aws/
    ├── gcp/
    ├── azure/
    └── hetzner/
```

## 🔧 Installation Methods

### Method 1: One-Line Install (Recommended)

```bash
curl -sL https://install.allternit.com | sudo ALLTERNIT_TOKEN=xxx bash
```

### Method 2: Manual Download

```bash
# Download installer
curl -LO https://github.com/a2r/node/releases/latest/download/install.sh

# Verify checksum
sha256sum install.sh
# Compare with checksum from GitHub releases

# Run installer
sudo ALLTERNIT_TOKEN=xxx bash install.sh
```

### Method 3: Package Manager

```bash
# Homebrew (macOS/Linux)
brew install a2r/tap/node

# APT (Ubuntu/Debian)
curl -fsSL https://packages.allternit.com/gpg | sudo apt-key add -
echo "deb [arch=amd64] https://packages.allternit.com stable main" | sudo tee /etc/apt/sources.list.d/a2r.list
sudo apt update && sudo apt install a2r-node

# YUM (RHEL/CentOS)
cat > /etc/yum.repos.d/a2r.repo << EOF
[a2r]
name=A2R Repository
baseurl=https://packages.allternit.com/rpm/\$basearch
enabled=1
gpgcheck=1
gpgkey=https://packages.allternit.com/gpg
EOF
sudo yum install a2r-node
```

### Method 4: Docker

```bash
docker run -d \
  --name a2r-node \
  --restart unless-stopped \
  -v /var/run/docker.sock:/var/run/docker.sock \
  -e ALLTERNIT_TOKEN=xxx \
  -e ALLTERNIT_NODE_ID=my-node \
  ghcr.io/a2r/node:latest
```

### Method 5: Kubernetes

```bash
helm repo add a2r https://charts.allternit.com
helm install a2r-node a2r/node \
  --namespace a2r-system \
  --create-namespace \
  --set token=xxx
```

### Method 6: Configuration Management

**Ansible:**
```yaml
- hosts: all
  roles:
    - role: a2r.node
      allternit_token: xxx
      allternit_node_id: "{{ inventory_hostname }}"
```

**Puppet:**
```puppet
include a2r::node
class { 'a2r::node':
  token => 'xxx',
}
```

**Chef:**
```ruby
include_recipe 'a2r-node::default'

node.normal['a2r-node']['token'] = 'xxx'
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
gcloud compute instances create a2r-node-1 \
  --image-family ubuntu-2204-lts \
  --metadata-from-file startup-script=deploy/cloud-init/ubuntu.yaml
```

### Azure

```bash
az vm create \
  --resource-group myResourceGroup \
  --name a2r-node-1 \
  --image Canonical:0001-com-ubuntu-server-jammy:22_04-lts:latest \
  --custom-data deploy/cloud-init/ubuntu.yaml
```

### Hetzner

```bash
hcloud server create \
  --name a2r-node-1 \
  --user-data-from-file deploy/cloud-init/ubuntu.yaml
```

## 🔐 Security

### Verify Installer Signature

```bash
# Download signature
curl -LO https://install.allternit.com/install.sh.sig

# Verify GPG signature
gpg --verify install.sh.sig install.sh
```

### Verify Binary Checksum

```bash
# Download checksums
curl -LO https://github.com/a2r/node/releases/latest/download/SHA256SUMS

# Verify
sha256sum -c SHA256SUMS
```

### Offline Installation

```bash
# 1. On connected machine
curl -LO https://github.com/a2r/node/releases/latest/download/a2r-node-linux-x86_64
curl -LO https://github.com/a2r/node/releases/latest/download/SHA256SUMS

# 2. Verify
sha256sum -c SHA256SUMS

# 3. Transfer to offline machine
scp a2r-node-linux-x86_64 user@offline-host:/tmp/

# 4. Install manually
sudo mkdir -p /opt/a2r/bin
sudo mv /tmp/a2r-node-linux-x86_64 /opt/a2r/bin/a2r-node
sudo chmod +x /opt/a2r/bin/a2r-node
```

## 📊 Deployment Options

### Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `ALLTERNIT_TOKEN` | Yes | - | Node authentication token |
| `ALLTERNIT_NODE_ID` | No | Auto | Custom node ID |
| `ALLTERNIT_CONTROL_PLANE` | No | wss://control.allternit.com | Control plane URL |
| `ALLTERNIT_VERSION` | No | latest | Specific version |
| `ALLTERNIT_INSTALL_DIR` | No | /opt/a2r | Installation path |
| `ALLTERNIT_CONFIG_DIR` | No | /etc/a2r | Config path |
| `ALLTERNIT_LOG_DIR` | No | /var/log/a2r | Log path |
| `ALLTERNIT_LABELS` | No | - | Node capabilities |

### Example: Custom Deployment

```bash
ALLTERNIT_TOKEN=xxx \
ALLTERNIT_NODE_ID=prod-node-us-east-1 \
ALLTERNIT_CONTROL_PLANE=wss://us-east.control.allternit.com \
ALLTERNIT_LABELS=production,us-east,high-memory \
ALLTERNIT_INSTALL_DIR=/usr/local/a2r \
curl -sL https://install.allternit.com | sudo bash
```

## 🔍 Verification

After installation:

```bash
# Check service status
sudo systemctl status a2r-node

# View logs
sudo journalctl -u a2r-node -n 50

# Verify binary
a2r-node --version

# Check config
sudo cat /etc/a2r/node.env

# Test Docker integration
docker ps
```

## 🧹 Uninstallation

```bash
# Using uninstaller
curl -sL https://install.allternit.com | sudo bash -s -- --uninstall

# Manual removal
sudo systemctl stop a2r-node
sudo systemctl disable a2r-node
sudo rm -rf /opt/a2r /etc/a2r /var/log/a2r
sudo rm /etc/systemd/system/a2r-node.service
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
- Check logs: `sudo journalctl -u a2r-node`
- Test connection: `curl -I https://control.allternit.com`
- Verify Docker: `docker ps`

**Contact:**
- Documentation: https://docs.allternit.com
- Discord: https://discord.gg/a2r
- GitHub Issues: https://github.com/a2r/node/issues
- Email: support@allternit.com

## 📄 License

Deployment scripts are licensed under MIT. See [LICENSE](../LICENSE) for details.
