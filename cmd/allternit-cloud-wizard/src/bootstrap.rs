//! Bootstrap Contract Module
//!
//! Defines the idempotent bootstrap interface:
//! - OS detection
//! - Package manager abstraction
//! - Init system abstraction
//! - Idempotent installation

use serde::{Deserialize, Serialize};

/// Bootstrap contract - idempotent installer
pub struct BootstrapContract {
    /// Target OS
    pub os: SupportedOS,
    /// Installation mode
    pub mode: InstallMode,
}

/// Supported OS for bootstrap
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum SupportedOS {
    Ubuntu,
    Debian,
    RockyLinux,
    AmazonLinux,
    Unknown,
}

/// Installation mode
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum InstallMode {
    /// Fresh install
    Fresh,
    /// Upgrade existing
    Upgrade,
    /// Reinstall (force)
    Reinstall,
}

impl BootstrapContract {
    /// Create new bootstrap contract
    pub fn new(os: SupportedOS, mode: InstallMode) -> Self {
        Self { os, mode }
    }

    /// Get bootstrap script for OS
    pub fn get_script(&self) -> &'static str {
        match self.os {
            SupportedOS::Ubuntu | SupportedOS::Debian => Self::DEBIAN_FAMILY_SCRIPT,
            SupportedOS::RockyLinux | SupportedOS::AmazonLinux => Self::RHEL_FAMILY_SCRIPT,
            SupportedOS::Unknown => Self::GENERIC_SCRIPT,
        }
    }

    /// Debian/Ubuntu family bootstrap script
    const DEBIAN_FAMILY_SCRIPT: &'static str = r#"#!/bin/bash
set -e

# Allternit Bootstrap Script - Debian/Ubuntu Family
# Idempotent: safe to run multiple times

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1"
}

error() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] ERROR: $1" >&2
    exit 1
}

# Check if running as root
if [ "$EUID" -ne 0 ]; then
    error "Please run as root (use sudo)"
fi

# Detect OS
if [ -f /etc/os-release ]; then
    . /etc/os-release
    OS_ID=$ID
    OS_VERSION=$VERSION_ID
    log "Detected OS: $OS_ID $OS_VERSION"
else
    error "Cannot detect OS - /etc/os-release not found"
fi

# Check for systemd
if ! command -v systemctl &> /dev/null; then
    error "systemd not found - this installer requires systemd"
fi

# Update package lists
log "Updating package lists..."
apt-get update -qq

# Install dependencies
log "Installing dependencies..."
apt-get install -y -qq curl ca-certificates gnupg

# Create Allternit user if not exists
if ! id -u allternit >/dev/null 2>&1; then
    log "Creating allternit user..."
    useradd -r -s /bin/false allternit
fi

# Create directories
log "Creating directories..."
mkdir -p /opt/allternit/bin
mkdir -p /opt/allternit/config
mkdir -p /var/log/allternit
chown -R allternit:allternit /opt/allternit
chown -R allternit:allternit /var/log/allternit

# Download Allternit binary
ALLTERNIT_VERSION="${ALLTERNIT_VERSION:-latest}"
log "Downloading Allternit $ALLTERNIT_VERSION..."
RELEASE_URL="https://releases.allternit.sh/${ALLTERNIT_VERSION}/allternit-agent-x86_64-unknown-linux-gnu.tar.gz"

if curl -sLf "$RELEASE_URL" | tar xz -C /opt/allternit/bin --strip-components=1; then
    log "Allternit downloaded successfully"
else
    error "Failed to download Allternit from $RELEASE_URL"
fi

chmod +x /opt/allternit/bin/allternit-agent

# Create systemd service
log "Creating systemd service..."
cat > /etc/systemd/system/allternit-agent.service << 'EOF'
[Unit]
Description=Allternit Agent
After=network.target

[Service]
Type=simple
ExecStart=/opt/allternit/bin/allternit-agent
Restart=always
RestartSec=5
User=allternit
Group=allternit
Environment=RUST_LOG=info

# Security
NoNewPrivileges=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=/var/log/allternit /opt/allternit/config

[Install]
WantedBy=multi-user.target
EOF

# Enable and start service
log "Starting Allternit agent..."
systemctl daemon-reload
systemctl enable allternit-agent
systemctl start allternit-agent

# Verify installation
sleep 2
if systemctl is-active --quiet allternit-agent; then
    log "✓ Allternit installation complete"
    log "✓ Service is running"
    echo "STATUS=SUCCESS"
    echo "MESSAGE=Allternit installed successfully"
else
    error "Allternit service failed to start"
fi
"#;

    /// RHEL/CentOS family bootstrap script
    const RHEL_FAMILY_SCRIPT: &'static str = r#"#!/bin/bash
set -e

# Allternit Bootstrap Script - RHEL/CentOS Family
# Idempotent: safe to run multiple times

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1"
}

error() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] ERROR: $1" >&2
    exit 1
}

# Check if running as root
if [ "$EUID" -ne 0 ]; then
    error "Please run as root (use sudo)"
fi

# Detect OS
if [ -f /etc/os-release ]; then
    . /etc/os-release
    OS_ID=$ID
    OS_VERSION=$VERSION_ID
    log "Detected OS: $OS_ID $OS_VERSION"
else
    error "Cannot detect OS - /etc/os-release not found"
fi

# Check for systemd
if ! command -v systemctl &> /dev/null; then
    error "systemd not found - this installer requires systemd"
fi

# Install dependencies
log "Installing dependencies..."
dnf install -y -q curl ca-certificates gnupg2

# Create Allternit user if not exists
if ! id -u allternit >/dev/null 2>&1; then
    log "Creating allternit user..."
    useradd -r -s /bin/false allternit
fi

# Create directories
log "Creating directories..."
mkdir -p /opt/allternit/bin
mkdir -p /opt/allternit/config
mkdir -p /var/log/allternit
chown -R allternit:allternit /opt/allternit
chown -R allternit:allternit /var/log/allternit

# Download Allternit binary
ALLTERNIT_VERSION="${ALLTERNIT_VERSION:-latest}"
log "Downloading Allternit $ALLTERNIT_VERSION..."
RELEASE_URL="https://releases.allternit.sh/${ALLTERNIT_VERSION}/allternit-agent-x86_64-unknown-linux-gnu.tar.gz"

if curl -sLf "$RELEASE_URL" | tar xz -C /opt/allternit/bin --strip-components=1; then
    log "Allternit downloaded successfully"
else
    error "Failed to download Allternit from $RELEASE_URL"
fi

chmod +x /opt/allternit/bin/allternit-agent

# Create systemd service
log "Creating systemd service..."
cat > /etc/systemd/system/allternit-agent.service << 'EOF'
[Unit]
Description=Allternit Agent
After=network.target

[Service]
Type=simple
ExecStart=/opt/allternit/bin/allternit-agent
Restart=always
RestartSec=5
User=allternit
Group=allternit
Environment=RUST_LOG=info

# Security
NoNewPrivileges=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=/var/log/allternit /opt/allternit/config

[Install]
WantedBy=multi-user.target
EOF

# Enable and start service
log "Starting Allternit agent..."
systemctl daemon-reload
systemctl enable allternit-agent
systemctl start allternit-agent

# Verify installation
sleep 2
if systemctl is-active --quiet allternit-agent; then
    log "✓ Allternit installation complete"
    log "✓ Service is running"
    echo "STATUS=SUCCESS"
    echo "MESSAGE=Allternit installed successfully"
else
    error "Allternit service failed to start"
fi
"#;

    /// Generic fallback script
    const GENERIC_SCRIPT: &'static str = r#"#!/bin/bash
set -e

# Allternit Bootstrap Script - Generic Fallback
# This script attempts best-effort installation

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1"
}

error() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] ERROR: $1" >&2
    exit 1
}

log "WARNING: Running generic bootstrap script - may not work on all systems"

# Check if running as root
if [ "$EUID" -ne 0 ]; then
    error "Please run as root (use sudo)"
fi

# Try to detect package manager
if command -v apt-get &> /dev/null; then
    PKG_MANAGER="apt-get"
    UPDATE_CMD="apt-get update -qq"
    INSTALL_CMD="apt-get install -y -qq"
elif command -v dnf &> /dev/null; then
    PKG_MANAGER="dnf"
    UPDATE_CMD="dnf install -y -q"
    INSTALL_CMD="dnf install -y -q"
elif command -v yum &> /dev/null; then
    PKG_MANAGER="yum"
    UPDATE_CMD="yum install -y -q"
    INSTALL_CMD="yum install -y -q"
else
    error "No supported package manager found (apt-get, dnf, yum)"
fi

log "Using package manager: $PKG_MANAGER"

# Install dependencies
log "Installing dependencies..."
$INSTALL_CMD curl ca-certificates

# Create Allternit user if not exists
if ! id -u allternit >/dev/null 2>&1; then
    log "Creating allternit user..."
    useradd -r -s /bin/false allternit 2>/dev/null || true
fi

# Create directories
log "Creating directories..."
mkdir -p /opt/allternit/bin /opt/allternit/config /var/log/allternit
chown -R allternit:allternit /opt/allternit /var/log/allternit 2>/dev/null || true

# Download Allternit binary
ALLTERNIT_VERSION="${ALLTERNIT_VERSION:-latest}"
log "Downloading Allternit $ALLTERNIT_VERSION..."
RELEASE_URL="https://releases.allternit.sh/${ALLTERNIT_VERSION}/allternit-agent-x86_64-unknown-linux-gnu.tar.gz"

if curl -sLf "$RELEASE_URL" | tar xz -C /opt/allternit/bin --strip-components=1; then
    log "Allternit downloaded successfully"
else
    error "Failed to download Allternit"
fi

chmod +x /opt/allternit/bin/allternit-agent

log "Allternit installed to /opt/allternit/bin/allternit-agent"
log "You must manually configure and start the service"
echo "STATUS=PARTIAL"
echo "MESSAGE=Allternit binary installed - manual configuration required"
"#;

    /// Get post-install verification commands
    pub fn get_verify_commands(&self) -> Vec<&'static str> {
        vec![
            "systemctl is-active allternit-agent",
            "curl -s http://localhost:8443/health",
            "/opt/allternit/bin/allternit-agent --version",
        ]
    }
}

/// Bootstrap result
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BootstrapResult {
    pub success: bool,
    pub status: String,
    pub message: String,
    pub log_output: String,
}

/// Bootstrap error
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BootstrapError {
    pub code: String,
    pub message: String,
    pub recoverable: bool,
}
