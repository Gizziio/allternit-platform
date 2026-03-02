# A2R Chrome Stream - Enterprise-grade real Chrome streaming via WebRTC
# Based on Ubuntu 22.04 with Google Chrome (x86_64), selkies-gstreamer, and sidecar
# Uses Docker x86_64 emulation on ARM64 hosts

FROM --platform=linux/amd64 ubuntu:22.04

# Prevent interactive prompts during package installation
ENV DEBIAN_FRONTEND=noninteractive
ENV TZ=UTC

# System dependencies
RUN apt-get update && apt-get install -y \
    # Virtual display and audio
    xvfb \
    pulseaudio \
    pulseaudio-utils \
    # DBus for Chrome IPC
    dbus-x11 \
    # Fonts for proper rendering
    fonts-noto \
    fonts-noto-cjk \
    fonts-noto-color-emoji \
    fonts-liberation \
    # System utilities
    python3 \
    python3-pip \
    python3-venv \
    curl \
    wget \
    gnupg \
    ca-certificates \
    apt-transport-https \
    # GStreamer for selkies
    gstreamer1.0-tools \
    gstreamer1.0-plugins-base \
    gstreamer1.0-plugins-good \
    gstreamer1.0-plugins-bad \
    gstreamer1.0-plugins-ugly \
    gstreamer1.0-x \
    gstreamer1.0-nice \
    gstreamer1.0-libav \
    gstreamer1.0-plugins-base-apps \
    libgstreamer-plugins-bad1.0-dev \
    gstreamer1.0-gl \
    libgstreamer-gl1.0-0 \
    python3-gi \
    python3-gi-cairo \
    gir1.2-gstreamer-1.0 \
    gir1.2-gst-plugins-base-1.0 \
    gir1.2-gst-plugins-bad-1.0 \
    # Supervisor for process management
    supervisor \
    # Network tools for isolation
    iptables \
    iproute2 \
    # JSON parsing
    jq \
    # X11 utilities for Chrome
    x11-xkb-utils \
    xauth \
    # Cleanup
    && rm -rf /var/lib/apt/lists/* \
    && apt-get clean

# Install Google Chrome (x86_64 stable)
RUN wget -q -O - https://dl.google.com/linux/linux_signing_key.pub | gpg --dearmor > /usr/share/keyrings/google-chrome.gpg \
    && echo "deb [arch=amd64 signed-by=/usr/share/keyrings/google-chrome.gpg] http://dl.google.com/linux/chrome/deb/ stable main" > /etc/apt/sources.list.d/google-chrome.list \
    && apt-get update \
    && apt-get install -y google-chrome-stable \
    && rm -rf /var/lib/apt/lists/* \
    && apt-get clean

# Create required directories for dbus and pulseaudio
RUN mkdir -p /run/dbus /var/run/dbus /run/pulse /var/run/pulse /tmp/.X11-unix \
    && chmod 1777 /tmp /run/dbus /var/run/dbus /run/pulse /var/run/pulse /tmp/.X11-unix

# Install selkies-gstreamer (WebRTC streaming)
# Not on PyPI — install from GitHub release (repo: selkies-project/selkies)
ARG SELKIES_VERSION=1.6.2
RUN pip3 install --no-cache-dir \
    "https://github.com/selkies-project/selkies/releases/download/v${SELKIES_VERSION}/selkies_gstreamer-${SELKIES_VERSION}-py3-none-any.whl"

# Install sidecar dependencies (FastAPI + websockets for CDP)
# Note: xmlrpc.client is built-in to Python 3, not a pip package
RUN pip3 install --no-cache-dir \
    fastapi \
    uvicorn \
    httpx \
    websockets \
    aiohttp

# Create non-root user for Chrome
RUN useradd -m -s /bin/bash chrome \
    && mkdir -p /data/chrome-profile /data/downloads \
    && chown -R chrome:chrome /data \
    && mkdir -p /run/dbus /var/run/dbus /run/pulse /var/run/pulse \
    && chown -R chrome:chrome /run/dbus /var/run/dbus /run/pulse /var/run/pulse

# Copy configuration files
COPY chrome-policies/ /etc/opt/chrome/policies/managed/
COPY seccomp/ /etc/a2r/seccomp/
COPY supervisor/ /etc/supervisor/conf.d/
COPY sidecar/ /opt/a2r/sidecar/
COPY entrypoint.sh /opt/a2r/entrypoint.sh

# Make scripts executable
RUN chmod +x /opt/a2r/entrypoint.sh \
    && chmod +x /opt/a2r/sidecar/main.py

# Set environment variables for GStreamer
ENV DISPLAY=:99 \
    A2R_RESOLUTION=1920x1080 \
    A2R_WIDTH=1920 \
    A2R_HEIGHT=1080 \
    A2R_SESSION_ID="" \
    A2R_TENANT_ID="" \
    A2R_EXTENSION_MODE=managed \
    A2R_DISABLE_BACKGROUND_THROTTLING=false \
    SELKIES_ENCODER=x264enc \
    PYTHONUNBUFFERED=1 \
    GSTREAMER_PATH=/usr \
    PATH=/usr/bin:/usr/local/bin:/bin \
    LD_LIBRARY_PATH=/usr/lib/x86_64-linux-gnu:/usr/lib \
    GST_PLUGIN_PATH=/usr/lib/x86_64-linux-gnu/gstreamer-1.0 \
    GST_PLUGIN_SYSTEM_PATH=/usr/lib/x86_64-linux-gnu/gstreamer-1.0 \
    GI_TYPELIB_PATH=/usr/lib/x86_64-linux-gnu/girepository-1.0 \
    PYTHONPATH=/usr/lib/python3/dist-packages

# Expose ports
# 8080: WebRTC signaling (selkies)
# 8081: Sidecar control API
EXPOSE 8080 8081

# Data volume for Chrome profile persistence
VOLUME /data/chrome-profile
VOLUME /data/downloads

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:8081/health || exit 1

# Entrypoint
ENTRYPOINT ["/opt/a2r/entrypoint.sh"]
