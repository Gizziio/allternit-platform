#!/bin/bash
# Build the Allternit Ubuntu desktop Incus image.
# Run this on an Incus host. It creates a throw-away container,
# installs the desktop stack, bakes in the allternit-mux binary,
# and publishes the result as a local image named "allternit-desktop".
#
# Environment variables:
#   MUX_SRC_DIR  - path to the allternit-mux source tree (default: /tmp/allternit-mux-src)
#   IMAGE_NAME   - published image alias (default: allternit-desktop)
#   UBUNTU_IMAGE - source image alias (default: images:ubuntu/24.04/cloud)
#   KEEP_BUILDER - if set, do not delete the build container

set -euo pipefail

MUX_SRC_DIR="${MUX_SRC_DIR:-/tmp/allternit-mux-src}"
IMAGE_NAME="${IMAGE_NAME:-allternit-desktop}"
UBUNTU_IMAGE="${UBUNTU_IMAGE:-images:ubuntu/24.04/cloud}"
BUILD_CONTAINER="allternit-desktop-builder-$$"

log() {
    echo "[build-image] $*"
}

cleanup() {
    if [ -z "${KEEP_BUILDER:-}" ]; then
        log "cleaning up build container ${BUILD_CONTAINER}"
        incus delete -f "${BUILD_CONTAINER}" >/dev/null 2>&1 || true
    fi
}
trap cleanup EXIT

# ---------------------------------------------------------------------------
# 1. Build allternit-mux for the guest.
# ---------------------------------------------------------------------------
if [ -n "${MUX_BIN:-}" ]; then
    log "using prebuilt allternit-mux binary: ${MUX_BIN}"
    if [ ! -x "${MUX_BIN}" ]; then
        echo "ERROR: MUX_BIN does not exist or is not executable: ${MUX_BIN}" >&2
        exit 1
    fi
else
    log "building allternit-mux from ${MUX_SRC_DIR}"
    if [ ! -d "${MUX_SRC_DIR}" ]; then
        echo "ERROR: MUX_SRC_DIR does not exist: ${MUX_SRC_DIR}" >&2
        exit 1
    fi

    # Make cargo available for CI runners that install Rust via rustup but do
    # not inherit the PATH (e.g., when running under sudo).
    if ! command -v cargo >/dev/null 2>&1 && [ -f "${HOME}/.cargo/env" ]; then
        . "${HOME}/.cargo/env"
    fi
    if ! command -v cargo >/dev/null 2>&1; then
        echo "ERROR: cargo not found. Install Rust, set MUX_SRC_DIR, or pass MUX_BIN" >&2
        exit 1
    fi

    (
        cd "${MUX_SRC_DIR}"
        cargo build --release
    )
    MUX_BIN="${MUX_SRC_DIR}/target/release/allternit-mux"
    if [ ! -x "${MUX_BIN}" ]; then
        echo "ERROR: allternit-mux binary not found at ${MUX_BIN}" >&2
        exit 1
    fi
    log "allternit-mux binary: ${MUX_BIN}"
fi

# ---------------------------------------------------------------------------
# 2. Launch a build container from the Ubuntu cloud image.
# ---------------------------------------------------------------------------
log "launching build container ${BUILD_CONTAINER} from ${UBUNTU_IMAGE}"
incus launch "${UBUNTU_IMAGE}" "${BUILD_CONTAINER}" --config raw.lxc="lxc.cgroup.devices.allow = c 116:* rwm" || {
    echo "ERROR: failed to launch build container" >&2
    exit 1
}

# Wait for the container to reach a running state and for cloud-init to finish.
log "waiting for container to boot"
for i in $(seq 1 120); do
    if incus exec "${BUILD_CONTAINER}" -- systemctl is-system-running >/dev/null 2>&1; then
        break
    fi
    sleep 1
done

log "waiting for cloud-init"
incus exec "${BUILD_CONTAINER}" -- cloud-init status --wait || true

# ---------------------------------------------------------------------------
# 3. Install desktop packages and browsers.
# ---------------------------------------------------------------------------
log "updating package lists"
incus exec "${BUILD_CONTAINER}" -- apt-get update -y

log "installing desktop packages"
incus exec "${BUILD_CONTAINER}" -- apt-get install -y \
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

log "installing Google Chrome"
incus exec "${BUILD_CONTAINER}" -- bash -c '
set -e
curl -fsSL https://dl-ssl.google.com/linux/linux_signing_key.pub | gpg --dearmor -o /usr/share/keyrings/google-chrome.gpg
echo "deb [arch=amd64 signed-by=/usr/share/keyrings/google-chrome.gpg] https://dl.google.com/linux/chrome/deb/ stable main" > /etc/apt/sources.list.d/google-chrome.list
apt-get update -y
apt-get install -y google-chrome-stable
'

log "installing Tailscale client"
incus exec "${BUILD_CONTAINER}" -- bash -c '
set -e
curl -fsSL https://pkgs.tailscale.com/stable/ubuntu/noble.noarmor.gpg | tee /usr/share/keyrings/tailscale-archive-keyring.gpg >/dev/null
echo "deb [signed-by=/usr/share/keyrings/tailscale-archive-keyring.gpg] https://pkgs.tailscale.com/stable/ubuntu noble main" > /etc/apt/sources.list.d/tailscale.list
apt-get update -y
apt-get install -y tailscale
'

# ---------------------------------------------------------------------------
# 4. Install allternit-mux runtime and services.
# ---------------------------------------------------------------------------
log "installing allternit-mux runtime"
incus exec "${BUILD_CONTAINER}" -- mkdir -p /opt/allternit-mux /opt/allternit-desktop
incus file push "${MUX_BIN}" "${BUILD_CONTAINER}/opt/allternit-mux/allternit-mux"
incus exec "${BUILD_CONTAINER}" -- chmod +x /opt/allternit-mux/allternit-mux

cat > /tmp/allternit-desktop-run.sh <<'EOF'
#!/bin/bash
set -e
export DISPLAY=:0
export HOME=/root
mkdir -p /var/log/allternit-desktop

# Start the in-memory X server.
Xvfb :0 -screen 0 1280x720x24 -ac +extension GLX +render -noreset \
  >/var/log/allternit-desktop/xvfb.log 2>&1 &

# Give Xvfb a moment to come up.
sleep 2

# Start the XFCE session.
xfce4-session >/var/log/allternit-desktop/xfce.log 2>&1 &

# Share the display over VNC (password = allternit for the MVP).
x11vnc -display :0 -rfbport 5900 -forever -shared -passwd allternit \
  >/var/log/allternit-desktop/x11vnc.log 2>&1 &

# Keep the service alive so systemd does not kill the cgroup.
wait
EOF
incus file push /tmp/allternit-desktop-run.sh "${BUILD_CONTAINER}/opt/allternit-desktop/run.sh"
incus exec "${BUILD_CONTAINER}" -- chmod +x /opt/allternit-desktop/run.sh

cat > /tmp/allternit-desktop.service <<'EOF'
[Unit]
Description=Allternit agent desktop
After=network.target systemd-user-sessions.service

[Service]
Type=simple
ExecStart=/opt/allternit-desktop/run.sh
ExecStop=/bin/kill -TERM $MAINPID
KillMode=mixed
Restart=on-failure
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF
incus file push /tmp/allternit-desktop.service "${BUILD_CONTAINER}/etc/systemd/system/allternit-desktop.service"

cat > /tmp/allternit-mux.service <<'EOF'
[Unit]
Description=Allternit mux guest runtime
After=network.target systemd-user-sessions.service
ConditionPathExists=/opt/allternit-mux/allternit-mux

[Service]
Type=simple
Environment="HOME=/root"
ExecStart=/opt/allternit-mux/allternit-mux serve
ExecStop=/bin/kill -TERM $MAINPID
KillMode=mixed
Restart=on-failure
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF
incus file push /tmp/allternit-mux.service "${BUILD_CONTAINER}/etc/systemd/system/allternit-mux.service"

incus exec "${BUILD_CONTAINER}" -- systemctl daemon-reload
incus exec "${BUILD_CONTAINER}" -- systemctl enable allternit-desktop.service
incus exec "${BUILD_CONTAINER}" -- systemctl enable allternit-mux.service

# ---------------------------------------------------------------------------
# 5. Clean up build artifacts to keep the image small.
# ---------------------------------------------------------------------------
log "cleaning package cache"
incus exec "${BUILD_CONTAINER}" -- apt-get clean
incus exec "${BUILD_CONTAINER}" -- rm -rf /var/lib/apt/lists/* /tmp/* /var/tmp/*

# ---------------------------------------------------------------------------
# 6. Stop and publish the image.
# ---------------------------------------------------------------------------
log "stopping build container"
incus stop "${BUILD_CONTAINER}"

log "publishing image as ${IMAGE_NAME}"
incus publish "${BUILD_CONTAINER}" --alias "${IMAGE_NAME}" \
    description="Allternit Ubuntu 24.04 desktop with XFCE, Chrome, Tailscale, and allternit-mux" \
    --compression=zstd

log "image build complete: ${IMAGE_NAME}"
incus image info "${IMAGE_NAME}"
