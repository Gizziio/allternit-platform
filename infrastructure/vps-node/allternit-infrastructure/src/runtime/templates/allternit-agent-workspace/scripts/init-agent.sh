#!/bin/bash
# ============================================================================
# A2R Agent Workspace - Initialization Script
# Sets up the isolated environment for agent execution
# ============================================================================

set -euo pipefail

# Configuration
readonly AGENT_ID="${AGENT_ID:-default}"
readonly AGENT_NAME="${AGENT_NAME:-A2R Agent}"
readonly MAX_CPU="${MAX_CPU:-2}"
readonly MAX_MEMORY="${MAX_MEMORY:-4G}"
readonly ENABLE_NETWORK="${ENABLE_NETWORK:-true}"
readonly SANDBOX_ENABLED="${SANDBOX_ENABLED:-true}"
readonly WORKSPACE_DIR="/home/agent/workspace"
readonly CONFIG_DIR="/home/agent/.config"
readonly CACHE_DIR="/home/agent/.cache"
readonly CHROMADB_DIR="/home/agent/.local/share/chromadb"

# Logging
log() {
    local level="$1"
    shift
    echo "[$(date -Iseconds)] [$level] [init-agent] $*" >&2
}

info() { log "INFO" "$@"; }
warn() { log "WARN" "$@"; }
error() { log "ERROR" "$@"; }
die() { error "$@"; exit 1; }

# ============================================================================
# User and Directory Setup
# ============================================================================
setup_user() {
    info "Setting up agent user environment..."
    
    # Ensure we're running as the agent user
    if [[ "$(id -u)" -eq 0 ]]; then
        die "This script must not run as root"
    fi
    
    # Create workspace directories
    mkdir -p \
        "${WORKSPACE_DIR}"/{input,output,temp,files,downloads,uploads,logs} \
        "${CONFIG_DIR}"/{chromium,firefox} \
        "${CACHE_DIR}"/{pip,npm,chromium,firefox} \
        "${CHROMADB_DIR}" \
        /tmp/agent
    
    # Set proper permissions
    chmod 755 "${WORKSPACE_DIR}"
    chmod 700 "${WORKSPACE_DIR}/temp"
    chmod 700 "${CACHE_DIR}"
    chmod 700 "${CONFIG_DIR}"
    
    info "Directory structure created"
}

# ============================================================================
# Resource Limits (cgroups v2)
# ============================================================================
setup_resource_limits() {
    info "Configuring resource limits..."
    
    local cgroup_path="/sys/fs/cgroup"
    local agent_cgroup="${cgroup_path}/agent-${AGENT_ID}"
    
    # Check if running in a container with cgroup access
    if [[ -f "${cgroup_path}/cgroup.controllers" ]]; then
        # Create cgroup for this agent
        mkdir -p "${agent_cgroup}" 2>/dev/null || true
        
        # Set CPU limit (convert cores to quota/period)
        local cpu_quota=$((MAX_CPU * 100000))
        echo "${cpu_quota} 100000" > "${agent_cgroup}/cpu.max" 2>/dev/null || warn "Could not set CPU limit"
        
        # Set memory limit
        local memory_bytes
        memory_bytes=$(numfmt --from=iec "${MAX_MEMORY}")
        echo "${memory_bytes}" > "${agent_cgroup}/memory.max" 2>/dev/null || warn "Could not set memory limit"
        
        # Set process limit
        echo "1000" > "${agent_cgroup}/pids.max" 2>/dev/null || warn "Could not set process limit"
        
        # Add current process to cgroup
        echo $$ > "${agent_cgroup}/cgroup.procs" 2>/dev/null || true
        
        info "Resource limits configured: CPU=${MAX_CPU}, Memory=${MAX_MEMORY}"
    else
        warn "cgroups v2 not available, using ulimit fallback"
        
        # Fallback to ulimit
        ulimit -u 1000           # Max processes
        ulimit -v $((4 * 1024 * 1024))  # Virtual memory (4GB)
        ulimit -m $((4 * 1024 * 1024))  # Resident memory (4GB)
        ulimit -f $((1024 * 1024))      # Max file size (1GB)
        ulimit -t $((3600 * 2))         # CPU time (2 hours)
    fi
}

# ============================================================================
# Browser Profile Setup
# ============================================================================
setup_browser_profiles() {
    info "Setting up browser profiles..."
    
    # Chromium profile
    local chromium_profile="${CONFIG_DIR}/chromium/Default"
    mkdir -p "${chromium_profile}"
    
    cat > "${CONFIG_DIR}/chromium/Default/Preferences" << 'EOF'
{
  "profile": {
    "content_settings": {
      "exceptions": {
        "notifications": {},
        "popups": {}
      }
    },
    "default_content_setting_values": {
      "notifications": 2,
      "popups": 2,
      "geolocation": 2,
      "media_stream_mic": 2,
      "media_stream_camera": 2
    }
  },
  "safebrowsing": {
    "enabled": false
  },
  "signin": {
    "allowed": false
  },
  "sync": {
    "disabled": true
  }
}
EOF
    
    # Firefox profile
    local firefox_profile="${CONFIG_DIR}/firefox/profiles/agent"
    mkdir -p "${firefox_profile}"
    
    cat > "${CONFIG_DIR}/firefox/profiles/agent/prefs.js" << 'EOF'
// A2R Agent Firefox Preferences
user_pref("app.update.enabled", false);
user_pref("browser.tabs.firefox-view", false);
user_pref("browser.startup.homepage", "about:blank");
user_pref("browser.newtabpage.enabled", false);
user_pref("browser.download.start_downloads_in_tmp_dir", true);
user_pref("browser.download.dir", "/home/agent/workspace/downloads");
user_pref("dom.webnotifications.enabled", false);
user_pref("geo.enabled", false);
user_pref("media.navigator.enabled", false);
user_pref("media.peerconnection.enabled", false);
user_pref("network.dns.disablePrefetch", true);
user_pref("network.prefetch-next", false);
user_pref("places.history.enabled", false);
user_pref("privacy.trackingprotection.enabled", true);
user_pref("signon.rememberSignons", false);
user_pref("toolkit.telemetry.enabled", false);
user_pref("datareporting.healthreport.uploadEnabled", false);
EOF
    
    # Create profiles.ini
    cat > "${CONFIG_DIR}/firefox/profiles.ini" << EOF
[General]
StartWithLastProfile=1

[Profile0]
Name=agent
IsRelative=1
Path=profiles/agent
EOF
    
    info "Browser profiles configured"
}

# ============================================================================
# ChromaDB Initialization
# ============================================================================
init_chromadb() {
    info "Initializing ChromaDB collections..."
    
    # Wait for ChromaDB to be ready
    local chroma_host="${CHROMADB_HOST:-vector-db}"
    local chroma_port="${CHROMADB_PORT:-8000}"
    local max_attempts=30
    local attempt=0
    
    while ! curl -sf "http://${chroma_host}:${chroma_port}/api/v1/heartbeat" > /dev/null 2>&1; do
        attempt=$((attempt + 1))
        if [[ $attempt -ge $max_attempts ]]; then
            warn "ChromaDB not available after ${max_attempts} attempts"
            return 1
        fi
        info "Waiting for ChromaDB... (${attempt}/${max_attempts})"
        sleep 2
    done
    
    # Create default collections via Python
    python3.11 << PYTHON
import sys
import chromadb
from chromadb.config import Settings

try:
    client = chromadb.HttpClient(
        host="${chroma_host}",
        port=${chroma_port},
        settings=Settings(allow_reset=True)
    )
    
    # Create collections if they don't exist
    collections = ["agent_memory", "task_context", "documents", "embeddings"]
    for coll_name in collections:
        try:
            client.get_collection(name=coll_name)
            print(f"Collection '{coll_name}' already exists")
        except:
            client.create_collection(
                name=coll_name,
                metadata={"agent_id": "${AGENT_ID}", "purpose": "agent_workspace"}
            )
            print(f"Created collection: {coll_name}")
    
    print("ChromaDB initialization complete")
    sys.exit(0)
except Exception as e:
    print(f"ChromaDB initialization failed: {e}", file=sys.stderr)
    sys.exit(1)
PYTHON
    
    if [[ $? -eq 0 ]]; then
        info "ChromaDB collections initialized"
    else
        warn "ChromaDB initialization failed, continuing without vector DB"
    fi
}

# ============================================================================
# Network Configuration
# ============================================================================
setup_network() {
    info "Configuring network access..."
    
    if [[ "${ENABLE_NETWORK}" == "false" ]]; then
        info "Network access is DISABLED"
        # Block all outbound connections except localhost
        if command -v iptables &> /dev/null && [[ $(id -u) -eq 0 ]]; then
            iptables -A OUTPUT -d 127.0.0.0/8 -j ACCEPT
            iptables -A OUTPUT -d 172.20.0.0/16 -j ACCEPT  # Internal network
            iptables -A OUTPUT -j DROP
        fi
    else
        info "Network access is ENABLED"
    fi
}

# ============================================================================
# Security Setup
# ============================================================================
setup_security() {
    info "Setting up security configuration..."
    
    # Create .bashrc with restricted PATH
    cat > /home/agent/.bashrc << 'EOF'
# A2R Agent Workspace - Restricted Environment
export PATH="/home/agent/.local/bin:/usr/local/bin:/usr/bin:/bin"
export HOME=/home/agent
export USER=agent
export AGENT_WORKSPACE=/home/agent/workspace

# Security settings
umask 077

# Aliases for safety
alias rm='rm -i'
alias cp='cp -i'
alias mv='mv -i'

# Disable history
unset HISTFILE

# Restricted functions
command_not_found_handle() {
    echo "Command not allowed: $1" >&2
    return 1
}
EOF
    
    # Create restricted .profile
    cat > /home/agent/.profile << 'EOF'
# A2R Agent Workspace Profile
if [ -n "$BASH_VERSION" ]; then
    if [ -f "$HOME/.bashrc" ]; then
        . "$HOME/.bashrc"
    fi
fi
EOF
    
    # Set proper permissions
    chmod 644 /home/agent/.bashrc /home/agent/.profile
    
    info "Security configuration applied"
}

# ============================================================================
# Sandbox Setup (Firejail)
# ============================================================================
setup_sandbox() {
    if [[ "${SANDBOX_ENABLED}" != "true" ]]; then
        info "Sandbox is DISABLED"
        return 0
    fi
    
    info "Setting up Firejail sandbox..."
    
    if ! command -v firejail &> /dev/null; then
        warn "Firejail not available, sandbox disabled"
        return 1
    fi
    
    # Verify firejail profile exists
    if [[ ! -f "/etc/firejail/a2r-agent.profile" ]]; then
        warn "Firejail profile not found, using default"
    fi
    
    info "Sandbox ready (Firejail enabled)"
}

# ============================================================================
# Environment Validation
# ============================================================================
validate_environment() {
    info "Validating environment..."
    
    # Check required tools
    local required_tools=("python3.11" "node" "npm" "git" "curl" "jq")
    for tool in "${required_tools[@]}"; do
        if ! command -v "$tool" &> /dev/null; then
            warn "Required tool not found: $tool"
        fi
    done
    
    # Check browser availability
    if command -v chromium &> /dev/null || command -v chromium-browser &> /dev/null; then
        info "Chromium: Available"
    else
        warn "Chromium: Not found"
    fi
    
    if command -v firefox &> /dev/null; then
        info "Firefox: Available"
    else
        warn "Firefox: Not found"
    fi
    
    # Check Playwright
    if [[ -d "/ms-playwright" ]]; then
        info "Playwright browsers: Available"
    else
        warn "Playwright browsers: Not found"
    fi
    
    # Check disk space
    local available_space
    available_space=$(df -BG "${WORKSPACE_DIR}" | awk 'NR==2 {print $4}' | tr -d 'G')
    if [[ "${available_space}" -lt 1 ]]; then
        warn "Low disk space: ${available_space}GB available"
    else
        info "Disk space: ${available_space}GB available"
    fi
    
    info "Environment validation complete"
}

# ============================================================================
# Write Status File
# ============================================================================
write_status() {
    local status_file="${WORKSPACE_DIR}/.agent-status.json"
    
    cat > "$status_file" << EOF
{
  "agent_id": "${AGENT_ID}",
  "status": "ready",
  "initialized_at": "$(date -Iseconds)",
  "version": "1.0.0",
  "configuration": {
    "max_cpu": "${MAX_CPU}",
    "max_memory": "${MAX_MEMORY}",
    "network_enabled": ${ENABLE_NETWORK},
    "sandbox_enabled": ${SANDBOX_ENABLED}
  },
  "paths": {
    "workspace": "${WORKSPACE_DIR}",
    "input": "${WORKSPACE_DIR}/input",
    "output": "${WORKSPACE_DIR}/output",
    "temp": "${WORKSPACE_DIR}/temp",
    "downloads": "${WORKSPACE_DIR}/downloads"
  }
}
EOF
    
    chmod 644 "$status_file"
}

# ============================================================================
# Main Initialization
# ============================================================================
main() {
    info "Starting A2R Agent Workspace initialization..."
    info "Agent ID: ${AGENT_ID}"
    info "Configuration: CPU=${MAX_CPU}, Memory=${MAX_MEMORY}, Network=${ENABLE_NETWORK}"
    
    setup_user
    setup_resource_limits
    setup_browser_profiles
    setup_network
    setup_security
    setup_sandbox
    init_chromadb
    validate_environment
    write_status
    
    info "Initialization complete!"
    
    # Execute the command passed as arguments, or default to healthcheck
    if [[ $# -gt 0 ]]; then
        exec "$@"
    else
        exec /usr/local/bin/healthcheck
    fi
}

# Run main function
main "$@"
