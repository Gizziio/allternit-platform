#!/bin/bash
#
# Post-install script for A2R Desktop
# Also installs A2R Backend services
#

set -e

echo "Installing A2R Backend..."

# Detect platform
ARCH=$(uname -m)
OS=$(uname -s | tr '[:upper:]' '[:lower:]')

# Map architecture
case $ARCH in
    x86_64) TARGET_ARCH="x86_64" ;;
    aarch64|arm64) TARGET_ARCH="aarch64" ;;
    *) echo "Unsupported architecture: $ARCH"; exit 1 ;;
esac

# Installation directories
INSTALL_DIR="/opt/a2r"
CONFIG_DIR="/etc/a2r"
DATA_DIR="/var/lib/a2r"
LOG_DIR="/var/log/a2r"

# Create directories
mkdir -p "$INSTALL_DIR/bin"
mkdir -p "$CONFIG_DIR"
mkdir -p "$DATA_DIR"
mkdir -p "$LOG_DIR"

# Binaries are bundled with the installer at ../Resources/backend/
BUNDLE_DIR="$(dirname "$0")/../Resources/backend"

# Copy bundled binaries
cp "$BUNDLE_DIR/bin/"* "$INSTALL_DIR/bin/" 2>/dev/null || true
chmod +x "$INSTALL_DIR/bin/"*

# Create symlinks
ln -sf "$INSTALL_DIR/bin/a2r-api" /usr/local/bin/a2r-api 2>/dev/null || true
ln -sf "$INSTALL_DIR/bin/a2r-kernel" /usr/local/bin/a2r-kernel 2>/dev/null || true
ln -sf "$INSTALL_DIR/bin/a2r-memory" /usr/local/bin/a2r-memory 2>/dev/null || true

# Create service user
if ! id "a2r" &>/dev/null; then
    useradd --system --no-create-home --home-dir "$DATA_DIR" --shell /usr/sbin/nologin a2r
fi

# Set permissions
chown -R a2r:a2r "$DATA_DIR"
chown -R a2r:a2r "$LOG_DIR"

# Generate config if doesn't exist
if [ ! -f "$CONFIG_DIR/backend.yaml" ]; then
    JWT_SECRET=$(openssl rand -hex 32 2>/dev/null || head -c 32 /dev/urandom | xxd -p)
    cat > "$CONFIG_DIR/backend.yaml" << EOF
server:
  host: 127.0.0.1
  port: 4096

api:
  cors_origins:
    - "http://localhost:3000"
    - "http://localhost:5173"

security:
  jwt_secret: "$JWT_SECRET"

database:
  type: sqlite
  path: /var/lib/a2r/a2r.db

storage:
  data_dir: /var/lib/a2r
  logs_dir: /var/log/a2r

logging:
  level: info
  file: /var/log/a2r/a2r.log
EOF
    chmod 640 "$CONFIG_DIR/backend.yaml"
fi

# Install systemd service on Linux
if [ -d /run/systemd/system ]; then
    cat > /etc/systemd/system/a2r-backend.service << 'EOF'
[Unit]
Description=A2R Backend Server
After=network.target

[Service]
Type=simple
User=a2r
Group=a2r
WorkingDirectory=/opt/a2r
ExecStart=/opt/a2r/bin/a2r-api
Environment=A2R_CONFIG=/etc/a2r/backend.yaml
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF

    systemctl daemon-reload
    systemctl enable a2r-backend
    
    # Start the service
    systemctl start a2r-backend || true
fi

# Install launchd service on macOS
if [ "$OS" = "darwin" ]; then
    cat > /Library/LaunchDaemons/io.a2r.backend.plist << EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>io.a2r.backend</string>
    <key>ProgramArguments</key>
    <array>
        <string>/opt/a2r/bin/a2r-api</string>
    </array>
    <key>EnvironmentVariables</key>
    <dict>
        <key>A2R_CONFIG</key>
        <string>/etc/a2r/backend.yaml</string>
    </dict>
    <key>RunAtLoad</key>
    <true/>
    <key>KeepAlive</key>
    <true/>
</dict>
</plist>
EOF

    launchctl load -w /Library/LaunchDaemons/io.a2r.backend.plist 2>/dev/null || true
fi

echo "A2R Backend installed successfully!"
echo "API available at: http://localhost:4096"
