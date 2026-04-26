#!/bin/bash
#
# Install Allternit Global Command
#
# This script adds the allternit command to your shell PATH
#

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
Allternit_BIN="$PROJECT_ROOT/bin"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

print_success() {
    echo -e "${GREEN}[✓]${NC} $1"
}

print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[!]${NC} $1"
}

print_error() {
    echo -e "${RED}[✗]${NC} $1"
}

print_cmd() {
    echo -e "${CYAN}$1${NC}"
}

# Detect shell
detect_shell() {
    if [ -n "$ZSH_VERSION" ]; then
        echo "zsh"
    elif [ -n "$BASH_VERSION" ]; then
        echo "bash"
    else
        echo "unknown"
    fi
}

# Get shell profile file
get_profile_file() {
    local shell=$1
    case $shell in
        zsh)
            if [ -f "$HOME/.zshrc" ]; then
                echo "$HOME/.zshrc"
            elif [ -f "$HOME/.zprofile" ]; then
                echo "$HOME/.zprofile"
            else
                echo "$HOME/.zshrc"
            fi
            ;;
        bash)
            if [ -f "$HOME/.bashrc" ]; then
                echo "$HOME/.bashrc"
            elif [ -f "$HOME/.bash_profile" ]; then
                echo "$HOME/.bash_profile"
            else
                echo "$HOME/.bashrc"
            fi
            ;;
        *)
            echo ""
            ;;
    esac
}

# Main installation
main() {
    echo ""
    echo "╔════════════════════════════════════════════════════════════════╗"
    echo "║           Allternit Command Installation                             ║"
    echo "╚════════════════════════════════════════════════════════════════╝"
    echo ""
    
    # Check if allternit exists
    if [ ! -f "$Allternit_BIN/allternit" ]; then
        print_error "allternit command not found at $Allternit_BIN/allternit"
        exit 1
    fi
    
    # Make sure it's executable
    chmod +x "$Allternit_BIN/allternit"
    print_success "allternit command is executable"
    
    # Detect shell
    local shell=$(detect_shell)
    print_status "Detected shell: $shell"
    
    # Get profile file
    local profile=$(get_profile_file "$shell")
    
    if [ -z "$profile" ]; then
        print_warning "Could not detect shell profile"
        echo ""
        echo "Please manually add the following to your shell profile:"
        echo ""
        print_cmd "export PATH=\"$Allternit_BIN:\$PATH\""
        echo ""
        exit 0
    fi
    
    print_status "Shell profile: $profile"
    
    # Check if already in PATH
    if echo "$PATH" | grep -q "$Allternit_BIN"; then
        print_success "Allternit bin directory is already in PATH"
        echo ""
        echo "You can now use the 'allternit' command:"
        echo ""
        print_cmd "  allternit --help"
        print_cmd "  allternit start"
        print_cmd "  allternit status"
        echo ""
        exit 0
    fi
    
    # Check if already in profile
    if grep -q "$Allternit_BIN" "$profile" 2>/dev/null; then
        print_warning "Allternit bin directory is already in $profile"
        print_status "Please reload your shell:"
        echo ""
        print_cmd "  source $profile"
        echo ""
        exit 0
    fi
    
    # Add to profile
    echo "" >> "$profile"
    echo "# allternit Platform" >> "$profile"
    echo "export PATH=\"$Allternit_BIN:\$PATH\"" >> "$profile"
    
    print_success "Added Allternit to $profile"
    echo ""
    echo "╔════════════════════════════════════════════════════════════════╗"
    echo "║           Installation Complete!                               ║"
    echo "╚════════════════════════════════════════════════════════════════╝"
    echo ""
    echo "Reload your shell to use the 'allternit' command:"
    echo ""
    print_cmd "  source $profile"
    echo ""
    echo "Or open a new terminal window."
    echo ""
    echo "Then you can use:"
    echo ""
    print_cmd "  allternit --help      # Show help"
    print_cmd "  allternit start       # Start the platform"
    print_cmd "  allternit status      # Check service status"
    print_cmd "  allternit logs        # View logs"
    print_cmd "  allternit open        # Open UI in browser"
    echo ""
}

main "$@"
