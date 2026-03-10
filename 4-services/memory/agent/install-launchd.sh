#!/bin/bash
#
# install-launchd.sh - Install Memory Agent as a macOS launchd service
#
# Usage: ./install-launchd.sh [install|uninstall|status]
#

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PLIST_FILE="$SCRIPT_DIR/com.a2rchitech.memory-agent.plist"
LAUNCHD_DIR="$HOME/Library/LaunchAgents"
LAUNCHD_LABEL="com.a2rchitech.memory-agent"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

print_status() {
    echo -e "${GREEN}✓${NC} $1"
}

print_error() {
    echo -e "${RED}✗${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}!${NC} $1"
}

install_service() {
    echo "Installing Memory Agent as a launchd service..."
    
    # Ensure LaunchAgents directory exists
    mkdir -p "$LAUNCHD_DIR"
    
    # Ensure log directory exists
    mkdir -p "$HOME/Library/Logs/a2rchitech"
    
    # Update plist with current user's paths
    local temp_plist=$(mktemp)
    sed "s|/Users/macbook|$HOME|g" "$PLIST_FILE" > "$temp_plist"
    
    # Copy plist to LaunchAgents
    cp "$temp_plist" "$LAUNCHD_DIR/$LAUNCHD_LABEL.plist"
    rm "$temp_plist"
    
    # Load the service
    launchctl unload "$LAUNCHD_DIR/$LAUNCHD_LABEL.plist" 2>/dev/null || true
    launchctl load "$LAUNCHD_DIR/$LAUNCHD_LABEL.plist"
    
    print_status "Memory Agent installed and started"
    print_status "Service will start automatically at login"
    echo ""
    echo "To manage the service:"
    echo "  Start:  launchctl start $LAUNCHD_LABEL"
    echo "  Stop:   launchctl stop $LAUNCHD_LABEL"
    echo "  Status: launchctl list | grep $LAUNCHD_LABEL"
    echo ""
    print_status "Logs: $HOME/Library/Logs/a2rchitech/memory-agent.*.log"
}

uninstall_service() {
    echo "Uninstalling Memory Agent launchd service..."
    
    # Unload the service
    launchctl unload "$LAUNCHD_DIR/$LAUNCHD_LABEL.plist" 2>/dev/null || true
    
    # Remove plist
    rm -f "$LAUNCHD_DIR/$LAUNCHD_LABEL.plist"
    
    print_status "Memory Agent service removed"
    echo ""
    print_warning "Note: Memory data in ~/.a2rchitech/memory/ is preserved"
}

check_status() {
    echo "Checking Memory Agent service status..."
    echo ""
    
    if [ -f "$LAUNCHD_DIR/$LAUNCHD_LABEL.plist" ]; then
        print_status "Service is installed"
        
        if launchctl list | grep -q "$LAUNCHD_LABEL"; then
            print_status "Service is running"
        else
            print_warning "Service is installed but not running"
        fi
    else
        print_error "Service is not installed"
    fi
}

show_usage() {
    echo "Usage: $0 [install|uninstall|status]"
    echo ""
    echo "Commands:"
    echo "  install   - Install and start the Memory Agent as a launchd service"
    echo "  uninstall - Remove the Memory Agent launchd service"
    echo "  status    - Check if the service is installed and running"
    echo ""
}

# Main
case "${1:-}" in
    install)
        install_service
        ;;
    uninstall)
        uninstall_service
        ;;
    status)
        check_status
        ;;
    *)
        show_usage
        exit 1
        ;;
esac
