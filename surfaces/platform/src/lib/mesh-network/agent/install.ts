/**
 * Allternit Mesh Agent - Installation Script Generator
 * 
 * One-command installation for user VPS:
 * curl -fsSL https://install.allternit.com | bash
 * 
 * This script generates a shell installer from TypeScript configuration.
 */

import type { MeshProvider, VPSRegistrationResponse } from '../types';

// ============================================================================
// Binary URLs (from CDN)
// ============================================================================

const CDN_BASE = 'https://cdn.allternit.com/agent';

const BINARY_URLS = {
  linux: {
    amd64: `${CDN_BASE}/latest/allternit-agent-linux-amd64`,
    arm64: `${CDN_BASE}/latest/allternit-agent-linux-arm64`,
    arm: `${CDN_BASE}/latest/allternit-agent-linux-arm`,
  },
  freebsd: {
    amd64: `${CDN_BASE}/latest/allternit-agent-freebsd-amd64`,
  },
  openbsd: {
    amd64: `${CDN_BASE}/latest/allternit-agent-openbsd-amd64`,
  },
};

// ============================================================================
// Shell Script Generator
// ============================================================================

export function generateInstallScript(
  registrationResponse: VPSRegistrationResponse,
  provider: MeshProvider
): string {
  const { agentId, setupToken } = registrationResponse;
  
  return `#!/bin/bash
#
# Allternit Mesh Agent Installer
# Generated: ${new Date().toISOString()}
# Agent ID: ${agentId}
# Provider: ${provider}
#
# This script installs the Allternit agent on your VPS.
# It will NOT modify your SSH configuration or firewall rules.
# You retain full root access and can uninstall at any time.
#
# Install: curl -fsSL https://install.allternit.com/${agentId} | bash
# Uninstall: sudo /opt/allternit-agent/uninstall.sh
#

set -e

# Colors for output
RED='\\033[0;31m'
GREEN='\\033[0;32m'
YELLOW='\\033[1;33m'
BLUE='\\033[0;34m'
NC='\\033[0m'

# Logging
log_info() { echo -e "${GREEN}[INFO]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }
log_step() { echo -e "${BLUE}[STEP]${NC} $1"; }

# Check root
if [ "$EUID" -ne 0 ]; then 
  log_error "Please run as root (use sudo)"
  exit 1
fi

# Detect system
detect_system() {
  OS=$(uname -s | tr '[:upper:]' '[:lower:]')
  ARCH=$(uname -m)
  
  case $ARCH in
    x86_64) ARCH="amd64" ;;
    aarch64) ARCH="arm64" ;;
    armv7l) ARCH="arm" ;;
  esac
  
  log_info "Detected system: $OS $ARCH"
  
  # Validate OS
  if [[ "$OS" != "linux" && "$OS" != "freebsd" && "$OS" != "openbsd" ]]; then
    log_error "Unsupported OS: $OS"
    exit 1
  fi
}

# Install dependencies
install_deps() {
  log_step "Installing dependencies..."
  
  if command -v apt-get &> /dev/null; then
    export DEBIAN_FRONTEND=noninteractive
    apt-get update -qq
    apt-get install -y -qq curl wireguard-tools 2>/dev/null || {
      log_warn "wireguard-tools not in apt, trying wireguard..."
      apt-get install -y -qq curl wireguard
    }
  elif command -v yum &> /dev/null; then
    yum install -y -q curl wireguard-tools
  elif command -v dnf &> /dev/null; then
    dnf install -y -q curl wireguard-tools
  elif command -v pacman &> /dev/null; then
    pacman -S --noconfirm --quiet curl wireguard-tools
  elif command -v apk &> /dev/null; then
    apk add --no-cache curl wireguard-tools-wg
  elif command -v pkg &> /dev/null; then
    # FreeBSD
    pkg install -y curl wireguard
  else
    log_warn "Unknown package manager. Please install manually: curl, wireguard-tools"
  fi
  
  log_info "Dependencies installed"
}

# Create unprivileged user
create_user() {
  log_step "Creating allternit user..."
  
  if ! id "allternit" &>/dev/null; then
    useradd -r -s /bin/false -d /opt/allternit-agent -M allternit
    log_info "User created"
  else
    log_info "User already exists"
  fi
}

# Create directories
create_dirs() {
  log_step "Creating directories..."
  
  mkdir -p /opt/allternit-agent
  mkdir -p /etc/allternit
  mkdir -p /var/log/allternit
  
  chown allternit:allternit /var/log/allternit
  chmod 755 /opt/allternit-agent
  chmod 700 /etc/allternit
  
  log_info "Directories created"
}

# Download agent
download_agent() {
  log_step "Downloading agent..."
  
  # Determine download URL
  local binary_url="${CDN_BASE}/latest/allternit-agent-$OS-$ARCH"
  
  log_info "Downloading from: $binary_url"
  
  if ! curl -fsSL --progress-bar -o /opt/allternit-agent/agent "$binary_url"; then
    log_error "Failed to download agent"
    exit 1
  fi
  
  chmod +x /opt/allternit-agent/agent
  chown allternit:allternit /opt/allternit-agent/agent
  
  log_info "Agent downloaded"
}

# Create configuration
create_config() {
  log_step "Creating configuration..."
  
  cat > /etc/allternit/agent.json << CONFIGEOF
{
  "agentId": "${agentId}",
  "setupToken": "${setupToken}",
  "provider": "${provider}",
  "version": "latest",
  "autoUpdate": true,
  "updateChannel": "stable",
  "healthCheckInterval": 30000,
  "listenPort": 0,
  "serverUrl": "https://mesh.allternit.com"
}
CONFIGEOF

  chmod 600 /etc/allternit/agent.json
  chown allternit:allternit /etc/allternit/agent.json
  
  log_info "Configuration created"
}

# Create systemd service
create_service() {
  log_step "Creating systemd service..."
  
  cat > /etc/systemd/system/allternit-agent.service << 'SERVICEEOF'
[Unit]
Description=Allternit Mesh Agent
Documentation=https://docs.allternit.com/agent
After=network-online.target
Wants=network-online.target

[Service]
Type=notify
NotifyAccess=all
ExecStart=/opt/allternit-agent/agent
ExecReload=/bin/kill -HUP $MAINPID
Restart=always
RestartSec=5
StartLimitInterval=60s
StartLimitBurst=3

User=allternit
Group=allternit
WorkingDirectory=/opt/allternit-agent

# Resource limits
LimitNOFILE=65536
LimitNPROC=4096

# Security hardening (but not too restrictive for mesh networking)
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=/var/log/allternit /tmp /var/run
AmbientCapabilities=CAP_NET_ADMIN CAP_NET_BIND_SERVICE

# Environment
Environment="AGENT_CONFIG=/etc/allternit/agent.json"
Environment="AGENT_LOG_LEVEL=info"
Environment="AGENT_LOG_PATH=/var/log/allternit"

[Install]
WantedBy=multi-user.target
SERVICEEOF

  # Create auto-update timer (daily)
  cat > /etc/systemd/system/allternit-agent-update.service << 'UPDATEEOF'
[Unit]
Description=Allternit Agent Auto-Update
After=network-online.target

[Service]
Type=oneshot
ExecStart=/opt/allternit-agent/agent --update
User=allternit
SERVICEEOF

  cat > /etc/systemd/system/allternit-agent-update.timer << 'TIMEREEOF'
[Unit]
Description=Run Allternit Agent update daily

[Timer]
OnCalendar=daily
RandomizedDelaySec=1h
Persistent=true

[Install]
WantedBy=timers.target
TIMEREEOF

  systemctl daemon-reload
  systemctl enable allternit-agent
  systemctl enable allternit-agent-update.timer
  
  log_info "Service created"
}

# Create uninstaller
create_uninstaller() {
  log_step "Creating uninstaller..."
  
  cat > /opt/allternit-agent/uninstall.sh << 'UNINSTALLEOF'
#!/bin/bash
# Allternit Agent Uninstaller

set -e

RED='\\033[0;31m'
GREEN='\\033[0;32m'
NC='\\033[0m'

echo -e "${RED}Uninstalling Allternit Agent...${NC}"

# Stop services
systemctl stop allternit-agent 2>/dev/null || true
systemctl disable allternit-agent 2>/dev/null || true
systemctl disable allternit-agent-update.timer 2>/dev/null || true

# Remove systemd files
rm -f /etc/systemd/system/allternit-agent.service
rm -f /etc/systemd/system/allternit-agent-update.service
rm -f /etc/systemd/system/allternit-agent-update.timer

# Remove files
rm -rf /opt/allternit-agent
rm -rf /etc/allternit
rm -f /etc/wireguard/allternit.conf

# Reload systemd
systemctl daemon-reload

echo -e "${GREEN}Allternit Agent uninstalled.${NC}"
echo ""
echo "Note: Your VPS is unchanged. SSH access still works normally."
UNINSTALLEOF

  chmod +x /opt/allternit-agent/uninstall.sh
  
  log_info "Uninstaller created"
}

# Start agent
start_agent() {
  log_step "Starting agent..."
  
  systemctl start allternit-agent
  
  sleep 3
  
  if systemctl is-active --quiet allternit-agent; then
    log_info "Agent started successfully!"
  else
    log_error "Agent failed to start"
    log_info "Check logs: sudo journalctl -u allternit-agent -n 50"
    exit 1
  fi
}

# Verify connectivity
verify_connectivity() {
  log_step "Verifying connectivity..."
  
  # Wait a bit for connection
  sleep 5
  
  # Check if agent is responding
  if /opt/allternit-agent/agent --status > /dev/null 2>&1; then
    log_info "Agent is online and connected!"
  else
    log_warn "Agent started but connectivity not yet confirmed"
    log_info "Check status with: sudo /opt/allternit-agent/agent --status"
  fi
}

# Print completion message
print_completion() {
  echo ""
  echo "=============================================="
  echo -e "${GREEN}Installation Complete!${NC}"
  echo "=============================================="
  echo ""
  echo "Agent ID: ${agentId}"
  echo "Provider: ${provider}"
  echo ""
  echo "Management Commands:"
  echo "  Status:    sudo systemctl status allternit-agent"
  echo "  Logs:      sudo journalctl -u allternit-agent -f"
  echo "  Stop:      sudo systemctl stop allternit-agent"
  echo "  Restart:   sudo systemctl restart allternit-agent"
  echo "  Update:    sudo /opt/allternit-agent/agent --update"
  echo "  Uninstall: sudo /opt/allternit-agent/uninstall.sh"
  echo ""
  echo "Your VPS is unchanged. SSH access works normally."
  echo "The agent runs as unprivileged user 'allternit'."
  echo ""
  echo "Need help? https://docs.allternit.com/agent"
  echo "=============================================="
}

# Main
main() {
  echo "=============================================="
  echo "Allternit Mesh Agent Installer"
  echo "=============================================="
  echo ""
  
  detect_system
  install_deps
  create_user
  create_dirs
  download_agent
  create_config
  create_service
  create_uninstaller
  start_agent
  verify_connectivity
  print_completion
}

main "$@"
`;
}

// ============================================================================
// Docker Compose Generator (for Headscale server)
// ============================================================================

export function generateHeadscaleDockerCompose(): string {
  return `version: '3.8'

services:
  headscale:
    image: headscale/headscale:latest
    container_name: headscale
    restart: unless-stopped
    command: serve
    ports:
      - "8080:8080"    # HTTP API
      - "9090:9090"    # Metrics
    volumes:
      - ./config:/etc/headscale
      - ./data:/var/lib/headscale
    environment:
      - HEADSCALE_LOG_LEVEL=info
    healthcheck:
      test: ["CMD", "wget", "--spider", "-q", "http://localhost:8080/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 10s
    networks:
      - headscale

  # Optional: Web UI for Headscale
  headscale-ui:
    image: ghcr.io/gurucomputing/headscale-ui:latest
    container_name: headscale-ui
    restart: unless-stopped
    ports:
      - "8081:80"
    environment:
      - HS_SERVER=http://headscale:8080
    depends_on:
      - headscale
    networks:
      - headscale

networks:
  headscale:
    driver: bridge
`;
}

export function generateHeadscaleConfig(): string {
  return `server_url: http://localhost:8080
listen_addr: 0.0.0.0:8080
metrics_listen_addr: 0.0.0.0:9090
grpc_listen_addr: 127.0.0.1:50443

# TLS (disable if behind reverse proxy)
tls_cert_path: ""
tls_key_path: ""

# Private key for generating node keys
private_key_path: /var/lib/headscale/private.key

# Noise private key
noise:
  private_key_path: /var/lib/headscale/noise_private.key

# List of IP prefixes to allocate tailnet addresses from
ip_prefixes:
  - fd7a:115c:a1e0::/48
  - 100.64.0.0/10

# DERP (NAT traversal) configuration
derp:
  server:
    enabled: true
    region_id: 999
    region_code: "headscale"
    region_name: "Headscale Embedded DERP"
    stun_listen_addr: "0.0.0.0:3478"
    private_key_path: /var/lib/headscale/derp_server_private.key
    automatically_add_embedded_derp_region: true
    http_port: -1
    stun_port: 3478
  
  urls:
    - https://controlplane.tailscale.com/derpmap/default
  
  paths: []
  auto_update_enabled: true
  update_frequency: 24h

# Disables DNS configuration
dns_config:
  override_local_dns: true
  nameservers:
    - 1.1.1.1
    - 8.8.8.8
  domains: []
  magic_dns: true
  base_domain: allternit.local

# Database configuration
database:
  type: sqlite
  sqlite:
    path: /var/lib/headscale/db.sqlite

# Log configuration
log:
  format: text
  level: info

# Policy ACL
acl_policy_path: ""

# User management
user:
  - name: allternit
`;
}
