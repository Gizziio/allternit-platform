/**
 * Headscale Server Installation (Non-Docker)
 * 
 * One-command install for user-hosted Headscale server:
 * curl -fsSL https://install.allternit.com/headscale | bash
 * 
 * Deploys Headscale as systemd service with SQLite database.
 */

import type { HeadscaleServerConfig } from '../types';

export interface HeadscaleInstallOptions {
  domain: string;
  port?: number;
  dataDir?: string;
  user?: string;
  withWebUI?: boolean;
}

/**
 * Generate Headscale server install script (no Docker)
 */
export function generateHeadscaleServerScript(options: HeadscaleInstallOptions): string {
  const { domain, port = 8080, dataDir = '/var/lib/headscale', user = 'headscale', withWebUI = true } = options;
  
  return `#!/bin/bash
#
# Headscale Server Installer for Allternit Mesh Network
# Non-Docker deployment with systemd
#
# Install: curl -fsSL https://install.allternit.com/headscale | bash
#

set -e

RED='\\033[0;31m'
GREEN='\\033[0;32m'
YELLOW='\\033[1;33m'
BLUE='\\033[0;34m'
NC='\\033[0m'

log_info() { echo -e "\${GREEN}[INFO]\${NC} $1"; }
log_warn() { echo -e "\${YELLOW}[WARN]\${NC} $1"; }
log_error() { echo -e "\${RED}[ERROR]\${NC} $1"; }
log_step() { echo -e "\${BLUE}[STEP]\${NC} $1"; }

# Configuration
DOMAIN="${domain}"
PORT="${port}"
DATA_DIR="${dataDir}"
USER="${user}"
VERSION="0.23.0"

# Check root
if [ "$EUID" -ne 0 ]; then 
  log_error "Please run as root (use sudo)"
  exit 1
fi

log_info "Headscale Server Installer for Allternit"
log_info "Domain: $DOMAIN"
log_info "Port: $PORT"
echo ""

# Detect system
detect_system() {
  OS=$(uname -s | tr '[:upper:]' '[:lower:]')
  ARCH=$(uname -m)
  
  case $ARCH in
    x86_64) ARCH="amd64" ;;
    aarch64) ARCH="arm64" ;;
    armv7l) ARCH="arm" ;;
  esac
  
  log_info "System: $OS $ARCH"
}

# Install dependencies
install_deps() {
  log_step "Installing dependencies..."
  
  if command -v apt-get &> /dev/null; then
    export DEBIAN_FRONTEND=noninteractive
    apt-get update -qq
    apt-get install -y -qq curl wget sqlite3 wireguard-tools nginx certbot python3-certbot-nginx 2>/dev/null || {
      apt-get install -y -qq curl wget sqlite3 wireguard-tools nginx
    }
  elif command -v yum &> /dev/null; then
    yum install -y -q curl wget sqlite wireguard-tools nginx
  elif command -v dnf &> /dev/null; then
    dnf install -y -q curl wget sqlite wireguard-tools nginx
  elif command -v pacman &> /dev/null; then
    pacman -S --noconfirm --quiet curl wget sqlite wireguard-tools nginx
  else
    log_warn "Unknown package manager. Installing minimal dependencies..."
  fi
  
  log_info "Dependencies installed"
}

# Create headscale user
create_user() {
  log_step "Creating headscale user..."
  
  if ! id "$USER" &>/dev/null; then
    useradd -r -s /bin/false -d "$DATA_DIR" -m "$USER"
    log_info "User $USER created"
  else
    log_info "User $USER already exists"
  fi
}

# Create directories
create_dirs() {
  log_step "Creating directories..."
  
  mkdir -p "$DATA_DIR"
  mkdir -p /etc/headscale
  mkdir -p /var/log/headscale
  
  chown -R $USER:$USER "$DATA_DIR"
  chown -R $USER:$USER /var/log/headscale
  chmod 700 "$DATA_DIR"
  chmod 755 /etc/headscale
  
  log_info "Directories created"
}

# Download headscale binary
download_headscale() {
  log_step "Downloading Headscale..."
  
  DOWNLOAD_URL="https://github.com/juanfont/headscale/releases/download/v\${VERSION}/headscale_\${VERSION}_linux_\${ARCH}"
  
  log_info "Downloading from GitHub..."
  
  if ! curl -fsSL -o /usr/local/bin/headscale "$DOWNLOAD_URL"; then
    log_error "Failed to download Headscale"
    exit 1
  fi
  
  chmod +x /usr/local/bin/headscale
  
  # Verify installation
  if headscale version > /dev/null 2>&1; then
    INSTALLED_VERSION=$(headscale version | head -1)
    log_info "Headscale installed: $INSTALLED_VERSION"
  else
    log_error "Headscale binary verification failed"
    exit 1
  fi
}

# Initialize database
init_database() {
  log_step "Initializing database..."
  
  # Create initial namespace
  sudo -u $USER headscale namespaces create allternit || true
  
  log_info "Database initialized"
}

# Create configuration
create_config() {
  log_step "Creating configuration..."
  
  cat > /etc/headscale/config.yaml << CONFIGEOF
server_url: https://\${DOMAIN}
listen_addr: 127.0.0.1:\${PORT}
metrics_listen_addr: 127.0.0.1:9090
grpc_listen_addr: 127.0.0.1:50443

# Disable built-in TLS (using nginx reverse proxy)
tls_cert_path: ""
tls_key_path: ""

# Private key paths
private_key_path: \${DATA_DIR}/private.key
noise:
  private_key_path: \${DATA_DIR}/noise_private.key

# IP prefixes for mesh network
ip_prefixes:
  - fd7a:115c:a1e0::/48
  - 100.64.0.0/10

# DERP configuration (NAT traversal)
derp:
  server:
    enabled: true
    region_id: 999
    region_code: "headscale"
    region_name: "Headscale DERP"
    stun_listen_addr: "0.0.0.0:3478"
    automatically_add_embedded_derp_region: true
    private_key_path: \${DATA_DIR}/derp_server_private.key
    http_port: -1
    stun_port: 3478
  
  urls:
    - https://controlplane.tailscale.com/derpmap/default
  
  auto_update_enabled: true
  update_frequency: 24h

# DNS configuration
dns_config:
  override_local_dns: true
  nameservers:
    - 1.1.1.1
    - 8.8.8.8
  magic_dns: true
  base_domain: allternit.local

# Database (SQLite)
database:
  type: sqlite
  sqlite:
    path: \${DATA_DIR}/db.sqlite

# Logging
log:
  format: text
  level: info

# ACL policy (permissive for Allternit)
acl_policy_path: ""

# Default user namespace
user:
  - name: allternit
CONFIGEOF

  chown $USER:$USER /etc/headscale/config.yaml
  chmod 600 /etc/headscale/config.yaml
  
  log_info "Configuration created"
}

# Create systemd service
create_service() {
  log_step "Creating systemd service..."
  
  cat > /etc/systemd/system/headscale.service << SERVICEEOF
[Unit]
Description=Headscale - Self-hosted Tailscale control server
Documentation=https://headscale.net/
After=network.target network-online.target
Wants=network-online.target

[Service]
Type=simple
User=$USER
Group=$USER
ExecStart=/usr/local/bin/headscale serve
Restart=always
RestartSec=5
WorkingDirectory=$DATA_DIR

# Resource limits
LimitNOFILE=65536
LimitNPROC=4096

# Security hardening
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=$DATA_DIR /var/log/headscale
AmbientCapabilities=CAP_NET_BIND_SERVICE

[Install]
WantedBy=multi-user.target
SERVICEEOF

  systemctl daemon-reload
  systemctl enable headscale
  
  log_info "Service created"
}

# Setup nginx reverse proxy
setup_nginx() {
  log_step "Configuring nginx..."
  
  cat > /etc/nginx/sites-available/headscale << NGINXEOF
server {
    listen 80;
    server_name \${DOMAIN};
    
    location / {
        proxy_pass http://127.0.0.1:\${PORT};
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
        proxy_read_timeout 86400;
    }
}
NGINXEOF

  # Enable site
  ln -sf /etc/nginx/sites-available/headscale /etc/nginx/sites-enabled/
  rm -f /etc/nginx/sites-enabled/default
  
  # Test nginx config
  nginx -t
  
  # Reload nginx
  systemctl reload nginx
  
  log_info "Nginx configured"
}

# Setup SSL with Let's Encrypt
setup_ssl() {
  log_step "Setting up SSL with Let's Encrypt..."
  
  if command -v certbot &> /dev/null; then
    certbot --nginx -d \${DOMAIN} --non-interactive --agree-tos --email admin@\${DOMAIN} || {
      log_warn "SSL setup failed. You can run 'certbot --nginx' manually later."
    }
  else
    log_warn "certbot not available. SSL not configured."
    log_info "To enable SSL later, install certbot and run:"
    log_info "  certbot --nginx -d \${DOMAIN}"
  fi
}

# Create API key
create_api_key() {
  log_step "Creating API key..."
  
  # Wait for service to be ready
  sleep 2
  
  # Create API key
  API_KEY=$(sudo -u $USER headscale apikeys create --expiration 90d 2>/dev/null | grep -o '[a-zA-Z0-9]\{48\}' || echo "")
  
  if [ -n "$API_KEY" ]; then
    echo "$API_KEY" > /etc/headscale/api.key
    chmod 600 /etc/headscale/api.key
    log_info "API key created"
  else
    log_warn "API key creation may have failed. Check with: sudo headscale apikeys list"
  fi
}

# Start service
start_service() {
  log_step "Starting Headscale..."
  
  systemctl start headscale
  
  sleep 3
  
  if systemctl is-active --quiet headscale; then
    log_info "Headscale started successfully!"
  else
    log_error "Headscale failed to start"
    log_info "Check logs: journalctl -u headscale -n 50"
    exit 1
  fi
}

# Create uninstall script
create_uninstaller() {
  log_step "Creating uninstaller..."
  
  cat > /usr/local/bin/headscale-uninstall << UNINSTALLEOF
#!/bin/bash
# Headscale Uninstaller

echo "Uninstalling Headscale..."

# Stop and disable service
systemctl stop headscale 2>/dev/null || true
systemctl disable headscale 2>/dev/null || true

# Remove files
rm -f /etc/systemd/system/headscale.service
rm -f /usr/local/bin/headscale
rm -f /usr/local/bin/headscale-uninstall
rm -rf /etc/headscale

# Optionally remove data
read -p "Remove data directory ($DATA_DIR)? [y/N] " -n 1 -r
echo
if [[ \$REPLY =~ ^[Yy]$ ]]; then
  rm -rf $DATA_DIR
  userdel $USER 2>/dev/null || true
fi

# Remove nginx config
rm -f /etc/nginx/sites-available/headscale
rm -f /etc/nginx/sites-enabled/headscale
systemctl reload nginx

systemctl daemon-reload

echo "Headscale uninstalled."
UNINSTALLEOF

  chmod +x /usr/local/bin/headscale-uninstall
  
  log_info "Uninstaller created"
}

# Print completion
print_completion() {
  echo ""
  echo "=============================================="
  echo -e "\${GREEN}Headscale Server Installed!\${NC}"
  echo "=============================================="
  echo ""
  echo "Server URL: https://\${DOMAIN}"
  echo "Status: sudo systemctl status headscale"
  echo "Logs: sudo journalctl -u headscale -f"
  echo ""
  echo "Next Steps:"
  echo "1. Ensure DNS \${DOMAIN} points to this server"
  echo "2. Get API key: sudo headscale apikeys list"
  echo "3. In Allternit: Settings → Infrastructure → Mesh Network"
  echo "4. Enter your server URL and API key"
  echo ""
  echo "Uninstall: sudo headscale-uninstall"
  echo "=============================================="
}

# Main
main() {
  detect_system
  install_deps
  create_user
  create_dirs
  download_headscale
  create_config
  create_service
  setup_nginx
  setup_ssl
  init_database
  start_service
  create_api_key
  create_uninstaller
  print_completion
}

main "$@"
`;
}

/**
 * Generate update script for Headscale server
 */
export function generateHeadscaleUpdateScript(): string {
  return `#!/bin/bash
#
# Headscale Server Updater
#

set -e

VERSION="\${1:-latest}"
USER="headscale"
DATA_DIR="/var/lib/headscale"

if [ "$EUID" -ne 0 ]; then 
  echo "Please run as root (use sudo)"
  exit 1
fi

ARCH=$(uname -m)
case $ARCH in
  x86_64) ARCH="amd64" ;;
  aarch64) ARCH="arm64" ;;
  armv7l) ARCH="arm" ;;
esac

echo "Updating Headscale to $VERSION..."

# Backup current binary
cp /usr/local/bin/headscale /usr/local/bin/headscale.backup

# Download new version
if [ "$VERSION" = "latest" ]; then
  DOWNLOAD_URL=$(curl -s https://api.github.com/repos/juanfont/headscale/releases/latest | grep "browser_download_url.*linux_\${ARCH}" | cut -d '"' -f 4)
else
  DOWNLOAD_URL="https://github.com/juanfont/headscale/releases/download/v\${VERSION}/headscale_\${VERSION}_linux_\${ARCH}"
fi

curl -fsSL -o /usr/local/bin/headscale "$DOWNLOAD_URL"
chmod +x /usr/local/bin/headscale

# Stop service
systemctl stop headscale

# Run migrations
sudo -u $USER headscale migrate

# Start service
systemctl start headscale

# Verify
if systemctl is-active --quiet headscale; then
  echo "Update successful!"
  headscale version
  rm -f /usr/local/bin/headscale.backup
else
  echo "Update failed, restoring backup..."
  mv /usr/local/bin/headscale.backup /usr/local/bin/headscale
  systemctl start headscale
  exit 1
fi
`;
}
