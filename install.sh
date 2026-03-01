#!/bin/sh
# A2R (A2rchitect Runtime) Installer
# One-liner install: curl -fsSL https://raw.githubusercontent.com/a2rchitech/a2rchitech/main/install.sh | sh

set -e

# Configuration
REPO="a2rchitech/a2rchitech"
BINARY_NAME="a2r"
CLI_BINARY_NAME="a2rchitech"
INSTALL_DIR="${INSTALL_DIR:-/usr/local/bin}"
VERSION="${VERSION:-latest}"

# Colors (if terminal supports it)
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Detect if stdout is a terminal
if [ -t 1 ]; then
    HAS_COLOR=1
else
    HAS_COLOR=0
fi

print_error() {
    if [ "$HAS_COLOR" -eq 1 ]; then
        printf "%sError: %s%s\n" "$RED" "$1" "$NC" >&2
    else
        printf "Error: %s\n" "$1" >&2
    fi
}

print_success() {
    if [ "$HAS_COLOR" -eq 1 ]; then
        printf "%s✓ %s%s\n" "$GREEN" "$1" "$NC"
    else
        printf "✓ %s\n" "$1"
    fi
}

print_info() {
    if [ "$HAS_COLOR" -eq 1 ]; then
        printf "%s→ %s%s\n" "$BLUE" "$1" "$NC"
    else
        printf "→ %s\n" "$1"
    fi
}

print_warning() {
    if [ "$HAS_COLOR" -eq 1 ]; then
        printf "%s⚠ %s%s\n" "$YELLOW" "$1" "$NC"
    else
        printf "⚠ %s\n" "$1"
    fi
}

# Detect operating system
detect_os() {
    OS=$(uname -s | tr '[:upper:]' '[:lower:]')
    case "$OS" in
        linux)
            OS="linux"
            ;;
        darwin)
            OS="darwin"
            ;;
        mingw*|cygwin*|msys*|windows*)
            OS="windows"
            ;;
        *)
            print_error "Unsupported operating system: $OS"
            exit 1
            ;;
    esac
    echo "$OS"
}

# Detect architecture
detect_arch() {
    ARCH=$(uname -m)
    case "$ARCH" in
        x86_64|amd64)
            ARCH="x86_64"
            ;;
        arm64|aarch64)
            if [ "$(detect_os)" = "darwin" ]; then
                ARCH="universal"
            else
                ARCH="aarch64"
            fi
            ;;
        armv7l|armhf)
            ARCH="armv7"
            ;;
        *)
            print_error "Unsupported architecture: $ARCH"
            exit 1
            ;;
    esac
    echo "$ARCH"
}

# Get the latest release version from GitHub API
get_latest_version() {
    if command -v curl >/dev/null 2>&1; then
        curl -s "https://api.github.com/repos/$REPO/releases/latest" | \
            grep '"tag_name":' | \
            sed -E 's/.*"v?([^"]+)".*/\1/'
    elif command -v wget >/dev/null 2>&1; then
        wget -qO- "https://api.github.com/repos/$REPO/releases/latest" | \
            grep '"tag_name":' | \
            sed -E 's/.*"v?([^"]+)".*/\1/'
    else
        print_error "Either curl or wget is required"
        exit 1
    fi
}

# Download file with fallback to wget
download() {
    url="$1"
    output="$2"
    if command -v curl >/dev/null 2>&1; then
        curl -fsSL "$url" -o "$output"
    elif command -v wget >/dev/null 2>&1; then
        wget -q "$url" -O "$output"
    else
        print_error "Either curl or wget is required"
        exit 1
    fi
}

# Main installation function
main() {
    print_info "A2R (A2rchitect Runtime) Installer"
    print_info "====================================="
    echo

    # Detect platform
    OS=$(detect_os)
    ARCH=$(detect_arch)
    
    print_info "Detected platform: $OS ($ARCH)"

    # Determine version
    if [ "$VERSION" = "latest" ]; then
        print_info "Checking for latest version..."
        VERSION=$(get_latest_version)
        if [ -z "$VERSION" ]; then
            print_error "Could not determine latest version"
            exit 1
        fi
    fi
    print_info "Installing version: $VERSION"

    # Create temporary directory
    TMP_DIR=$(mktemp -d)
    # shellcheck disable=SC2064
    trap "rm -rf $TMP_DIR" EXIT

    # Construct download URL
    if [ "$OS" = "windows" ]; then
        FILENAME="a2r-${VERSION}-${ARCH}-${OS}.zip"
    else
        FILENAME="a2r-${VERSION}-${ARCH}-${OS}.tar.gz"
    fi
    
    URL="https://github.com/${REPO}/releases/download/v${VERSION}/${FILENAME}"
    
    print_info "Downloading from: $URL"
    
    # Download
    if ! download "$URL" "$TMP_DIR/$FILENAME"; then
        print_error "Failed to download $FILENAME"
        print_info "Make sure version $VERSION exists for your platform ($OS/$ARCH)"
        exit 1
    fi
    
    print_success "Download complete"

    # Extract
    print_info "Extracting..."
    cd "$TMP_DIR"
    
    case "$FILENAME" in
        *.tar.gz)
            tar xzf "$FILENAME"
            EXTRACTED_DIR=$(tar tzf "$FILENAME" | head -1 | cut -f1 -d"/")
            ;;
        *.zip)
            if command -v unzip >/dev/null 2>&1; then
                unzip -q "$FILENAME"
                EXTRACTED_DIR=$(unzip -Z -1 "$FILENAME" | head -1 | cut -f1 -d"/")
            else
                print_error "unzip is required to extract .zip files"
                exit 1
            fi
            ;;
    esac

    # Find binary
    if [ -f "$EXTRACTED_DIR/a2r" ]; then
        BINARY_PATH="$EXTRACTED_DIR/a2r"
    elif [ -f "$EXTRACTED_DIR/a2rchitech" ]; then
        BINARY_PATH="$EXTRACTED_DIR/a2rchitech"
    elif [ -f "$EXTRACTED_DIR/a2r.exe" ]; then
        BINARY_PATH="$EXTRACTED_DIR/a2r.exe"
    else
        print_error "Could not find binary in archive"
        exit 1
    fi

    print_success "Extracted to: $BINARY_PATH"

    # Install
    print_info "Installing to $INSTALL_DIR..."
    
    # Check if we need sudo
    if [ -w "$INSTALL_DIR" ]; then
        SUDO=""
    else
        if command -v sudo >/dev/null 2>&1; then
            SUDO="sudo"
            print_warning "Installation requires elevated permissions"
        else
            print_error "Cannot write to $INSTALL_DIR and sudo is not available"
            exit 1
        fi
    fi

    # Copy binary
    if [ "$OS" = "windows" ]; then
        $SUDO cp "$BINARY_PATH" "$INSTALL_DIR/${BINARY_NAME}.exe"
        chmod +x "$INSTALL_DIR/${BINARY_NAME}.exe"
    else
        $SUDO cp "$BINARY_PATH" "$INSTALL_DIR/$BINARY_NAME"
        $SUDO chmod +x "$INSTALL_DIR/$BINARY_NAME"
    fi

    print_success "Installed to $INSTALL_DIR/$BINARY_NAME"

    # Verify installation
    if command -v "$BINARY_NAME" >/dev/null 2>&1; then
        INSTALLED_VERSION=$("$BINARY_NAME" --version 2>/dev/null || echo "unknown")
        print_success "A2R installed successfully! ($INSTALLED_VERSION)"
    else
        print_warning "A2R installed but not in PATH"
        print_info "Add $INSTALL_DIR to your PATH or run: export PATH=\"$INSTALL_DIR:\$PATH\""
    fi

    # Initialize A2R if running interactively
    if [ -t 0 ] && [ -t 1 ]; then
        echo
        print_info "Would you like to initialize A2R now? (y/n)"
        read -r response
        case "$response" in
            [Yy]*)
                print_info "Initializing A2R..."
                if "$BINARY_NAME" init 2>/dev/null; then
                    print_success "A2R initialized successfully!"
                else
                    print_warning "Could not initialize A2R. Run 'a2r init' manually."
                fi
                ;;
            *)
                print_info "Skipped initialization. Run 'a2r init' when ready."
                ;;
        esac
    fi

    echo
    print_success "Installation complete!"
    print_info "Get started with: a2r --help"
}

# Handle arguments
while [ $# -gt 0 ]; do
    case "$1" in
        --version|-v)
            VERSION="$2"
            shift 2
            ;;
        --install-dir|-d)
            INSTALL_DIR="$2"
            shift 2
            ;;
        --help|-h)
            echo "A2R (A2rchitect Runtime) Installer"
            echo ""
            echo "Usage: install.sh [OPTIONS]"
            echo ""
            echo "Options:"
            echo "  -v, --version VERSION    Install specific version (default: latest)"
            echo "  -d, --install-dir DIR    Install directory (default: /usr/local/bin)"
            echo "  -h, --help               Show this help message"
            echo ""
            echo "Environment variables:"
            echo "  VERSION                  Version to install"
            echo "  INSTALL_DIR              Installation directory"
            exit 0
            ;;
        *)
            print_error "Unknown option: $1"
            exit 1
            ;;
    esac
done

# Run main function
main
