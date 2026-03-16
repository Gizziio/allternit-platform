#!/bin/bash
# Verify Canvas Modules using Browser-Use Agent

CANVAS_URL="https://canvas.instructure.com/courses/14389375/modules"
OUTPUT_FILE="/Users/macbook/Desktop/canvas_verification_screenshot.png"

echo "=== Canvas Module Verification via Browser-Use ==="
echo ""
echo "Navigating to: $CANVAS_URL"
echo ""

# Use the browser-use skill to navigate and screenshot
python3 ~/browser-use/scripts/browser_controller.py << EOF
{
  "action": "navigate",
  "url": "$CANVAS_URL",
  "wait": 3000
}
EOF

echo "Taking screenshot..."

# Take screenshot
python3 ~/browser-use/scripts/browser_controller.py << EOF
{
  "action": "screenshot",
  "output": "$OUTPUT_FILE"
}
EOF

if [ -f "$OUTPUT_FILE" ]; then
    echo ""
    echo "✅ Screenshot saved to: $OUTPUT_FILE"
    echo ""
    echo "Open this file to visually verify if modules exist:"
    echo "  open $OUTPUT_FILE"
else
    echo ""
    echo "❌ Screenshot failed"
fi

# Also extract text from page
echo ""
echo "Extracting module names from page..."
python3 ~/browser-use/scripts/browser_controller.py << EOF
{
  "action": "extract",
  "selector": "[data-module-name], .module-name, .module-title"
}
EOF
