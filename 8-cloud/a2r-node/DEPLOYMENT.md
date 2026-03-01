# A2R Node Deployment Guide

This guide covers deploying the A2R Node Agent in various environments and configurations.

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
  --name a2r-node-1 \
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
  - curl -s https://a2r.io/install.sh | A2R_TOKEN=your_token bash
```

### DigitalOcean

```bash
# Create droplet via doctl
doctl compute droplet create a2r-node-1 \
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
gcloud compute instances create a2r-node-1 \
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

# Install A2R Node
curl -s https://a2r.io/install.sh | A2R_TOKEN=your_token bash

# Verify installation
sudo systemctl status a2r-node
docker ps
```

### macOS

```bash
# Install Docker Desktop
# Download from: https://docs.docker.com/desktop/install/mac-install/

# Install A2R Node
sudo curl -s https://a2r.io/install.sh | A2R_TOKEN=your_token bash

# Verify installation
launchctl list | grep a2r
docker ps
```

### Windows

```powershell
# Install Docker Desktop
# Download from: https://docs.docker.com/desktop/install/windows-install/

# Install A2R Node (Run as Administrator)
.\install-windows.ps1 -Token "your_token"

# Verify installation
Get-Service a2r-node
docker ps
```

## Enterprise Deployment

### High Availability Setup

Deploy multiple nodes for redundancy:

```bash
# Deploy 3 nodes across different zones
for i in 1 2 3; do
  curl -s https://a2r.io/install.sh | \
    A2R_TOKEN=your_token \
    A2R_NODE_ID=prod-node-$i \
    A2R_LABELS=production,zone-$i \
    bash
done
```

### Air-Gapped Environment

```bash
# 1. Download binary on connected machine
curl -L https://github.com/a2r/node/releases/latest/download/a2r-node-linux-x86_64 \
  -o a2r-node

# 2. Transfer to air-gapped machine
scp a2r-node user@airgapped-host:/tmp/

# 3. Install manually
sudo mkdir -p /opt/a2r/bin
sudo mv /tmp/a2r-node /opt/a2r/bin/
sudo chmod +x /opt/a2r/bin/a2r-node

# 4. Create config
sudo mkdir -p /etc/a2r
sudo cat > /etc/a2r/node.env << EOF
A2R_NODE_ID=airgap-node-1
A2R_TOKEN=your_token
A2R_CONTROL_PLANE=wss://internal-control-plane.local
EOF

# 5. Install service
sudo cp /opt/a2r/bin/a2r-node.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable a2r-node
sudo systemctl start a2r-node
```

### Proxy Configuration

```bash
# Create config with proxy
cat > /etc/a2r/node.env << EOF
A2R_NODE_ID=proxy-node-1
A2R_TOKEN=your_token
A2R_CONTROL_PLANE=wss://control.a2r.io
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
sudo systemctl restart a2r-node
```

## Security Hardening

### Firewall Rules

```bash
# UFW (Ubuntu)
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow out 443/tcp comment "A2R Control Plane"
sudo ufw allow out 53/udp comment "DNS"
sudo ufw enable

# firewalld (RHEL/CentOS)
sudo firewall-cmd --permanent --remove-service=ssh
sudo firewall-cmd --permanent --add-port=443/tcp
sudo firewall-cmd --reload
```

### SELinux Policy

```bash
# Create SELinux policy for a2r-node
sudo cat > /etc/selinux/targeted/src/policy/services/a2r-node.te << EOF
policy_module(a2r-node, 1.0)

type a2r_node_t;
type a2r_node_exec_t;
init_daemon_domain(a2r_node_t, a2r_node_exec_t)

allow a2r_node_t self:capability { net_bind_service sys_admin };
allow a2r_node_t docker_var_run_t:sock_file write;
EOF

# Compile and install policy
cd /etc/selinux/targeted/src/policy
make load
```

### Audit Logging

```bash
# Enable audit logging
sudo cat > /etc/audit/rules.d/a2r-node.rules << EOF
-w /etc/a2r/ -p wa -k a2r_config
-w /opt/a2r/ -p wa -k a2r_binary
-w /var/log/a2r/ -p wa -k a2r_logs
EOF

sudo augenrules --load
sudo systemctl restart auditd

# View audit logs
sudo ausearch -k a2r_config
sudo ausearch -k a2r_binary
```

## Monitoring & Observability

### Prometheus Metrics

The node exposes metrics via the control plane:

```prometheus
# Node metrics
a2r_node_status{node_id="node-xxx"}  # 1=online, 0=offline
a2r_node_cpu_percent{node_id="node-xxx"}  # CPU usage
a2r_node_memory_percent{node_id="node-xxx"}  # Memory usage
a2r_node_disk_percent{node_id="node-xxx"}  # Disk usage
a2r_node_running_jobs{node_id="node-xxx"}  # Active jobs
a2r_node_total_jobs{node_id="node-xxx"}  # Total jobs executed
```

### Grafana Dashboard

Import the A2R dashboard (ID: XXXX) or create custom:

```json
{
  "dashboard": {
    "title": "A2R Node Status",
    "panels": [
      {
        "title": "Node Status",
        "targets": [
          {
            "expr": "a2r_node_status",
            "legendFormat": "{{node_id}}"
          }
        ]
      },
      {
        "title": "Resource Usage",
        "targets": [
          {
            "expr": "a2r_node_cpu_percent",
            "legendFormat": "CPU - {{node_id}}"
          },
          {
            "expr": "a2r_node_memory_percent",
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
  filters [{ "_SYSTEMD_UNIT": "a2r-node.service" }]
  <parse>
    @type systemd
  </parse>
  tag a2r.node
</source>

<match a2r.node>
  @type elasticsearch
  host elasticsearch.company.com
  port 9200
  index_name a2r-logs
</match>
```

#### Loki Configuration

```yaml
# promtail config
scrape_configs:
  - job_name: a2r-node
    systemd:
      units:
        - a2r-node.service
    relabel_configs:
      - source_labels: ['__journal__systemd_unit']
        target_label: 'unit'
```

## Troubleshooting

### Diagnostic Commands

```bash
# Check service status
sudo systemctl status a2r-node

# View recent logs
sudo journalctl -u a2r-node -n 100 --no-pager

# Follow logs in real-time
sudo journalctl -u a2r-node -f

# Check Docker connectivity
docker ps
docker run --rm hello-world

# Test network connectivity
curl -I https://control.a2r.io
curl -I wss://control.a2r.io

# Check resource usage
top -p $(pgrep a2r-node)
cat /proc/$(pgrep a2r-node)/status
```

### Common Issues

#### Node Won't Start

```bash
# Check config file
sudo cat /etc/a2r/node.env

# Validate config syntax
source /etc/a2r/node.env && echo "Config valid"

# Check binary
sudo /opt/a2r/bin/a2r-node --version

# Check permissions
ls -la /etc/a2r/node.env
ls -la /opt/a2r/bin/a2r-node
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
websocat wss://control.a2r.io/ws/nodes/test-node

# Check firewall
sudo ufw status
sudo iptables -L -n

# Check DNS
nslookup control.a2r.io
dig control.a2r.io
```

### Performance Tuning

```bash
# Increase file descriptor limit
echo "a2r-node soft nofile 65536" >> /etc/security/limits.conf
echo "a2r-node hard nofile 65536" >> /etc/security/limits.conf

# Adjust systemd limits
sudo systemctl edit a2r-node
# Add:
# [Service]
# LimitNOFILE=131072
# LimitNPROC=8192

# Reload and restart
sudo systemctl daemon-reload
sudo systemctl restart a2r-node
```

## Support

For additional help:

- **Documentation**: https://docs.a2r.io
- **Discord**: https://discord.gg/a2r
- **GitHub Issues**: https://github.com/a2r/node/issues
- **Email**: support@a2r.io
