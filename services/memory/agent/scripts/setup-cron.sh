#!/bin/bash
#
# Setup cron jobs for automated memory consolidation
# Runs daily at 3 AM
#

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CONSOLIDATE_SCRIPT="$SCRIPT_DIR/daily-consolidate.sh"

echo "╔══════════════════════════════════════════════════════════╗"
echo "║     Setting Up Automated Memory Consolidation            ║"
echo "╚══════════════════════════════════════════════════════════╝"
echo ""

# Make script executable
chmod +x "$CONSOLIDATE_SCRIPT"

# Get current crontab
CURRENT_CRON=$(crontab -l 2>/dev/null || echo "")

# Check if already configured
if echo "$CURRENT_CRON" | grep -q "daily-consolidate.sh"; then
    echo "✅ Consolidation cron job already exists"
    crontab -l | grep "daily-consolidate"
else
    echo "Adding cron job for daily consolidation at 3:00 AM..."
    
    # Add to crontab
    (echo "$CURRENT_CRON"
     echo "# Memory Agent Daily Consolidation (3 AM)"
     echo "0 3 * * * $CONSOLIDATE_SCRIPT >> /tmp/memory-cron.log 2>&1"
    ) | crontab -
    
    echo "✅ Cron job added!"
fi

echo ""
echo "Schedule:"
crontab -l | grep -E "(daily-consolidate|^#.*Consolidation)"
echo ""

# Show how to manage
echo "Management commands:"
echo "  View cron:     crontab -l | grep memory"
echo "  Remove:        crontab -e  (then delete the line)"
echo "  Test run:      $CONSOLIDATE_SCRIPT"
echo "  View logs:     tail -f /tmp/memory-cron.log"
echo "  Daily logs:    ls -la /tmp/memory-consolidate-*.log"
echo ""

echo "✅ Setup complete! Consolidation will run daily at 3:00 AM"
