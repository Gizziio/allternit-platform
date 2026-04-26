#!/bin/bash
# Allternit Chrome Stream Entrypoint
# Sets up network isolation, loads configuration, and starts supervisord

set -e

echo "[entrypoint] Starting Allternit Chrome Stream..."

# Create required directories for dbus, pulseaudio, and X11
mkdir -p /run/dbus /var/run/dbus /run/pulse /var/run/pulse /tmp/.X11-unix
chmod 1777 /run/dbus /var/run/dbus /run/pulse /var/run/pulse /tmp/.X11-unix

# Load resolution from config file if it exists (for dynamic resize)
CONFIG_FILE="/data/session_config.json"
if [ -f "$CONFIG_FILE" ]; then
    echo "[entrypoint] Loading configuration from $CONFIG_FILE"
    export Allternit_RESOLUTION=$(jq -r '.resolution' "$CONFIG_FILE")
    export Allternit_WIDTH=$(jq -r '.width' "$CONFIG_FILE")
    export Allternit_HEIGHT=$(jq -r '.height' "$CONFIG_FILE")
fi

# Set defaults if not provided
export Allternit_RESOLUTION=${Allternit_RESOLUTION:-1920x1080}
export Allternit_WIDTH=${Allternit_WIDTH:-1920}
export Allternit_HEIGHT=${Allternit_HEIGHT:-1080}

echo "[entrypoint] Resolution: ${Allternit_RESOLUTION}"
echo "[entrypoint] Session ID: ${Allternit_SESSION_ID:-<not set>}"
echo "[entrypoint] Tenant ID: ${Allternit_TENANT_ID:-<not set>}"
echo "[entrypoint] Extension Mode: ${Allternit_EXTENSION_MODE:-managed}"

# Setup network isolation (egress-only, block internal networks)
setup_network_isolation() {
    echo "[entrypoint] Setting up network isolation..."

    # Enable IP forwarding
    echo 1 > /proc/sys/net/ipv4/ip_forward 2>/dev/null || true

    # Flush existing rules
    iptables -F 2>/dev/null || true
    iptables -X 2>/dev/null || true

    # Default policy: DROP all outbound
    iptables -P OUTPUT DROP 2>/dev/null || true

    # Allow loopback
    iptables -A OUTPUT -o lo -j ACCEPT

    # Allow established connections
    iptables -A OUTPUT -m state --state ESTABLISHED,RELATED -j ACCEPT

    # Block cloud metadata endpoints
    iptables -A OUTPUT -d 169.254.169.254 -j DROP
    iptables -A OUTPUT -d 169.254.169.253 -j DROP  # AWS
    iptables -A OUTPUT -d 169.254.169.252 -j DROP  # AWS
    iptables -A OUTPUT -d 100.100.100.200 -j DROP  # Alibaba
    iptables -A OUTPUT -d 168.63.129.16 -j DROP    # Azure
    iptables -A OUTPUT -d 169.254.1.1 -j DROP      # GCP

    # Block RFC1918 (internal networks) by default
    iptables -A OUTPUT -d 10.0.0.0/8 -j DROP
    iptables -A OUTPUT -d 172.16.0.0/12 -j DROP
    iptables -A OUTPUT -d 192.168.0.0/16 -j DROP

    # Allow DNS (UDP/TCP 53)
    iptables -A OUTPUT -p udp --dport 53 -j ACCEPT
    iptables -A OUTPUT -p tcp --dport 53 -j ACCEPT

    # Allow HTTP/HTTPS (full internet access)
    iptables -A OUTPUT -p tcp --dport 80 -j ACCEPT
    iptables -A OUTPUT -p tcp --dport 443 -j ACCEPT

    # Allow tenant-specific internal allowlist (if configured)
    if [ -n "$Allternit_INTERNAL_ALLOWLIST" ]; then
        echo "[entrypoint] Adding internal allowlist: $Allternit_INTERNAL_ALLOWLIST"
        IFS=',' read -ra ADDR <<< "$Allternit_INTERNAL_ALLOWLIST"
        for addr in "${ADDR[@]}"; do
            iptables -A OUTPUT -d "$addr" -j ACCEPT
            echo "[entrypoint]   Allowed: $addr"
        done
    fi

    # Log dropped packets (for audit)
    iptables -A OUTPUT -j LOG --log-prefix "DROPPED: " --log-level 4 2>/dev/null || true

    echo "[entrypoint] Network isolation configured"
}

# Setup network isolation (skip in dev/test mode)
if [ "$Allternit_SKIP_NETWORK_ISOLATION" != "true" ]; then
    setup_network_isolation
else
    echo "[entrypoint] Skipping network isolation (dev/test mode)"
fi

# Build Google Chrome flags
# Note: Chrome sandbox requires proper container setup - using --no-sandbox for now
# Production will use seccomp profile + container isolation instead
CHROME_FLAGS="--no-first-run --no-default-browser-check"
CHROME_FLAGS="$CHROME_FLAGS --remote-debugging-port=9222"
CHROME_FLAGS="$CHROME_FLAGS --remote-debugging-address=127.0.0.1"
CHROME_FLAGS="$CHROME_FLAGS --user-data-dir=/data/chrome-profile"
CHROME_FLAGS="$CHROME_FLAGS --window-size=${Allternit_WIDTH},${Allternit_HEIGHT}"
CHROME_FLAGS="$CHROME_FLAGS --start-maximized"
# Sandbox disabled - container isolation provides security boundary
CHROME_FLAGS="$CHROME_FLAGS --no-sandbox"
CHROME_FLAGS="$CHROME_FLAGS --disable-setuid-sandbox"

# Power mode: don't block any extensions at policy layer
# Managed mode: extensions controlled via ExtensionSettings policy
if [ "$Allternit_EXTENSION_MODE" = "power" ]; then
    echo "[entrypoint] Power Mode: Full extension support enabled"
else
    echo "[entrypoint] Managed Mode: Extensions controlled via policy"
fi

# Background throttling toggle (for always-on extensions)
if [ "$Allternit_DISABLE_BACKGROUND_THROTTLING" = "true" ]; then
    echo "[entrypoint] Disabling background timer throttling"
    CHROME_FLAGS="$CHROME_FLAGS --disable-background-timer-throttling"
    CHROME_FLAGS="$CHROME_FLAGS --disable-backgrounding-occluded-windows"
fi

# Export Chrome flags for supervisord
export Allternit_CHROME_FLAGS="$CHROME_FLAGS"
echo "[entrypoint] Chrome flags: $CHROME_FLAGS"

# Create download directory with proper permissions
mkdir -p /data/downloads
chown chrome:chrome /data/downloads

# Start supervisord (manages all processes)
echo "[entrypoint] Starting supervisord..."
exec /usr/bin/supervisord -c /etc/supervisor/supervisord.conf -n
