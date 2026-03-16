#!/bin/bash
#
# Build Debian package for A2R Backend
#

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"
BUILD_DIR="$PROJECT_ROOT/target/release"
DEB_BUILD_DIR="$PROJECT_ROOT/target/debian"

# Get version
VERSION=$(grep "^version" "$PROJECT_ROOT/Cargo.toml" | head -1 | cut -d'"' -f2)
ARCH=$(dpkg --print-architecture 2>/dev/null || echo "amd64")

echo "Building Debian package for A2R Backend v${VERSION}..."

# Create debian package structure
mkdir -p "$DEB_BUILD_DIR/DEBIAN"
mkdir -p "$DEB_BUILD_DIR/opt/a2r/bin"
mkdir -p "$DEB_BUILD_DIR/etc/a2r"
mkdir -p "$DEB_BUILD_DIR/var/lib/a2r"
mkdir -p "$DEB_BUILD_DIR/var/log/a2r"
mkdir -p "$DEB_BUILD_DIR/lib/systemd/system"
mkdir -p "$DEB_BUILD_DIR/usr/share/doc/a2r-backend"

# Copy binaries
cp "$BUILD_DIR/a2r-api" "$DEB_BUILD_DIR/opt/a2r/bin/" 2>/dev/null || echo "Warning: a2r-api not found"
cp "$BUILD_DIR/a2r-kernel" "$DEB_BUILD_DIR/opt/a2r/bin/" 2>/dev/null || echo "Warning: a2r-kernel not found"
cp "$BUILD_DIR/a2r-memory" "$DEB_BUILD_DIR/opt/a2r/bin/" 2>/dev/null || echo "Warning: a2r-memory not found"
cp "$BUILD_DIR/a2r-workspace" "$DEB_BUILD_DIR/opt/a2r/bin/" 2>/dev/null || echo "Warning: a2r-workspace not found"

# Set permissions
chmod 755 "$DEB_BUILD_DIR/opt/a2r/bin/"*

# Create control file
cat > "$DEB_BUILD_DIR/DEBIAN/control" << EOF
Package: a2r-backend
Version: ${VERSION}
Section: web
Priority: optional
Architecture: ${ARCH}
Maintainer: A2R Team <team@a2r.dev>
Description: A2R Backend Server
 Self-hosted AI platform backend.
 Distributed as native binaries with systemd integration.
Homepage: https://a2r.dev
Depends: systemd, libc6
EOF

# Create systemd service files
cat > "$DEB_BUILD_DIR/lib/systemd/system/a2r-api.service" << 'EOF'
[Unit]
Description=A2R Backend API Server
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

# Create postinst script
cat > "$DEB_BUILD_DIR/DEBIAN/postinst" << 'EOF'
#!/bin/bash
set -e

# Create user if doesn't exist
if ! id "a2r" &>/dev/null; then
    useradd --system --no-create-home --home-dir /var/lib/a2r --shell /usr/sbin/nologin a2r
fi

# Set permissions
chown -R a2r:a2r /var/lib/a2r
chown -R a2r:a2r /var/log/a2r
chmod 750 /var/lib/a2r
chmod 755 /var/log/a2r

# Generate config if doesn't exist
if [ ! -f /etc/a2r/backend.yaml ]; then
    JWT_SECRET=$(openssl rand -hex 32 2>/dev/null || head -c 32 /dev/urandom | xxd -p)
    cat > /etc/a2r/backend.yaml << EOC
server:
  host: 0.0.0.0
  port: 4096

security:
  jwt_secret: "$JWT_SECRET"

database:
  type: sqlite
  path: /var/lib/a2r/a2r.db

storage:
  data_dir: /var/lib/a2r
  logs_dir: /var/log/a2r
EOC
    chmod 640 /etc/a2r/backend.yaml
fi

# Reload systemd
systemctl daemon-reload

# Enable services
systemctl enable a2r-api

echo "A2R Backend installed. Start with: sudo systemctl start a2r-api"
EOF
chmod 755 "$DEB_BUILD_DIR/DEBIAN/postinst"

# Create prerm script
cat > "$DEB_BUILD_DIR/DEBIAN/prerm" << 'EOF'
#!/bin/bash
set -e

# Stop services
systemctl stop a2r-api 2>/dev/null || true
systemctl disable a2r-api 2>/dev/null || true
EOF
chmod 755 "$DEB_BUILD_DIR/DEBIAN/prerm"

# Create conffiles to preserve config on upgrade
echo "/etc/a2r/backend.yaml" > "$DEB_BUILD_DIR/DEBIAN/conffiles"

# Copy documentation
cp "$SCRIPT_DIR/../deploy/README.md" "$DEB_BUILD_DIR/usr/share/doc/a2r-backend/"

# Build the package
dpkg-deb --build "$DEB_BUILD_DIR" "$PROJECT_ROOT/target/a2r-backend_${VERSION}_${ARCH}.deb"

echo ""
echo "✓ Debian package created:"
echo "  $PROJECT_ROOT/target/a2r-backend_${VERSION}_${ARCH}.deb"
echo ""
echo "Install with:"
echo "  sudo dpkg -i a2r-backend_${VERSION}_${ARCH}.deb"
echo "  sudo apt-get install -f  # Fix dependencies if needed"
