#!/bin/bash
set -e

# A2R Runtime Installation Script
# Installs A2R agent on fresh VPS (Ubuntu/Debian)

echo "=== A2R Runtime Installation ==="
echo ""

# Configuration (passed via environment)
A2R_VERSION="${A2R_VERSION:-latest}"
CONTROL_PLANE_URL="${CONTROL_PLANE_URL:-wss://console.a2r.sh}"
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

# 1. Create A2R user
log_info "Creating a2r user..."
if ! id -u a2r >/dev/null 2>&1; then
    useradd -r -s /bin/false a2r
    log_info "Created a2r user"
else
    log_info "a2r user already exists"
fi

# 2. Create directories
log_info "Creating directories..."
mkdir -p /opt/a2r/bin
mkdir -p /opt/a2r/config
mkdir -p /var/log/a2r
chown -R a2r:a2r /opt/a2r
chown -R a2r:a2r /var/log/a2r
log_info "Created directories"

# 3. Install dependencies
log_info "Installing dependencies..."
apt-get update -qq
apt-get install -y -qq curl systemd >/dev/null 2>&1
log_info "Installed dependencies"

# 4. Download A2R runtime
log_info "Downloading A2R runtime..."
RELEASE_URL="https://releases.a2r.sh/${A2R_VERSION}/a2r-agent-x86_64-unknown-linux-gnu.tar.gz"

if ! curl -sLf "$RELEASE_URL" | tar xz -C /opt/a2r/bin --strip-components=1; then
    log_error "Failed to download A2R runtime from $RELEASE_URL"
    log_warn "Make sure the release URL is accessible"
    exit 1
fi

chmod +x /opt/a2r/bin/a2r-agent
log_info "Downloaded A2R runtime"

# 5. Create systemd service
log_info "Creating systemd service..."
cat > /etc/systemd/system/a2r-agent.service << EOF
[Unit]
Description=A2R Agent
After=network.target

[Service]
Type=simple
ExecStart=/opt/a2r/bin/a2r-agent --control-plane=${CONTROL_PLANE_URL} --token=${DEPLOYMENT_TOKEN}
Restart=always
RestartSec=5
User=a2r
Group=a2r
Environment=RUST_LOG=info

# Security hardening
NoNewPrivileges=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=/var/log/a2r /opt/a2r/config

[Install]
WantedBy=multi-user.target
EOF
log_info "Created systemd service"

# 6. Enable and start service
log_info "Starting A2R agent..."
systemctl daemon-reload
systemctl enable a2r-agent
systemctl start a2r-agent
log_info "Started A2R agent"

# 7. Verify installation
log_info "Verifying installation..."
sleep 2

if systemctl is-active --quiet a2r-agent; then
    log_info "A2R installation complete!"
    echo ""
    echo "=== Installation Summary ==="
    echo "Service: a2r-agent"
    echo "Status: running"
    echo "Control Plane: $CONTROL_PLANE_URL"
    echo ""
    echo "Useful commands:"
    echo "  systemctl status a2r-agent    # Check status"
    echo "  systemctl restart a2r-agent   # Restart service"
    echo "  journalctl -u a2r-agent -f    # View logs"
    echo ""
    exit 0
else
    log_error "A2R service failed to start"
    echo ""
    echo "Checking service status..."
    systemctl status a2r-agent --no-pager
    echo ""
    echo "Recent logs:"
    journalctl -u a2r-agent --no-pager -n 20
    exit 1
fi
