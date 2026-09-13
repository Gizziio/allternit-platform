# Container-based GUI sandbox for computer-use adapters.
#
# Mirrors Anthropic's own computer-use-demo stack exactly (confirmed against
# the real Dockerfile and computer.py at anthropics/anthropic-quickstarts):
# Xvfb + a lightweight window manager + x11vnc + noVNC for human viewing, and
# xdotool/scrot for actual agent control -- NOT VNC/RFB. See
# research/FIRECRACKER-GUEST-AGENT-VNC-SPEC.md for why the Firecracker path
# uses VNC (no alternative there) while this one deliberately doesn't.
FROM ubuntu:22.04

ENV DEBIAN_FRONTEND=noninteractive
ENV DISPLAY_NUM=1
ENV DISPLAY=:1
ENV WIDTH=1280
ENV HEIGHT=800

RUN apt-get update && apt-get install -y --no-install-recommends \
    xvfb \
    xdotool \
    scrot \
    imagemagick \
    x11vnc \
    mutter \
    python3 \
    python3-websockify \
    git \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# noVNC -- browser-based VNC viewer for human oversight only (never used by
# agent control, which goes through xdotool/scrot via `docker exec` instead).
RUN git clone --depth 1 --branch v1.5.0 https://github.com/novnc/noVNC.git /opt/noVNC \
    && ln -s /opt/noVNC/vnc.html /opt/noVNC/index.html

COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

EXPOSE 5900 6080

ENTRYPOINT ["/entrypoint.sh"]
