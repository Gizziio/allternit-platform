#!/bin/bash
#
# Gizzi Code Installer
# Usage: curl -fsSL https://gizzi.sh/install.sh | bash
#

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m' # No Color

# Configuration
REPO="a2r/gizzi-code"
INSTALL_DIR="${INSTALL_DIR:-$HOME/.local/bin}"
VERSION="${VERSION:-latest}"

# Detect platform
detect_platform() {
    local platform
    platform="$(uname -s | tr '[:upper:]' '[:lower:]')"
    
    case "$platform" in
        linux)
            echo "linux"
            ;;
        darwin)
            echo "macos"
            ;;
        mingw*|msys*|cygwin*)
            echo "windows"
            ;;
        *)
            echo "unsupported"
            ;;
    esac
}

# Detect architecture
detect_arch() {
    local arch
    arch="$(uname -m)"
    
    case "$arch" in
        x86_64|amd64)
            echo "x64"
            ;;
        arm64|aarch64)
            echo "arm64"
            ;;
        *)
            echo "unsupported"
            ;;
    esac
}

# Print banner
print_banner() {
    echo "${CYAN}"
    echo "   ╔═══════════════════════════════════════════╗"
    echo "   ║                                           ║"
    echo "   ║   ██████╗ ██╗███████╗███████╗██╗         ║"
    echo "   ║  ██╔════╝ ██║╚══███╔╝╚══███╔╝██║         ║"
    echo "   ║  ██║  ███╗██║  ███╔╝   ███╔╝ ██║         ║"
    echo "   ║  ██║   ██║██║ ███╔╝   ███╔╝  ██║         ║"
    echo "   ║  ╚██████╔╝██║███████╗███████╗██║         ║"
    echo "   ║   ╚═════╝ ╚═╝╚══════╝╚══════╝╚═╝         ║"
    echo "   ║                                           ║"
    echo "   ║        AI Terminal Interface              ║"
    echo "   ║                                           ║"
    echo "   ╚═══════════════════════════════════════════╝"
    echo "${NC}"
}

# Check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Download file
download() {
    local url="$1"
    local output="$2"
    
    if command_exists curl; then
        curl -fsSL "$url" -o "$output"
    elif command_exists wget; then
        wget -q "$url" -O "$output"
    else
        echo "${RED}Error: curl or wget is required${NC}"
        exit 1
    fi
}

# Install via npm
install_npm() {
    echo "${YELLOW}Installing via npm...${NC}"
    
    if ! command_exists npm; then
        echo "${RED}Error: npm not found. Please install Node.js first:${NC}"
        echo "  https://nodejs.org/"
        exit 1
    fi
    
    npm install -g @a2r/gizzi-code
}

# Install binary directly
install_binary() {
    local platform="$1"
    local arch="$2"
    local bin_name="gizzi-code-${platform}"
    
    if [ "$platform" = "windows" ]; then
        bin_name="gizzi-code-win.exe"
    fi
    
    local download_url
    if [ "$VERSION" = "latest" ]; then
        download_url="https://github.com/${REPO}/releases/latest/download/${bin_name}"
    else
        download_url="https://github.com/${REPO}/releases/download/${VERSION}/${bin_name}"
    fi
    
    echo "${YELLOW}Downloading Gizzi Code for ${platform}-${arch}...${NC}"
    
    # Create install directory
    mkdir -p "$INSTALL_DIR"
    
    local temp_file
    temp_file="$(mktemp)"
    
    # Download
    if ! download "$download_url" "$temp_file"; then
        echo "${RED}Error: Failed to download binary${NC}"
        echo "Falling back to npm installation..."
        install_npm
        return
    fi
    
    # Install as 'gizzi' command
    local target_path="${INSTALL_DIR}/gizzi"
    if [ "$platform" = "windows" ]; then
        target_path="${target_path}.exe"
    fi
    
    mv "$temp_file" "$target_path"
    chmod +x "$target_path"
    
    echo "${GREEN}✓ Gizzi installed to ${target_path}${NC}"
}

# Add to PATH
add_to_path() {
    local shell_rc=""
    local path_export="export PATH=\"\$HOME/.local/bin:\$PATH\""
    
    case "$SHELL" in
        */zsh)
            shell_rc="$HOME/.zshrc"
            ;;
        */bash)
            shell_rc="$HOME/.bashrc"
            ;;
        */fish)
            shell_rc="$HOME/.config/fish/config.fish"
            path_export="set -x PATH \$HOME/.local/bin \$PATH"
            ;;
    esac
    
    if [ -n "$shell_rc" ] && [ -f "$shell_rc" ]; then
        if ! grep -q "$INSTALL_DIR" "$shell_rc" 2>/dev/null; then
            echo "" >> "$shell_rc"
            echo "# Added by Gizzi installer" >> "$shell_rc"
            echo "$path_export" >> "$shell_rc"
            echo "${YELLOW}Added $INSTALL_DIR to PATH in $shell_rc${NC}"
            echo "${YELLOW}Please restart your terminal or run: source $shell_rc${NC}"
        fi
    fi
}

# Verify installation
verify_installation() {
    echo ""
    echo "${BLUE}Verifying installation...${NC}"
    
    if command_exists gizzi; then
        echo "${GREEN}✓ Gizzi is installed!${NC}"
        gizzi --version 2>/dev/null || true
        return 0
    else
        echo "${YELLOW}⚠ Gizzi installed but not in PATH${NC}"
        echo "   Add this to your shell profile:"
        echo "   export PATH=\"\$HOME/.local/bin:\$PATH\""
        return 1
    fi
}

# Print post-install instructions
print_post_install() {
    echo ""
    echo "${GREEN}${BOLD}✓ Installation complete!${NC}"
    echo ""
    echo "${BOLD}Get started:${NC}"
    echo "  ${CYAN}gizzi${NC}              Start the TUI"
    echo "  ${CYAN}gizzi --help${NC}       Show all commands"
    echo "  ${CYAN}gizzi --version${NC}    Check version"
    echo ""
    echo "${BOLD}Documentation:${NC}"
    echo "  ${BLUE}https://docs.gizzi.sh${NC}"
    echo "  ${BLUE}https://github.com/a2r/gizzi-code${NC}"
    echo ""
}

# Main
main() {
    print_banner
    
    local platform
    local arch
    
    platform="$(detect_platform)"
    arch="$(detect_arch)"
    
    if [ "$platform" = "unsupported" ]; then
        echo "${RED}Error: Unsupported platform${NC}"
        exit 1
    fi
    
    if [ "$arch" = "unsupported" ]; then
        echo "${YELLOW}Warning: Unsupported architecture, trying anyway...${NC}"
    fi
    
    echo "Platform: $platform"
    echo "Architecture: $arch"
    echo "Install directory: $INSTALL_DIR"
    echo ""
    
    # Check if already installed
    if command_exists gizzi; then
        local current_version
        current_version=$(gizzi --version 2>/dev/null | head -1 || echo "unknown")
        echo "${YELLOW}Gizzi is already installed: $current_version${NC}"
        echo "Location: $(command -v gizzi)"
        echo ""
        read -p "Reinstall/Update? [y/N] " -n 1 -r
        echo ""
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            echo "Installation cancelled."
            print_post_install
            exit 0
        fi
    fi
    
    # Install
    if command_exists npm; then
        echo "${BLUE}Node.js detected. Installing via npm...${NC}"
        install_npm
    else
        install_binary "$platform" "$arch"
        add_to_path
    fi
    
    verify_installation
    print_post_install
}

# Parse arguments
while [ $# -gt 0 ]; do
    case "$1" in
        --version)
            VERSION="$2"
            shift 2
            ;;
        --install-dir)
            INSTALL_DIR="$2"
            shift 2
            ;;
        --help)
            echo "Gizzi Code Installer"
            echo ""
            echo "Usage:"
            echo "  curl -fsSL https://gizzi.sh/install.sh | bash"
            echo ""
            echo "Options:"
            echo "  --version <ver>      Install specific version (e.g., v1.0.0)"
            echo "  --install-dir <dir>  Custom installation directory (default: ~/.local/bin)"
            echo "  --help               Show this help"
            echo ""
            echo "Alternative installation methods:"
            echo "  npm install -g @a2r/gizzi-code"
            echo "  brew install --cask gizzi-code"
            echo "  winget install A2R.GizziCode"
            exit 0
            ;;
        *)
            shift
            ;;
    esac
done

main
