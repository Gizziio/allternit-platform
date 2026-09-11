#!/usr/bin/env bash
# Install a virtual desktop on a headless Linux VPS so Fabric Desktop has
# something to capture. Xvfb + XFCE + scrot/ffmpeg + xdotool.
# Safe to re-run. Does not open a public VNC port.
set -euo pipefail

if [ "$(id -u)" -ne 0 ]; then
  echo "run as root (or sudo)" >&2
  exit 1
fi

export DEBIAN_FRONTEND=noninteractive
apt-get update -y
apt-get install -y --no-install-recommends \
  xvfb xfce4 dbus-x11 xdotool scrot ffmpeg x11-utils xfonts-base fonts-dejavu-core

install -d /opt/allternit-desktop /var/log/allternit-desktop

cat > /opt/allternit-desktop/run.sh <<'EOF'
#!/bin/bash
set -e
export DISPLAY=:0
export HOME="${HOME:-/root}"
mkdir -p /var/log/allternit-desktop
if ! pgrep -f "Xvfb :0" >/dev/null 2>&1; then
  Xvfb :0 -screen 0 1280x720x24 -ac +extension GLX +render -noreset \
    >/var/log/allternit-desktop/xvfb.log 2>&1 &
  sleep 1
fi
if ! pgrep -x xfce4-session >/dev/null 2>&1; then
  xfce4-session >/var/log/allternit-desktop/xfce.log 2>&1 &
fi
wait
EOF
chmod +x /opt/allternit-desktop/run.sh

cat > /etc/systemd/system/allternit-desktop.service <<'EOF'
[Unit]
Description=Allternit virtual desktop (Xvfb + XFCE) for Fabric Desktop
After=network.target

[Service]
Type=simple
ExecStart=/opt/allternit-desktop/run.sh
Restart=on-failure
RestartSec=3
Environment=DISPLAY=:0

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable --now allternit-desktop.service
echo "virtual desktop on DISPLAY=:0. Capture with:"
echo "  DISPLAY=:0 node surfaces/phone-remote/server/index.mjs --bind 127.0.0.1"
