#!/usr/bin/env bash
#
# Allternit Gizzi Code Daemon Setup Wizard
#
# Installs gizzi-code as an always-on background service so cloud-domain
# routines and loops keep running when the desktop app is closed.
#
# This is an explicit opt-in step. If the user declines, local-domain
# schedules still work while gizzi-code or the desktop is running.
#
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../../.." && pwd)"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

print_header() {
  echo -e "${BLUE}"
  echo "╔════════════════════════════════════════════════════════════╗"
  echo "║      Allternit Gizzi Code Daemon Setup Wizard              ║"
  echo "╚════════════════════════════════════════════════════════════╝"
  echo -e "${NC}"
}

print_success() { echo -e "${GREEN}✓${NC} $1"; }
print_info()    { echo -e "${BLUE}ℹ${NC} $1"; }
print_warning() { echo -e "${YELLOW}⚠${NC} $1"; }
print_error()   { echo -e "${RED}✗${NC} $1"; }

ask_yes_no() {
  local prompt="$1"
  local default="${2:-N}"
  while true; do
    if [[ "$default" == "Y" ]]; then
      read -rp "$prompt [Y/n]: " answer
      answer="${answer:-Y}"
    else
      read -rp "$prompt [y/N]: " answer
      answer="${answer:-N}"
    fi
    case "$answer" in
      [Yy]* ) return 0;;
      [Nn]* ) return 1;;
      * ) echo "Please answer yes or no.";;
    esac
  done
}

prompt_secret() {
  local prompt="$1"
  local result
  while true; do
    read -rsp "$prompt: " result
    echo >&2
    if [[ -n "$result" ]]; then
      echo "$result"
      return 0
    fi
    print_error "This field is required." >&2
  done
}

prompt_with_default() {
  local prompt="$1"
  local default="$2"
  local result
  read -rp "$prompt [$default]: " result
  echo "${result:-$default}"
}

detect_platform() {
  case "$(uname -s)" in
    Darwin) echo "macos" ;;
    Linux)  echo "linux" ;;
    *)      echo "unsupported" ;;
  esac
}

find_gizzi_binary() {
  # 1. Check env override
  if [[ -n "${GIZZI_BINARY:-}" && -x "$GIZZI_BINARY" ]]; then
    echo "$GIZZI_BINARY"
    return 0
  fi

  # 2. Look next to bundled desktop resources (packaged app layout)
  local bundled
  bundled="${REPO_ROOT}/surfaces/allternit-desktop/resources/bin/gizzi-code"
  if [[ -x "$bundled" ]]; then
    echo "$bundled"
    return 0
  fi

  # 3. Look in gizzi-code dist
  local dist
  dist="${REPO_ROOT}/cmd/gizzi-code/dist/gizzi-code"
  if [[ -x "$dist" ]]; then
    echo "$dist"
    return 0
  fi

  # 4. Look on PATH
  if command -v gizzi-code >/dev/null 2>&1; then
    command -v gizzi-code
    return 0
  fi

  return 1
}

generate_password() {
  if command -v openssl >/dev/null 2>&1; then
    openssl rand -base64 32
  else
    LC_ALL=C tr -dc 'A-Za-z0-9' </dev/urandom | head -c 32
  fi
}

install_macos() {
  local binary="$1"
  local password="$2"
  local api_url="${3:-http://127.0.0.1:8013}"
  local log_dir="${HOME}/Library/Logs/Allternit"
  local plist_src="${SCRIPT_DIR}/com.allternit.gizzi.plist"
  local plist_dst="${HOME}/Library/LaunchAgents/com.allternit.gizzi.plist"

  mkdir -p "$log_dir"

  # Substitute template variables
  sed \
    -e "s|{{GIZZI_BINARY}}|${binary}|g" \
    -e "s|{{GIZZI_PASSWORD}}|${password}|g" \
    -e "s|{{ALLTERNIT_API_URL}}|${api_url}|g" \
    -e "s|{{LOG_DIR}}|${log_dir}|g" \
    "$plist_src" > "$plist_dst"

  chmod 644 "$plist_dst"

  # Unload first in case an older version exists
  launchctl unload "$plist_dst" 2>/dev/null || true
  launchctl load "$plist_dst"
  launchctl start com.allternit.gizzi || true

  print_success "LaunchAgent installed and started."
  print_info "Logs: ${log_dir}/gizzi-daemon.log"
}

install_linux() {
  local binary="$1"
  local password="$2"
  local api_url="${3:-http://127.0.0.1:8013}"
  local service_src="${SCRIPT_DIR}/allternit-gizzi.service"
  local service_dst="/etc/systemd/system/allternit-gizzi.service"
  local log_dir="/var/log/allternit-gizzi"

  if [[ "$EUID" -ne 0 ]]; then
    print_error "Linux install requires root. Re-run with sudo."
    return 1
  fi

  mkdir -p "$log_dir"

  sed \
    -e "s|{{GIZZI_BINARY}}|${binary}|g" \
    -e "s|{{GIZZI_PASSWORD}}|${password}|g" \
    -e "s|{{ALLTERNIT_API_URL}}|${api_url}|g" \
    "$service_src" > "$service_dst"

  chmod 644 "$service_dst"

  systemctl daemon-reload
  systemctl enable allternit-gizzi
  systemctl restart allternit-gizzi

  print_success "systemd service installed and started."
  print_info "Logs: ${log_dir}/gizzi-daemon.log"
}

verify_running() {
  local url="http://127.0.0.1:4096/health"
  for i in {1..10}; do
    if curl -fsS "$url" >/dev/null 2>&1; then
      print_success "Daemon is responding on ${url}"
      return 0
    fi
    sleep 1
  done
  print_warning "Daemon did not respond on ${url} yet. Check the logs above."
  return 1
}

main() {
  print_header

  local platform
  platform="$(detect_platform)"
  if [[ "$platform" == "unsupported" ]]; then
    print_error "Unsupported platform: $(uname -s). Only macOS and Linux are supported by this installer."
    exit 1
  fi

  echo "The Gizzi Code daemon runs scheduled jobs (routines/loops) even when"
  echo "the desktop app is closed. It is installed as a background service."
  echo ""

  if [[ "${GIZZI_DAEMON_UNATTENDED:-false}" != "true" ]]; then
    if ! ask_yes_no "Enable always-on Gizzi Code daemon?" "N"; then
      print_info "Skipped. You can re-run this wizard anytime."
      exit 0
    fi
  fi

  local binary
  if ! binary="$(find_gizzi_binary)"; then
    print_error "Could not find a gizzi-code binary."
    print_info "Build it with: cd cmd/gizzi-code && bun run build"
    exit 1
  fi
  print_info "Using binary: ${binary}"

  local password
  if [[ -n "${GIZZI_SERVER_PASSWORD:-}" ]]; then
    password="$GIZZI_SERVER_PASSWORD"
  else
    password="$(prompt_secret "Set a GIZZI_SERVER_PASSWORD for the daemon")"
  fi

  local api_url
  api_url="$(prompt_with_default "Allternit API URL" "http://127.0.0.1:8013")"
  export ALLTERNIT_API_URL="$api_url"

  case "$platform" in
    macos) install_macos "$binary" "$password" "$api_url" ;;
    linux) install_linux "$binary" "$password" "$api_url" ;;
  esac

  echo ""
  verify_running || true

  echo ""
  print_success "Setup complete."
  print_info "Manage the daemon:"
  if [[ "$platform" == "macos" ]]; then
    echo "  launchctl stop com.allternit.gizzi"
    echo "  launchctl start com.allternit.gizzi"
  else
    echo "  sudo systemctl stop allternit-gizzi"
    echo "  sudo systemctl start allternit-gizzi"
  fi
}

main "$@"
