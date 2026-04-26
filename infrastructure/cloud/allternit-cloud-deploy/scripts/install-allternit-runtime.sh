#!/bin/bash
set -e

# Allternit Runtime Installation Script
# Installs Allternit agent on fresh VPS (Ubuntu/Debian)

echo "=== Allternit Runtime Installation ==="
echo ""

# Configuration (passed via environment)
Allternit_VERSION="${Allternit_VERSION:-latest}"
CONTROL_PLANE_URL="${CONTROL_PLANE_URL:-wss://console.allternit.sh}"
DEPLOYMENT_TOKEN="${DEPLOYMENT_TOKEN:-}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

log_info() {
    echo -e "${GREEN}✓${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}⚠${NC} $1"
}

log_error() {
    echo -e "${RED}✗${NC} $1"
}

# Check if running as root
if [ "$EUID" -ne 0 ]; then
    log_error "Please run as root (use sudo)"
    exit 1
fi

# Detect OS
if [ -f /etc/os-release ]; then
    . /etc/os-release
    OS=$ID
    VERSION=$VERSION_ID
else
    log_error "Cannot detect OS"
    exit 1
fi

log_info "Detected OS: $OS $VERSION"

# Check supported OS
case $OS in
    ubuntu)
        if [ "$VERSION" != "20.04" ] && [ "$VERSION" != "22.04" ] && [ "$VERSION" != "24.04" ]; then
            log_warn "Ubuntu $VERSION may not be fully supported (tested: 20.04, 22.04, 24.04)"
        fi
        ;;
    debian)
        if [ "$VERSION" != "11" ] && [ "$VERSION" != "12" ]; then
            log_warn "Debian $VERSION may not be fully supported (tested: 11, 12)"
        fi
        ;;
    *)
        log_error "Unsupported OS: $OS (supported: ubuntu, debian)"
        exit 1
        ;;
esac

# 1. Create Allternit user
log_info "Creating allternit user..."
if ! id -u allternit >/dev/null 2>&1; then
    useradd -r -s /bin/false allternit
    log_info "Created allternit user"
else
    log_info "allternit user already exists"
fi

# 2. Create directories
log_info "Creating directories..."
mkdir -p /opt/allternit/bin
mkdir -p /opt/allternit/config
mkdir -p /var/log/allternit
chown -R allternit:allternit /opt/allternit
chown -R allternit:allternit /var/log/allternit
log_info "Created directories"

# 3. Install dependencies
log_info "Installing dependencies..."
apt-get update -qq
apt-get install -y -qq curl systemd >/dev/null 2>&1
log_info "Installed dependencies"

# 4. Download Allternit runtime
log_info "Downloading Allternit runtime..."
RELEASE_URL="https://releases.allternit.sh/${Allternit_VERSION}/allternit-agent-x86_64-unknown-linux-gnu.tar.gz"

if ! curl -sLf "$RELEASE_URL" | tar xz -C /opt/allternit/bin --strip-components=1; then
    log_error "Failed to download Allternit runtime from $RELEASE_URL"
    log_warn "Make sure the release URL is accessible"
    exit 1
fi

chmod +x /opt/allternit/bin/allternit-agent
log_info "Downloaded Allternit runtime"

# 5. Create systemd service
log_info "Creating systemd service..."
cat > /etc/systemd/system/allternit-agent.service << EOF
[Unit]
Description=Allternit Agent
After=network.target

[Service]
Type=simple
ExecStart=/opt/allternit/bin/allternit-agent --control-plane=${CONTROL_PLANE_URL} --token=${DEPLOYMENT_TOKEN}
Restart=always
RestartSec=5
User=allternit
Group=allternit
Environment=RUST_LOG=info

# Security hardening
NoNewPrivileges=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=/var/log/allternit /opt/allternit/config

[Install]
WantedBy=multi-user.target
EOF
log_info "Created systemd service"

# 6. Enable and start service
log_info "Starting Allternit agent..."
systemctl daemon-reload
systemctl enable allternit-agent
systemctl start allternit-agent
log_info "Started Allternit agent"

# 7. Verify installation
log_info "Verifying installation..."
sleep 2

if systemctl is-active --quiet allternit-agent; then
    log_info "Allternit installation complete!"
    echo ""
    echo "=== Installation Summary ==="
    echo "Service: allternit-agent"
    echo "Status: running"
    echo "Control Plane: $CONTROL_PLANE_URL"
    echo ""
    echo "Useful commands:"
    echo "  systemctl status allternit-agent    # Check status"
    echo "  systemctl restart allternit-agent   # Restart service"
    echo "  journalctl -u allternit-agent -f    # View logs"
    echo ""
    exit 0
else
    log_error "Allternit service failed to start"
    echo ""
    echo "Checking service status..."
    systemctl status allternit-agent --no-pager
    echo ""
    echo "Recent logs:"
    journalctl -u allternit-agent --no-pager -n 20
    exit 1
fi
