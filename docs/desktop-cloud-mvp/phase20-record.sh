#!/usr/bin/env bash
set -uo pipefail

WORKSPACE="/Users/joe/Desktop/allternit-workspace/allternit-session-desktop-cloud-mvp"
DEMO_SCRIPT="$WORKSPACE/docs/desktop-cloud-mvp/phase20-demo.sh"
DONE_FILE="/tmp/phase20-demo.done"
RAW_VIDEO="/tmp/phase20-demo.mp4"
WEBM_OUT="$WORKSPACE/docs/desktop-cloud-mvp/phase20-substrate-router-demo.webm"

rm -f "$DONE_FILE" "$RAW_VIDEO" "$WEBM_OUT"

# Start screen recording (capture screen 0, no audio)
/opt/homebrew/bin/ffmpeg -y -f avfoundation -i "1:none" -r 10 -pix_fmt yuv420p \
  -c:v h264_videotoolbox -b:v 2M -movflags +faststart "$RAW_VIDEO" >/tmp/phase20-ffmpeg.log 2>&1 &
FFMPEG_PID=$!
echo "Recording started (PID $FFMPEG_PID) -> $RAW_VIDEO"
sleep 3

# Launch a fresh Terminal window front-and-center and run the demo
osascript <<EOF
tell application "Terminal"
    activate
    set newTab to do script "cd $WORKSPACE; clear; bash $DEMO_SCRIPT; touch $DONE_FILE"
    set bounds of (first window whose selected tab is newTab) to {50, 50, 1250, 850}
    set selected of (first window whose selected tab is newTab) to true
end tell
EOF

# Wait for the demo to finish
while [ ! -f "$DONE_FILE" ]; do
    sleep 2
done

# Give a moment for final output to be captured
sleep 2

# Stop recording
kill "$FFMPEG_PID" 2>/dev/null || true
wait "$FFMPEG_PID" 2>/dev/null || true

echo "Converting to WebM..."
/opt/homebrew/bin/ffmpeg -y -i "$RAW_VIDEO" -c:v libvpx-vp9 -b:v 1M \
  -deadline good -cpu-used 5 -an "$WEBM_OUT" >/tmp/phase20-webm.log 2>&1

echo "WebM saved to: $WEBM_OUT"
ls -lh "$WEBM_OUT"
