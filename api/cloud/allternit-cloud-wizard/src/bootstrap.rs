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

# Create A2R user if not exists
if ! id -u a2r >/dev/null 2>&1; then
    log "Creating a2r user..."
    useradd -r -s /bin/false a2r
fi

# Create directories
log "Creating directories..."
mkdir -p /opt/a2r/bin
mkdir -p /opt/a2r/config
mkdir -p /var/log/a2r
chown -R a2r:a2r /opt/a2r
chown -R a2r:a2r /var/log/a2r

# Download A2R binary
ALLTERNIT_VERSION="${ALLTERNIT_VERSION:-latest}"
log "Downloading A2R $ALLTERNIT_VERSION..."
RELEASE_URL="https://releases.a2r.sh/${ALLTERNIT_VERSION}/a2r-agent-x86_64-unknown-linux-gnu.tar.gz"

if curl -sLf "$RELEASE_URL" | tar xz -C /opt/a2r/bin --strip-components=1; then
    log "A2R downloaded successfully"
else
    error "Failed to download A2R from $RELEASE_URL"
fi

chmod +x /opt/a2r/bin/a2r-agent

# Create systemd service
log "Creating systemd service..."
cat > /etc/systemd/system/a2r-agent.service << 'EOF'
[Unit]
Description=A2R Agent
After=network.target

[Service]
Type=simple
ExecStart=/opt/a2r/bin/a2r-agent
Restart=always
RestartSec=5
User=a2r
Group=a2r
Environment=RUST_LOG=info

# Security
NoNewPrivileges=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=/var/log/a2r /opt/a2r/config

[Install]
WantedBy=multi-user.target
EOF

# Enable and start service
log "Starting A2R agent..."
systemctl daemon-reload
systemctl enable a2r-agent
systemctl start a2r-agent

# Verify installation
sleep 2
if systemctl is-active --quiet a2r-agent; then
    log "✓ A2R installation complete"
    log "✓ Service is running"
    echo "STATUS=SUCCESS"
    echo "MESSAGE=A2R installed successfully"
else
    error "A2R service failed to start"
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

# Create A2R user if not exists
if ! id -u a2r >/dev/null 2>&1; then
    log "Creating a2r user..."
    useradd -r -s /bin/false a2r
fi

# Create directories
log "Creating directories..."
mkdir -p /opt/a2r/bin
mkdir -p /opt/a2r/config
mkdir -p /var/log/a2r
chown -R a2r:a2r /opt/a2r
chown -R a2r:a2r /var/log/a2r

# Download A2R binary
ALLTERNIT_VERSION="${ALLTERNIT_VERSION:-latest}"
log "Downloading A2R $ALLTERNIT_VERSION..."
RELEASE_URL="https://releases.a2r.sh/${ALLTERNIT_VERSION}/a2r-agent-x86_64-unknown-linux-gnu.tar.gz"

if curl -sLf "$RELEASE_URL" | tar xz -C /opt/a2r/bin --strip-components=1; then
    log "A2R downloaded successfully"
else
    error "Failed to download A2R from $RELEASE_URL"
fi

chmod +x /opt/a2r/bin/a2r-agent

# Create systemd service
log "Creating systemd service..."
cat > /etc/systemd/system/a2r-agent.service << 'EOF'
[Unit]
Description=A2R Agent
After=network.target

[Service]
Type=simple
ExecStart=/opt/a2r/bin/a2r-agent
Restart=always
RestartSec=5
User=a2r
Group=a2r
Environment=RUST_LOG=info

# Security
NoNewPrivileges=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=/var/log/a2r /opt/a2r/config

[Install]
WantedBy=multi-user.target
EOF

# Enable and start service
log "Starting A2R agent..."
systemctl daemon-reload
systemctl enable a2r-agent
systemctl start a2r-agent

# Verify installation
sleep 2
if systemctl is-active --quiet a2r-agent; then
    log "✓ A2R installation complete"
    log "✓ Service is running"
    echo "STATUS=SUCCESS"
    echo "MESSAGE=A2R installed successfully"
else
    error "A2R service failed to start"
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

# Create A2R user if not exists
if ! id -u a2r >/dev/null 2>&1; then
    log "Creating a2r user..."
    useradd -r -s /bin/false a2r 2>/dev/null || true
fi

# Create directories
log "Creating directories..."
mkdir -p /opt/a2r/bin /opt/a2r/config /var/log/a2r
chown -R a2r:a2r /opt/a2r /var/log/a2r 2>/dev/null || true

# Download A2R binary
ALLTERNIT_VERSION="${ALLTERNIT_VERSION:-latest}"
log "Downloading A2R $ALLTERNIT_VERSION..."
RELEASE_URL="https://releases.a2r.sh/${ALLTERNIT_VERSION}/a2r-agent-x86_64-unknown-linux-gnu.tar.gz"

if curl -sLf "$RELEASE_URL" | tar xz -C /opt/a2r/bin --strip-components=1; then
    log "A2R downloaded successfully"
else
    error "Failed to download A2R"
fi

chmod +x /opt/a2r/bin/a2r-agent

log "A2R installed to /opt/a2r/bin/a2r-agent"
log "You must manually configure and start the service"
echo "STATUS=PARTIAL"
echo "MESSAGE=A2R binary installed - manual configuration required"
"#;

    /// Get post-install verification commands
    pub fn get_verify_commands(&self) -> Vec<&'static str> {
        vec![
            "systemctl is-active a2r-agent",
            "curl -s http://localhost:8443/health",
            "/opt/a2r/bin/a2r-agent --version",
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
