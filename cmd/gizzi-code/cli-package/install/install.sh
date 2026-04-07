#!/bin/bash
#
# Gizzi Code Installer
# Usage: curl -fsSL https://gizzi.sh/install | bash
#

set -e

# =============================================================================
# BRAND COLORS (Turso-inspired)
# =============================================================================
RESET='\033[0m'
BOLD='\033[1m'
DIM='\033[2m'

# Primary brand colors
BRIGHT_BLUE='\033[38;5;39m'      # Main brand color
CYAN='\033[38;5;51m'             # Secondary accent
MAGENTA='\033[38;5;201m'         # Highlight
GREEN='\033[38;5;82m'            # Success
YELLOW='\033[38;5;220m'          # Warning
RED='\033[38;5;196m'             # Error
ORANGE='\033[38;5;208m'          # Accent

# Background colors (for progress bars)
BG_BLUE='\033[48;5;39m'
BG_GREEN='\033[48;5;82m'

# =============================================================================
# CONFIGURATION
# =============================================================================
REPO="Gizziio/gizzi-code"
INSTALL_DIR="${INSTALL_DIR:-$HOME/.local/bin}"
VERSION="${VERSION:-latest}"
GITHUB_API="https://api.github.com/repos/${REPO}"

# =============================================================================
# ASCII ART BANNER
# =============================================================================
print_banner() {
    printf "${BRIGHT_BLUE}${BOLD}
    ██████╗ ██╗███████╗███████╗██╗    ██████╗ ██████╗ ██████╗ ███████╗
   ██╔════╝ ██║╚══███╔╝╚══███╔╝██║   ██╔════╝██╔═══██╗██╔══██╗██╔════╝
   ██║  ███╗██║  ███╔╝   ███╔╝ ██║   ██║     ██║   ██║██║  ██║█████╗  
   ██║   ██║██║ ███╔╝   ███╔╝  ██║   ██║     ██║   ██║██║  ██║██╔══╝  
   ╚██████╔╝██║███████╗███████╗██║   ╚██████╗╚██████╔╝██████╔╝███████╗
    ╚═════╝ ╚═╝╚══════╝╚══════╝╚═╝    ╚═════╝ ╚═════╝ ╚═════╝ ╚══════╝
${RESET}\n"
    printf "${DIM}              AI Terminal Interface for the A2R Ecosystem${RESET}\n\n"
}

# =============================================================================
# UTILITY FUNCTIONS
# =============================================================================

# Print with color
print_color() {
    local color="$1"
    local message="$2"
    printf "${color}${message}${RESET}\n"
}

# Print step with progress indicator
print_step() {
    local step="$1"
    local message="$2"
    printf "${BRIGHT_BLUE}●${RESET} ${BOLD}%s${RESET} %s\n" "$step" "$message"
}

# Print success checkmark
print_success() {
    printf "${GREEN}✓${RESET} %s\n" "$1"
}

# Print error X
print_error() {
    printf "${RED}✗${RESET} %s\n" "$1" >&2
}

# Print warning
print_warning() {
    printf "${YELLOW}⚠${RESET} %s\n" "$1"
}

# Print info bullet
print_info() {
    printf "${CYAN}ℹ${RESET} %s\n" "$1"
}

# Animated spinner for long operations
spinner() {
    local pid=$1
    local message="$2"
    local spin='⣾⣽⣻⢿⡿⣟⣯⣷'
    local i=0
    
    printf "${DIM}%s${RESET} " "$message"
    while kill -0 $pid 2>/dev/null; do
        i=$(( (i+1) % 8 ))
        printf "\r${BRIGHT_BLUE}%s${RESET} ${DIM}%s${RESET} " "${spin:$i:1}" "$message"
        sleep 0.1
    done
    printf "\r${GREEN}✓${RESET} %s\n" "$message"
}

# Progress bar
progress_bar() {
    local current=$1
    local total=$2
    local width=40
    local percentage=$((current * 100 / total))
    local filled=$((current * width / total))
    local empty=$((width - filled))
    
    printf "\r${DIM}[${RESET}"
    printf "${BG_BLUE}"
    printf "%${filled}s" | tr ' ' ' '
    printf "${RESET}"
    printf "%${empty}s" | tr ' ' '─'
    printf "${DIM}]${RESET} ${BRIGHT_BLUE}%3d%%${RESET}" "$percentage"
}

# =============================================================================
# PLATFORM DETECTION
# =============================================================================

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
            print_error "Unsupported platform: $platform"
            exit 1
            ;;
    esac
}

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
            print_warning "Unknown architecture: $arch, defaulting to x64"
            echo "x64"
            ;;
    esac
}

# =============================================================================
# DEPENDENCY CHECKS
# =============================================================================

check_dependencies() {
    print_step "Checking" "dependencies..."
    
    if command -v curl >/dev/null 2>&1; then
        DOWNLOADER="curl"
        print_success "curl found"
    elif command -v wget >/dev/null 2>&1; then
        DOWNLOADER="wget"
        print_success "wget found"
    else
        print_error "Neither curl nor wget found. Please install one of them."
        exit 1
    fi
}

# =============================================================================
# DOWNLOAD FUNCTIONS
# =============================================================================

download_file() {
    local url="$1"
    local output="$2"
    
    if [ "$DOWNLOADER" = "curl" ]; then
        curl -fsSL -o "$output" "$url" 2>&1
    else
        wget -q -O "$output" "$url" 2>&1
    fi
}

download_with_progress() {
    local url="$1"
    local output="$2"
    
    if [ "$DOWNLOADER" = "curl" ]; then
        # Get file size first
        local size
        size=$(curl -sI "$url" | grep -i content-length | awk '{print $2}' | tr -d '\r')
        
        if [ -n "$size" ]; then
            # Download with progress
            curl -fsSL --progress-bar -o "$output" "$url" 2>&1 | \
                while read -r line; do
                    # Parse curl progress
                    if echo "$line" | grep -q '[0-9]\+\.[0-9]\+'; then
                        local percent
                        percent=$(echo "$line" | grep -o '[0-9]\+\.[0-9]\+' | head -1 | cut -d. -f1)
                        if [ -n "$percent" ]; then
                            progress_bar "$percent" 100
                        fi
                    fi
                done
            printf "\n"
        else
            curl -fsSL -o "$output" "$url"
        fi
    else
        wget -q --show-progress -O "$output" "$url" 2>&1
    fi
}

# =============================================================================
# VERSION FUNCTIONS
# =============================================================================

get_latest_version() {
    print_step "Fetching" "latest version..."
    
    local version
    version=$(curl -s "$GITHUB_API/releases/latest" | grep '"tag_name":' | sed -E 's/.*"([^"]+)".*/\1/')
    
    if [ -z "$version" ]; then
        print_error "Failed to fetch latest version"
        exit 1
    fi
    
    print_success "Latest version: ${BRIGHT_BLUE}${version}${RESET}"
    echo "$version"
}

# =============================================================================
# INSTALLATION METHODS
# =============================================================================

install_via_npm() {
    print_step "Installing" "via npm..."
    
    if ! command -v npm >/dev/null 2>&1; then
        print_error "npm not found. Please install Node.js first:"
        print_info "https://nodejs.org/"
        return 1
    fi
    
    # Run npm install in background with spinner
    npm install -g @gizzi/gizzi-code >/dev/null 2>&1 &
    local pid=$!
    spinner $pid "Installing via npm..."
    
    wait $pid
    if [ $? -eq 0 ]; then
        print_success "Successfully installed via npm"
        return 0
    else
        print_error "npm installation failed"
        return 1
    fi
}

install_binary() {
    local platform="$1"
    local arch="$2"
    local version="$3"
    
    print_step "Installing" "binary for ${CYAN}${platform}-${arch}${RESET}..."
    
    # Determine binary name
    local bin_name="gizzi-code-${version}-${platform}-${arch}"
    if [ "$platform" = "windows" ]; then
        bin_name="${bin_name}.exe"
    fi
    
    local download_url
    if [ "$version" = "latest" ]; then
        download_url="https://github.com/${REPO}/releases/latest/download/${bin_name}"
    else
        download_url="https://github.com/${REPO}/releases/download/${version}/${bin_name}"
    fi
    
    print_info "Downloading from: ${DIM}${download_url}${RESET}"
    
    # Create install directory
    mkdir -p "$INSTALL_DIR"
    
    # Download to temp file
    local temp_file
    temp_file="$(mktemp)"
    
    if ! download_file "$download_url" "$temp_file"; then
        print_error "Failed to download binary"
        rm -f "$temp_file"
        return 1
    fi
    
    # Install
    local target_path="${INSTALL_DIR}/gizzi-code"
    if [ "$platform" = "windows" ]; then
        target_path="${target_path}.exe"
    fi
    
    mv "$temp_file" "$target_path"
    chmod +x "$target_path"
    
    print_success "Binary installed to ${CYAN}${target_path}${RESET}"
}

# =============================================================================
# PATH SETUP
# =============================================================================

add_to_path() {
    print_step "Configuring" "PATH..."
    
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
            printf "\n# Added by Gizzi Code installer\n%s\n" "$path_export" >> "$shell_rc"
            print_success "Added ${CYAN}${INSTALL_DIR}${RESET} to PATH in ${CYAN}${shell_rc}${RESET}"
            print_warning "Please restart your terminal or run: ${BOLD}source ${shell_rc}${RESET}"
        else
            print_info "${INSTALL_DIR} already in PATH"
        fi
    fi
}

# =============================================================================
# VERIFICATION
# =============================================================================

verify_installation() {
    print_step "Verifying" "installation..."
    
    if command -v gizzi-code >/dev/null 2>&1; then
        print_success "gizzi-code is installed!"
        local version
        version=$(gizzi-code --version 2>/dev/null || echo "unknown")
        print_info "Version: ${BRIGHT_BLUE}${version}${RESET}"
        return 0
    else
        print_warning "gizzi-code installed but not in PATH"
        print_info "Add this to your shell profile:"
        print_color "$CYAN" "  export PATH=\"\$HOME/.local/bin:\$PATH\""
        return 1
    fi
}

# =============================================================================
# POST-INSTALL
# =============================================================================

print_post_install() {
    printf "\n"
    printf "${GREEN}${BOLD}╔══════════════════════════════════════════════════════════════╗${RESET}\n"
    printf "${GREEN}${BOLD}║                                                              ║${RESET}\n"
    printf "${GREEN}${BOLD}║${RESET}   ${BRIGHT_BLUE}Installation Complete!${RESET}                                    ${GREEN}${BOLD}║${RESET}\n"
    printf "${GREEN}${BOLD}║                                                              ║${RESET}\n"
    printf "${GREEN}${BOLD}╚══════════════════════════════════════════════════════════════╝${RESET}\n"
    printf "\n"
    
    printf "${BOLD}Get started:${RESET}\n"
    printf "  ${CYAN}gizzi-code${RESET}              Start the TUI\n"
    printf "  ${CYAN}gizzi-code --help${RESET}       Show all commands\n"
    printf "  ${CYAN}gizzi-code --version${RESET}    Check version\n"
    printf "\n"
    
    printf "${BOLD}Documentation:${RESET}\n"
    printf "  ${BRIGHT_BLUE}https://docs.gizzi.sh${RESET}\n"
    printf "  ${BRIGHT_BLUE}https://github.com/Gizziio/gizzi-code${RESET}\n"
    printf "\n"
    
    printf "${DIM}Need help? Run: gizzi-code --help${RESET}\n"
    printf "\n"
}

# =============================================================================
# MAIN
# =============================================================================

main() {
    # Clear screen for clean install experience (optional)
    # clear
    
    print_banner
    
    # Parse arguments
    while [[ $# -gt 0 ]]; do
        case "$1" in
            --version)
                VERSION="$2"
                shift 2
                ;;
            --install-dir)
                INSTALL_DIR="$2"
                shift 2
                ;;
            --help|-h)
                printf "Gizzi Code Installer\n\n"
                printf "Usage: %s [options]\n\n" "$0"
                printf "Options:\n"
                printf "  --version <version>   Install specific version\n"
                printf "  --install-dir <dir>   Custom install directory\n"
                printf "  --help, -h            Show this help\n"
                exit 0
                ;;
            *)
                shift
                ;;
        esac
    done
    
    # Detect platform
    local platform
    local arch
    
    platform="$(detect_platform)"
    arch="$(detect_arch)"
    
    print_info "Platform: ${CYAN}${platform}${RESET}"
    print_info "Architecture: ${CYAN}${arch}${RESET}"
    print_info "Install directory: ${CYAN}${INSTALL_DIR}${RESET}"
    printf "\n"
    
    # Check dependencies
    check_dependencies
    printf "\n"
    
    # Get version
    local target_version
    if [ "$VERSION" = "latest" ]; then
        target_version="$(get_latest_version)"
    else
        target_version="$VERSION"
        print_info "Installing version: ${BRIGHT_BLUE}${target_version}${RESET}"
    fi
    printf "\n"
    
    # Check if already installed
    if command -v gizzi-code >/dev/null 2>&1; then
        local current_version
        current_version=$(gizzi-code --version 2>/dev/null | head -1 || echo "unknown")
        printf "${YELLOW}⚠ Gizzi Code is already installed: ${BRIGHT_BLUE}%s${RESET}\n" "$current_version"
        print_info "Location: $(command -v gizzi-code)"
        printf "\n"
        printf "Reinstall/Update? [y/N] "
        read -r REPLY
        printf "\n"
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            print_info "Installation cancelled."
            print_post_install
            exit 0
        fi
    fi
    
    # Install
    local install_success=false
    
    if command -v npm >/dev/null 2>&1; then
        if install_via_npm; then
            install_success=true
        fi
    fi
    
    if [ "$install_success" = false ]; then
        install_binary "$platform" "$arch" "$target_version"
        add_to_path
    fi
    
    printf "\n"
    verify_installation
    printf "\n"
    
    print_post_install
}

# Run main
main "$@"
