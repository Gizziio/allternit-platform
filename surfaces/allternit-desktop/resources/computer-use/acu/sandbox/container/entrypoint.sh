#!/bin/bash
# Boots the virtual desktop: Xvfb -> mutter -> x11vnc -> noVNC (websockify).
# Matches Anthropic's computer-use-demo entrypoint sequence.
set -e

Xvfb "$DISPLAY" -screen 0 "${WIDTH}x${HEIGHT}x24" -ac -nolisten tcp &
XVFB_PID=$!

# Wait for Xvfb to actually be accepting connections before starting anything
# that depends on it -- fail closed rather than racing.
for _ in $(seq 1 50); do
  if xdotool getmouselocation >/dev/null 2>&1; then
    break
  fi
  sleep 0.1
done

mutter --replace --sm-disable &

x11vnc -display "$DISPLAY" -forever -shared -nopw -rfbport 5900 -quiet &

websockify --web /opt/noVNC 6080 localhost:5900 &

# PID 1 waits on Xvfb; if it dies, the container exits (fail closed) instead
# of limping along with no display.
wait "$XVFB_PID"
