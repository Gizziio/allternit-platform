# Allternit Node Deployment Guide

This guide covers deploying the Allternit Node Agent in various environments and configurations.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Cloud Deployment](#cloud-deployment)
3. [Local Deployment](#local-deployment)
4. [Enterprise Deployment](#enterprise-deployment)
5. [Security Hardening](#security-hardening)
6. [Monitoring & Observability](#monitoring--observability)
7. [Troubleshooting](#troubleshooting)

## Prerequisites

### System Requirements

| Resource | Minimum | Recommended |
|----------|---------|-------------|
| CPU | 1 core | 2+ cores |
| Memory | 512 MB | 2+ GB |
| Disk | 1 GB | 10+ GB |
| Network | Outbound 443 | Outbound 443 + Docker registry |

### Software Requirements

- **Docker**: 20.10+ (for containerized jobs)
- **Linux**: systemd-based distro (Ubuntu 20.04+, Debian 11+, RHEL 8+)
- **macOS**: 11+ (Big Sur or later)
- **Windows**: Windows 10/11 with Docker Desktop

### Network Requirements

- **Outbound**: WebSocket Secure (WSS) on port 443
- **Inbound**: None required (reverse tunnel architecture)
- **DNS**: Resolution for control plane URL

## Cloud Deployment

### Hetzner Cloud

```bash
# Create server via Hetzner CLI
hcloud server create \
  --name allternit-node-1 \
  --type cx21 \
  --image ubuntu-22.04 \
  --location fsn1 \
  --ssh-key your-key \
  --user-data-from-file cloud-init.yaml

# cloud-init.yaml
#cloud-config
packages:
  - docker.io
  - curl

runcmd:
  - systemctl enable --now docker
  - curl -s https://allternit.io/install.sh | Allternit_TOKEN=your_token bash
```

### DigitalOcean

```bash
# Create droplet via doctl
doctl compute droplet create allternit-node-1 \
  --size s-2vcpu-2gb \
  --image ubuntu-22-04-x64 \
  --region nyc3 \
  --ssh-keys your-key \
  --user-data-file cloud-init.yaml
```

### AWS EC2

```bash
# Create instance via AWS CLI
aws ec2 run-instances \
  --image-id ami-0c55b159cbfafe1f0 \
  --count 1 \
  --instance-type t3.medium \
  --key-name your-key \
  --security-group-ids sg-xxxxx \
  --user-data file://cloud-init.yaml
```

### GCP Compute Engine

```bash
# Create instance via gcloud
gcloud compute instances create allternit-node-1 \
  --machine-type=e2-medium \
  --zone=us-central1-a \
  --image-family=ubuntu-2204-lts \
  --image-project=ubuntu-os-cloud \
  --metadata-from-file startup-script=cloud-init.yaml
```

## Local Deployment

### Ubuntu/Debian

```bash
# Install Docker
curl -fsSL https://get.docker.com | sh
usermod -aG docker $USER

# Install Allternit Node
curl -s https://allternit.io/install.sh | Allternit_TOKEN=your_token bash

# Verify installation
sudo systemctl status allternit-node
docker ps
```

### macOS

```bash
# Install Docker Desktop
# Download from: https://docs.docker.com/desktop/install/mac-install/

# Install Allternit Node
sudo curl -s https://allternit.io/install.sh | Allternit_TOKEN=your_token bash

# Verify installation
launchctl list | grep allternit
docker ps
```

### Windows

```powershell
# Install Docker Desktop
# Download from: https://docs.docker.com/desktop/install/windows-install/

# Install Allternit Node (Run as Administrator)
.\install-windows.ps1 -Token "your_token"

# Verify installation
Get-Service allternit-node
docker ps
```

## Enterprise Deployment

### High Availability Setup

Deploy multiple nodes for redundancy:

```bash
# Deploy 3 nodes across different zones
for i in 1 2 3; do
  curl -s https://allternit.io/install.sh | \
    Allternit_TOKEN=your_token \
    Allternit_NODE_ID=prod-node-$i \
    Allternit_LABELS=production,zone-$i \
    bash
done
```

### Air-Gapped Environment

```bash
# 1. Download binary on connected machine
curl -L https://github.com/allternit/node/releases/latest/download/allternit-node-linux-x86_64 \
  -o allternit-node

# 2. Transfer to air-gapped machine
scp allternit-node user@airgapped-host:/tmp/

# 3. Install manually
sudo mkdir -p /opt/allternit/bin
sudo mv /tmp/allternit-node /opt/allternit/bin/
sudo chmod +x /opt/allternit/bin/allternit-node

# 4. Create config
sudo mkdir -p /etc/allternit
sudo cat > /etc/allternit/node.env << EOF
Allternit_NODE_ID=airgap-node-1
Allternit_TOKEN=your_token
Allternit_CONTROL_PLANE=wss://internal-control-plane.local
EOF

# 5. Install service
sudo cp /opt/allternit/bin/allternit-node.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable allternit-node
sudo systemctl start allternit-node
```

### Proxy Configuration

```bash
# Create config with proxy
cat > /etc/allternit/node.env << EOF
Allternit_NODE_ID=proxy-node-1
Allternit_TOKEN=your_token
Allternit_CONTROL_PLANE=wss://control.allternit.io
HTTPS_PROXY=http://proxy.company.com:8080
HTTP_PROXY=http://proxy.company.com:8080
NO_PROXY=localhost,127.0.0.1,.company.local
EOF

# For Docker proxy config
sudo mkdir -p /etc/systemd/system/docker.service.d
sudo cat > /etc/systemd/system/docker.service.d/http-proxy.conf << EOF
[Service]
Environment="HTTPS_PROXY=http://proxy.company.com:8080"
Environment="HTTP_PROXY=http://proxy.company.com:8080"
Environment="NO_PROXY=localhost,127.0.0.1,.company.local"
EOF

sudo systemctl daemon-reload
sudo systemctl restart docker
sudo systemctl restart allternit-node
```

## Security Hardening

### Firewall Rules

```bash
# UFW (Ubuntu)
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow out 443/tcp comment "Allternit Control Plane"
sudo ufw allow out 53/udp comment "DNS"
sudo ufw enable

# firewalld (RHEL/CentOS)
sudo firewall-cmd --permanent --remove-service=ssh
sudo firewall-cmd --permanent --add-port=443/tcp
sudo firewall-cmd --reload
```

### SELinux Policy

```bash
# Create SELinux policy for allternit-node
sudo cat > /etc/selinux/targeted/src/policy/services/allternit-node.te << EOF
policy_module(allternit-node, 1.0)

type allternit_node_t;
type allternit_node_exec_t;
init_daemon_domain(allternit_node_t, allternit_node_exec_t)

allow allternit_node_t self:capability { net_bind_service sys_admin };
allow allternit_node_t docker_var_run_t:sock_file write;
EOF

# Compile and install policy
cd /etc/selinux/targeted/src/policy
make load
```

### Audit Logging

```bash
# Enable audit logging
sudo cat > /etc/audit/rules.d/allternit-node.rules << EOF
-w /etc/allternit/ -p wa -k allternit_config
-w /opt/allternit/ -p wa -k allternit_binary
-w /var/log/allternit/ -p wa -k allternit_logs
EOF

sudo augenrules --load
sudo systemctl restart auditd

# View audit logs
sudo ausearch -k allternit_config
sudo ausearch -k allternit_binary
```

## Monitoring & Observability

### Prometheus Metrics

The node exposes metrics via the control plane:

```prometheus
# Node metrics
allternit_node_status{node_id="node-xxx"}  # 1=online, 0=offline
allternit_node_cpu_percent{node_id="node-xxx"}  # CPU usage
allternit_node_memory_percent{node_id="node-xxx"}  # Memory usage
allternit_node_disk_percent{node_id="node-xxx"}  # Disk usage
allternit_node_running_jobs{node_id="node-xxx"}  # Active jobs
allternit_node_total_jobs{node_id="node-xxx"}  # Total jobs executed
```

### Grafana Dashboard

Import the Allternit dashboard (ID: XXXX) or create custom:

```json
{
  "dashboard": {
    "title": "Allternit Node Status",
    "panels": [
      {
        "title": "Node Status",
        "targets": [
          {
            "expr": "allternit_node_status",
            "legendFormat": "{{node_id}}"
          }
        ]
      },
      {
        "title": "Resource Usage",
        "targets": [
          {
            "expr": "allternit_node_cpu_percent",
            "legendFormat": "CPU - {{node_id}}"
          },
          {
            "expr": "allternit_node_memory_percent",
            "legendFormat": "Memory - {{node_id}}"
          }
        ]
      }
    ]
  }
}
```

### Log Aggregation

#### Fluentd Configuration

```xml
# /etc/fluentd/fluent.conf
<source>
  @type systemd
  filters [{ "_SYSTEMD_UNIT": "allternit-node.service" }]
  <parse>
    @type systemd
  </parse>
  tag allternit.node
</source>

<match allternit.node>
  @type elasticsearch
  host elasticsearch.company.com
  port 9200
  index_name allternit-logs
</match>
```

#### Loki Configuration

```yaml
# promtail config
scrape_configs:
  - job_name: allternit-node
    systemd:
      units:
        - allternit-node.service
    relabel_configs:
      - source_labels: ['__journal__systemd_unit']
        target_label: 'unit'
```

## Troubleshooting

### Diagnostic Commands

```bash
# Check service status
sudo systemctl status allternit-node

# View recent logs
sudo journalctl -u allternit-node -n 100 --no-pager

# Follow logs in real-time
sudo journalctl -u allternit-node -f

# Check Docker connectivity
docker ps
docker run --rm hello-world

# Test network connectivity
curl -I https://control.allternit.io
curl -I wss://control.allternit.io

# Check resource usage
top -p $(pgrep allternit-node)
cat /proc/$(pgrep allternit-node)/status
```

### Common Issues

#### Node Won't Start

```bash
# Check config file
sudo cat /etc/allternit/node.env

# Validate config syntax
source /etc/allternit/node.env && echo "Config valid"

# Check binary
sudo /opt/allternit/bin/allternit-node --version

# Check permissions
ls -la /etc/allternit/node.env
ls -la /opt/allternit/bin/allternit-node
```

#### Docker Issues

```bash
# Check Docker status
sudo systemctl status docker

# Check Docker logs
sudo journalctl -u docker -n 50

# Test Docker
docker run --rm hello-world

# Fix permissions
sudo usermod -aG docker $USER
# Logout and login again
```

#### Connection Issues

```bash
# Test WebSocket connection
websocat wss://control.allternit.io/ws/nodes/test-node

# Check firewall
sudo ufw status
sudo iptables -L -n

# Check DNS
nslookup control.allternit.io
dig control.allternit.io
```

### Performance Tuning

```bash
# Increase file descriptor limit
echo "allternit-node soft nofile 65536" >> /etc/security/limits.conf
echo "allternit-node hard nofile 65536" >> /etc/security/limits.conf

# Adjust systemd limits
sudo systemctl edit allternit-node
# Add:
# [Service]
# LimitNOFILE=131072
# LimitNPROC=8192

# Reload and restart
sudo systemctl daemon-reload
sudo systemctl restart allternit-node
```

## Support

For additional help:

- **Documentation**: https://docs.allternit.io
- **Discord**: https://discord.gg/allternit
- **GitHub Issues**: https://github.com/allternit/node/issues
- **Email**: support@allternit.io
