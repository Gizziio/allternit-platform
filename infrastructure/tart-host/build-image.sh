#!/bin/bash
# Build an Allternit-ready Tart Ubuntu desktop image.
# Run this locally on the Apple-Silicon Mac that hosts macOS desktops.
#
# The script clones a lightweight Ubuntu Tart image, installs the desktop
# automation stack (XFCE, Xvfb, scrot, xdotool, x11vnc), bakes in a startup
# service, and saves the result as the `allternit-desktop-tart` image.
#
# Environment variables:
#   TART_BIN      - path to the Tart binary (default: /opt/homebrew/bin/tart)
#   BASE_IMAGE    - source Tart image (default: ghcr.io/cirruslabs/ubuntu:latest)
#   OUTPUT_IMAGE  - published image name (default: allternit-desktop-tart)
#   KEEP_BUILDER  - if set, do not delete the build VM

set -euo pipefail

TART_BIN="${TART_BIN:-/opt/homebrew/bin/tart}"
BASE_IMAGE="${BASE_IMAGE:-ghcr.io/cirruslabs/ubuntu:latest}"
OUTPUT_IMAGE="${OUTPUT_IMAGE:-allternit-desktop-tart}"
BUILD_VM="allternit-tart-builder-$$"

tart() {
    "${TART_BIN}" "$@"
}

log() {
    echo "[build-image] $*"
}

cleanup() {
    if [ -z "${KEEP_BUILDER:-}" ]; then
        log "cleaning up build VM ${BUILD_VM}"
        tart delete "${BUILD_VM}" >/dev/null 2>&1 || true
    fi
}
trap cleanup EXIT

if ! command -v "${TART_BIN}" >/dev/null 2>&1; then
    echo "ERROR: Tart not found at ${TART_BIN}" >&2
    echo "Install with: brew install cirruslabs/cli/tart" >&2
    exit 1
fi

if [ "$(uname -m)" != "arm64" ]; then
    echo "WARNING: Tart Apple Virtualization requires Apple Silicon (arm64)." >&2
fi

# ---------------------------------------------------------------------------
# 1. Clone the base image.
# ---------------------------------------------------------------------------
log "cloning ${BASE_IMAGE} -> ${BUILD_VM}"
tart clone "${BASE_IMAGE}" "${BUILD_VM}"

# ---------------------------------------------------------------------------
# 2. Start the build VM and wait for SSH.
# ---------------------------------------------------------------------------
log "starting build VM"
tart run "${BUILD_VM}" >/dev/null 2>&1 &
TART_PID=$!

log "waiting for VM IP"
IP=""
for i in $(seq 1 60); do
    IP=$(tart ip "${BUILD_VM}" 2>/dev/null | tr -d '\n' || true)
    [ -n "${IP}" ] && break
    sleep 2
done

if [ -z "${IP}" ]; then
    echo "ERROR: VM did not get an IP" >&2
    exit 1
fi

log "VM IP: ${IP}, waiting for SSH"
for i in $(seq 1 60); do
    if sshpass -p admin ssh -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null -o ConnectTimeout=5 -o LogLevel=ERROR "admin@${IP}" true 2>/dev/null; then
        break
    fi
    sleep 2
done

SSH="sshpass -p admin ssh -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null -o LogLevel=ERROR admin@${IP}"

# ---------------------------------------------------------------------------
# 3. Install desktop packages.
# ---------------------------------------------------------------------------
log "updating package lists"
${SSH} sudo apt-get update -y

log "installing desktop automation packages"
${SSH} sudo apt-get install -y \
    xfce4 \
    xvfb \
    x11vnc \
    scrot \
    xdotool \
    dbus-x11 \
    xfonts-base \
    fonts-dejavu-core \
    curl \
    ca-certificates \
    wget \
    gnupg \
    apt-transport-https

# ---------------------------------------------------------------------------
# 4. Install startup service that brings up Xvfb + XFCE + VNC.
# ---------------------------------------------------------------------------
log "installing desktop startup service"
${SSH} 'sudo mkdir -p /opt/allternit-desktop && sudo tee /opt/allternit-desktop/run.sh >/dev/null <<EOF_RUN
#!/bin/bash
set -e
export DISPLAY=:0
export HOME=/home/admin
mkdir -p /var/log/allternit-desktop

Xvfb :0 -screen 0 1280x720x24 -ac +extension GLX +render -noreset \\
  >/var/log/allternit-desktop/xvfb.log 2>&1 &
sleep 2

xfce4-session >/var/log/allternit-desktop/xfce.log 2>&1 &

x11vnc -display :0 -rfbport 5900 -forever -shared -nopw \\
  >/var/log/allternit-desktop/x11vnc.log 2>&1 &

wait
EOF_RUN
sudo chmod +x /opt/allternit-desktop/run.sh'

${SSH} 'sudo tee /etc/systemd/system/allternit-desktop.service >/dev/null <<EOF_SVC
[Unit]
Description=Allternit agent desktop
After=network.target systemd-user-sessions.service

[Service]
Type=simple
User=admin
Environment="DISPLAY=:0"
Environment="HOME=/home/admin"
ExecStart=/opt/allternit-desktop/run.sh
ExecStop=/bin/kill -TERM \$MAINPID
KillMode=mixed
Restart=on-failure
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF_SVC
sudo systemctl daemon-reload
sudo systemctl enable allternit-desktop.service'

# ---------------------------------------------------------------------------
# 5. Clean up.
# ---------------------------------------------------------------------------
log "cleaning package cache"
${SSH} sudo apt-get clean
${SSH} sudo rm -rf /var/lib/apt/lists/* /tmp/* /var/tmp/*

# ---------------------------------------------------------------------------
# 6. Stop and save the image.
# ---------------------------------------------------------------------------
log "stopping build VM"
kill "${TART_PID}" 2>/dev/null || true
wait "${TART_PID}" 2>/dev/null || true

# Give Tart a moment to release the VM.
sleep 3
tart stop "${BUILD_VM}" 2>/dev/null || true

log "saving image as ${OUTPUT_IMAGE}"
tart delete "${OUTPUT_IMAGE}" >/dev/null 2>&1 || true
tart clone "${BUILD_VM}" "${OUTPUT_IMAGE}"

log "Tart image build complete: ${OUTPUT_IMAGE}"
tart list
