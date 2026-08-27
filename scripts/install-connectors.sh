#!/usr/bin/env bash
# =============================================================================
# ALLTERNIT CONNECTORS — UNIFIED INSTALLER
# =============================================================================
# One-command onboarding for the three first-party connectors:
#   - Allternit Mail (services/mailflare on the user's Cloudflare account)
#   - Gmail (open-connector sidecar + Google OAuth)
#   - Google Drive (open-connector sidecar + Google OAuth)
#
# What this script does:
#   1. Preflight-checks the local checkout.
#   2. Starts the open-connector sidecar if it is not running.
#   3. Runs services/mailflare/setup.sh when Allternit Mail is not configured.
#   4. Runs scripts/setup-google-oauth.sh when Gmail/Drive OAuth is missing.
#   5. Verifies the backend/sidecar status and prints a clear summary.
#
# Re-runnable: every phase reads state from .env and the sidecar before doing
# work, so a second run skips completed steps automatically.
#
# Non-interactive use: pass --non-interactive and export all values the child
# scripts need. See --help for the checklist.
#
# Flags:
#   --non-interactive   Never prompt; fail fast with a checklist if vars are missing.
#   --skip-mailflare    Skip the Allternit Mail / mailflare setup phase.
#   --skip-google-oauth Skip the Google OAuth setup phase.
#   --skip-sidecar      Do not start the sidecar (assume it is already running).
#   --reconfigure       Ignore prior state and re-run child setup scripts.
#   --help              Show usage.
# =============================================================================

set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
MAGENTA='\033[0;35m'
NC='\033[0m'

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
ROOT_ENV_FILE="$REPO_ROOT/.env"
EXAMPLE_ENV_FILE="$REPO_ROOT/.env.example"
STATE_FILE="$REPO_ROOT/services/.connectors-install.state.json"
SIDECAR_ENV_FILE="${ALLTERNIT_CONNECTOR_SIDECAR_ENV_FILE:-/tmp/allternit-connector-sidecar.env}"

SIDECAR_PORT="${ALLTERNIT_CONNECTOR_SIDECAR_PORT:-8014}"
SIDECAR_URL="${ALLTERNIT_CONNECTOR_SIDECAR_URL:-http://127.0.0.1:${SIDECAR_PORT}}"

NON_INTERACTIVE=0
SKIP_MAILFLARE=0
SKIP_GOOGLE_OAUTH=0
SKIP_SIDECAR=0
RECONFIGURE=0
INTERACTIVE=0
[ -t 0 ] && INTERACTIVE=1

print_header() {
    echo ""
    echo -e "${CYAN}╔════════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${CYAN}║${NC}           ${GREEN}ALLTERNIT CONNECTORS${NC}                          ${CYAN}║${NC}"
    echo -e "${CYAN}║${NC}        ${BLUE}Unified installer for non-technical users${NC}           ${CYAN}║${NC}"
    echo -e "${CYAN}╚════════════════════════════════════════════════════════════════╝${NC}"
    echo ""
}

print_section() {
    echo ""
    echo -e "${MAGENTA}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${MAGENTA}  $1${NC}"
    echo -e "${MAGENTA}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
}

print_step() { echo -e "${BLUE}[STEP]${NC} $1"; }
print_info() { echo -e "${CYAN}[INFO]${NC} $1"; }
print_success() { echo -e "${GREEN}[✓]${NC} $1"; }
print_warning() { echo -e "${YELLOW}[!]${NC} $1"; }
print_error() { echo -e "${RED}[✗]${NC} $1"; }

die() {
    print_error "$1"
    exit 1
}

usage() {
    cat <<EOF
Usage: ./scripts/install-connectors.sh [OPTIONS]

One-command setup for Allternit Mail, Gmail, and Google Drive connectors.

OPTIONS:
  --non-interactive    Never prompt. Requires all needed env vars to be set.
  --skip-mailflare     Skip the Allternit Mail (mailflare) setup phase.
  --skip-google-oauth  Skip the Google OAuth setup phase.
  --skip-sidecar       Do not start the open-connector sidecar.
  --reconfigure        Ignore prior state and re-run child setup scripts.
  -h, --help           Show this help.

REQUIRED ENVIRONMENT (non-interactive mode):
  ALLTERNIT_PUBLIC_BASE_URL    Public origin of this allternit deployment,
                               e.g. https://ai.example.com

MAILFLARE PHASE (when --skip-mailflare is not used):
  CF_TOKEN                     Scoped Cloudflare API token
  CF_ACCOUNT_ID                Cloudflare account ID
  MAILFLARE_ZONE               Zone domain on Cloudflare
  ADMIN_PASSWORD               First admin password for mailflare
  Optional: AGENT_SUBDOMAIN, WORKER_NAME, EMAIL_TRANSPORT, RESEND_API_KEY,
            MAILFLARE_WORKER_URL, ADMIN_USERNAME, ADMIN_RECOVERY_EMAIL.
            See services/mailflare/setup.sh --help for details.

GOOGLE OAUTH PHASE (when --skip-google-oauth is not used):
  GMAIL_CLIENT_ID              Google OAuth client ID
  GMAIL_CLIENT_SECRET          Google OAuth client secret
  GOOGLE_DRIVE_CLIENT_ID       Usually the same as GMAIL_CLIENT_ID
  GOOGLE_DRIVE_CLIENT_SECRET   Usually the same as GMAIL_CLIENT_SECRET

SIDECAR:
  The sidecar is started automatically unless --skip-sidecar is used.
  If it is already running, its existing tokens are reused.

EXAMPLES:
  Interactive run:
    ./scripts/install-connectors.sh

  Non-interactive run:
    export ALLTERNIT_PUBLIC_BASE_URL=https://ai.example.com
    export CF_TOKEN=...
    export CF_ACCOUNT_ID=...
    export MAILFLARE_ZONE=example.com
    export ADMIN_PASSWORD=...
    export GMAIL_CLIENT_ID=...
    export GMAIL_CLIENT_SECRET=...
    export GOOGLE_DRIVE_CLIENT_ID=...
    export GOOGLE_DRIVE_CLIENT_SECRET=...
    ./scripts/install-connectors.sh --non-interactive
EOF
}

parse_args() {
    while [ $# -gt 0 ]; do
        case "$1" in
            --non-interactive)
                NON_INTERACTIVE=1
                INTERACTIVE=0
                ;;
            --skip-mailflare) SKIP_MAILFLARE=1 ;;
            --skip-google-oauth) SKIP_GOOGLE_OAUTH=1 ;;
            --skip-sidecar) SKIP_SIDECAR=1 ;;
            --reconfigure) RECONFIGURE=1 ;;
            -h|--help)
                usage
                exit 0
                ;;
            *)
                print_error "Unknown option: $1"
                usage
                exit 1
                ;;
        esac
        shift
    done
}

confirm() {
    local prompt="$1"
    if [ "$INTERACTIVE" != "1" ]; then
        return 1
    fi
    read -p "$prompt (y/N) " -n 1 -r
    echo
    [[ $REPLY =~ ^[Yy]$ ]]
}

prompt_value() {
    local prompt="$1" default="$2" value=""
    if [ "$INTERACTIVE" != "1" ]; then
        [ -n "$default" ] || die "Non-interactive run and no value for: $prompt"
        echo "$default"
        return
    fi
    if [ -n "$default" ]; then
        read -p "$prompt [$default]: " -r value
    else
        read -p "$prompt: " -r value
    fi
    echo "${value:-$default}"
}

prompt_secret() {
    local prompt="$1" value=""
    [ "$INTERACTIVE" = "1" ] || die "Non-interactive run and no value for: $prompt"
    read -s -p "$prompt: " -r value
    echo ""
    [ -n "$value" ] || die "Empty value not allowed for: $prompt"
    echo "$value"
}

# Read a KEY from a KEY=VALUE file (ignoring comments/blank lines).
read_env_file() {
    local file="$1" key="$2"
    [ -f "$file" ] || return 0
    grep -E "^${key}=" "$file" 2>/dev/null | head -1 | cut -d= -f2- || true
}

# True when value is non-empty.
is_set() {
    [ -n "${1:-}" ]
}

# True when mailflare looks configured in .env.
mailflare_configured() {
    is_set "$(read_env_file "$ROOT_ENV_FILE" ALLTERNIT_MAILFLARE_URL)" &&
    is_set "$(read_env_file "$ROOT_ENV_FILE" ALLTERNIT_MAILFLARE_ADMIN_KEY)" &&
    is_set "$(read_env_file "$ROOT_ENV_FILE" ALLTERNIT_BOT_EMAIL_DOMAIN)"
}

# Check if a command exists.
require_cmd() {
    command -v "$1" &>/dev/null || die "$1 is required. Please install it first."
}

json_get() {
    local path="$1"
    if command -v jq &>/dev/null; then
        jq -r ".${path} // empty"
    else
        node -e '
let data = "";
process.stdin.on("data", (c) => (data += c)).on("end", () => {
    try {
        const value = new Function("_", "return _." + process.argv[1])(JSON.parse(data));
        if (value === undefined || value === null) process.exit(0);
        console.log(typeof value === "object" ? JSON.stringify(value) : value);
    } catch {
        process.exit(0);
    }
});' "$path"
    fi
}

# =============================================================================
# PREFLIGHT
# =============================================================================

preflight() {
    print_section "PREFLIGHT CHECKS"

    require_cmd curl
    require_cmd node
    require_cmd npm
    require_cmd openssl

    local node_major
    node_major=$(node -v | cut -dv -f2 | cut -d. -f1)
    [ "$node_major" -ge 18 ] || die "Node.js >= 18 required, found $(node -v)"
    print_success "Node.js $(node -v)"

    if [ ! -f "$ROOT_ENV_FILE" ] && [ -f "$EXAMPLE_ENV_FILE" ]; then
        if [ "$INTERACTIVE" = "1" ]; then
            if confirm "No .env found. Create it from .env.example?"; then
                cp "$EXAMPLE_ENV_FILE" "$ROOT_ENV_FILE"
                print_success "Created $ROOT_ENV_FILE from example"
            fi
        else
            cp "$EXAMPLE_ENV_FILE" "$ROOT_ENV_FILE"
            print_success "Created $ROOT_ENV_FILE from example (non-interactive)"
        fi
    fi

    if [ -z "${ALLTERNIT_PUBLIC_BASE_URL:-}" ]; then
        local from_env=""
        from_env=$(read_env_file "$ROOT_ENV_FILE" ALLTERNIT_PUBLIC_BASE_URL)
        if [ -n "$from_env" ]; then
            ALLTERNIT_PUBLIC_BASE_URL="$from_env"
        elif [ "$INTERACTIVE" = "1" ]; then
            ALLTERNIT_PUBLIC_BASE_URL=$(prompt_value "Public origin of this allternit deployment (e.g. https://ai.example.com)" "http://127.0.0.1:8013")
        fi
    fi
    ALLTERNIT_PUBLIC_BASE_URL="${ALLTERNIT_PUBLIC_BASE_URL%/}"
    if [ -z "$ALLTERNIT_PUBLIC_BASE_URL" ]; then
        die "ALLTERNIT_PUBLIC_BASE_URL is required. Set it in .env or export it."
    fi
    print_success "Public origin: $ALLTERNIT_PUBLIC_BASE_URL"

    # Persist public origin so child scripts see it.
    upsert_env "$ROOT_ENV_FILE" ALLTERNIT_PUBLIC_BASE_URL "$ALLTERNIT_PUBLIC_BASE_URL"

    validate_non_interactive
}

validate_non_interactive() {
    [ "$NON_INTERACTIVE" = "1" ] || return 0
    local missing=()
    [ -n "$ALLTERNIT_PUBLIC_BASE_URL" ] || missing+=("ALLTERNIT_PUBLIC_BASE_URL")

    if [ "$SKIP_MAILFLARE" != "1" ]; then
        [ -n "${CF_TOKEN:-}" ] || missing+=("CF_TOKEN")
        [ -n "${CF_ACCOUNT_ID:-}" ] || missing+=("CF_ACCOUNT_ID")
        [ -n "${MAILFLARE_ZONE:-}" ] || missing+=("MAILFLARE_ZONE")
        [ -n "${ADMIN_PASSWORD:-}" ] || missing+=("ADMIN_PASSWORD")
    fi

    if [ "$SKIP_GOOGLE_OAUTH" != "1" ]; then
        [ -n "${GMAIL_CLIENT_ID:-}" ] || missing+=("GMAIL_CLIENT_ID")
        [ -n "${GMAIL_CLIENT_SECRET:-}" ] || missing+=("GMAIL_CLIENT_SECRET")
        [ -n "${GOOGLE_DRIVE_CLIENT_ID:-}" ] || missing+=("GOOGLE_DRIVE_CLIENT_ID")
        [ -n "${GOOGLE_DRIVE_CLIENT_SECRET:-}" ] || missing+=("GOOGLE_DRIVE_CLIENT_SECRET")
    fi

    if [ ${#missing[@]} -gt 0 ]; then
        print_error "Non-interactive run is missing required environment variables:"
        local var
        for var in "${missing[@]}"; do
            print_info "  - $var"
        done
        exit 1
    fi
}

# Set (or replace) KEY=VALUE in an env file. Commented-out keys are replaced.
upsert_env() {
    local file="$1" key="$2" value="$3"
    touch "$file"
    local tmp
    tmp=$(mktemp)
    grep -vE "^#?[[:space:]]*${key}=" "$file" > "$tmp" || true
    printf '%s=%s\n' "$key" "$value" >> "$tmp"
    mv "$tmp" "$file"
}

# =============================================================================
# SIDECAR
# =============================================================================

ensure_sidecar() {
    [ "$SKIP_SIDECAR" = "1" ] && return 0
    print_section "OPEN-CONNECTOR SIDECAR"

    local health_url="${SIDECAR_URL%/}/health"
    local code
    code=$(curl -s -o /dev/null -w "%{http_code}" --max-time 3 "$health_url" || true)
    if [ "$code" = "200" ]; then
        print_success "Sidecar is already running at $SIDECAR_URL"
    else
        print_step "Starting sidecar..."
        "$REPO_ROOT/dev/scripts/start-connector-sidecar.sh"
        code=$(curl -s -o /dev/null -w "%{http_code}" --max-time 3 "$health_url" || true)
        [ "$code" = "200" ] || die "Sidecar did not become healthy at $SIDECAR_URL"
        print_success "Sidecar started and healthy"
    fi

    # Re-read tokens from the env file the sidecar start script wrote.
    if [ -f "$SIDECAR_ENV_FILE" ]; then
        local key value
        while IFS='=' read -r key value; do
            case "$key" in ''|\#*) continue ;; esac
            case "$key" in
                ALLTERNIT_CONNECTOR_SIDECAR_URL|ALLTERNIT_CONNECTOR_SIDECAR_ADMIN_TOKEN|ALLTERNIT_CONNECTOR_SIDECAR_RUNTIME_TOKEN|ENCRYPTION_KEY)
                    if [ -z "${!key:-}" ]; then
                        printf -v "$key" '%s' "$value"
                    fi
                    ;;
            esac
        done < "$SIDECAR_ENV_FILE"
    fi

    if [ -n "${ALLTERNIT_CONNECTOR_SIDECAR_URL:-}" ]; then
        SIDECAR_URL="${ALLTERNIT_CONNECTOR_SIDECAR_URL%/}"
    fi
    print_success "Sidecar URL: $SIDECAR_URL"
}

# =============================================================================
# MAILFLARE / ALLTERNIT MAIL
# =============================================================================

run_mailflare_setup() {
    [ "$SKIP_MAILFLARE" = "1" ] && return 0
    print_section "ALLTERNIT MAIL (mailflare)"

    if [ "$RECONFIGURE" != "1" ] && mailflare_configured; then
        print_success "Allternit Mail is already configured in $ROOT_ENV_FILE"
        if confirm "Re-run mailflare setup anyway?"; then
            : # continue
        else
            print_info "Skipping mailflare setup"
            return 0
        fi
    fi

    print_step "Running services/mailflare/setup.sh..."
    local args=()
    [ "$NON_INTERACTIVE" = "1" ] && args+=("--non-interactive")

    (
        cd "$REPO_ROOT/services/mailflare"
        ./setup.sh "${args[@]}"
    ) || die "mailflare setup failed. Fix the issue above and re-run this script."

    if ! mailflare_configured; then
        die "mailflare setup finished but required vars are missing from $ROOT_ENV_FILE."
    fi
    print_success "Allternit Mail configured"
}

# =============================================================================
# GOOGLE OAUTH
# =============================================================================

sidecar_admin_token() {
    if [ -n "${ALLTERNIT_CONNECTOR_SIDECAR_ADMIN_TOKEN:-}" ]; then
        echo "$ALLTERNIT_CONNECTOR_SIDECAR_ADMIN_TOKEN"
        return
    fi
    read_env_file "$SIDECAR_ENV_FILE" ALLTERNIT_CONNECTOR_SIDECAR_ADMIN_TOKEN
}

sidecar_api() {
    local method="$1" path="$2" body="${3:-}"
    local token
    token=$(sidecar_admin_token)
    [ -n "$token" ] || die "Sidecar admin token not available"
    local args=(
        -sS -X "$method" "${SIDECAR_URL%/}${path}"
        -H "Authorization: Bearer ${token}"
        -H "Content-Type: application/json"
    )
    [ -n "$body" ] && args+=(-d "$body")
    curl "${args[@]}"
}

# Query sidecar /api/oauth/configs and echo configured services (one per line).
list_configured_oauth_services() {
    sidecar_api GET /api/oauth/configs | node -e '
let data = "";
process.stdin.on("data", (c) => (data += c)).on("end", () => {
    try {
        const parsed = JSON.parse(data);
        const list = Array.isArray(parsed) ? parsed : (parsed.data || []);
        list.forEach((c) => {
            if (c.configured === true || c.configured === "true") {
                console.log(c.service);
            }
        });
    } catch {
        // silent
    }
});'
}

run_google_oauth_setup() {
    [ "$SKIP_GOOGLE_OAUTH" = "1" ] && return 0
    print_section "GOOGLE OAUTH (Gmail + Google Drive)"

    print_step "Checking existing sidecar OAuth configs..."
    local configured
    configured=$(list_configured_oauth_services)
    local has_gmail=0 has_drive=0
    if echo "$configured" | grep -qx "gmail"; then
        has_gmail=1
        print_success "Gmail OAuth app already registered"
    fi
    if echo "$configured" | grep -qx "googledrive"; then
        has_drive=1
        print_success "Google Drive OAuth app already registered"
    fi

    if [ "$RECONFIGURE" != "1" ] && [ "$has_gmail" = "1" ] && [ "$has_drive" = "1" ]; then
        if confirm "Re-run Google OAuth setup anyway?"; then
            : # continue
        else
            print_info "Skipping Google OAuth setup"
            return 0
        fi
    fi

    print_step "Running scripts/setup-google-oauth.sh..."
    local args=()
    [ "$NON_INTERACTIVE" = "1" ] && args+=("--non-interactive")

    (
        cd "$REPO_ROOT"
        ./scripts/setup-google-oauth.sh "${args[@]}"
    ) || die "Google OAuth setup failed. Fix the issue above and re-run this script."

    print_success "Google OAuth configured"
}

# =============================================================================
# VERIFICATION
# =============================================================================

verify_setup() {
    print_section "VERIFICATION"
    local overall_ok=1

    # Sidecar health
    local sidecar_code
    sidecar_code=$(curl -s -o /dev/null -w "%{http_code}" --max-time 5 "${SIDECAR_URL%/}/health" || true)
    if [ "$sidecar_code" = "200" ]; then
        print_success "Sidecar healthy at $SIDECAR_URL"
    else
        print_error "Sidecar not healthy at $SIDECAR_URL (HTTP $sidecar_code)"
        overall_ok=0
    fi

    # Allternit Mail
    if [ "$SKIP_MAILFLARE" != "1" ]; then
        if mailflare_configured; then
            local url key
            url=$(read_env_file "$ROOT_ENV_FILE" ALLTERNIT_MAILFLARE_URL)
            key=$(read_env_file "$ROOT_ENV_FILE" ALLTERNIT_MAILFLARE_ADMIN_KEY)
            local code
            code=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 \
                -H "Authorization: Bearer ${key}" \
                "${url%/}/api/setup/status" || true)
            if [ "$code" = "200" ]; then
                print_success "Allternit Mail worker reachable"
            else
                print_error "Allternit Mail worker not reachable (HTTP $code)"
                overall_ok=0
            fi
        else
            print_error "Allternit Mail not configured"
            overall_ok=0
        fi
    fi

    # Google OAuth
    if [ "$SKIP_GOOGLE_OAUTH" != "1" ]; then
        local configured
        configured=$(list_configured_oauth_services)
        if echo "$configured" | grep -qx "gmail"; then
            print_success "Gmail OAuth configured"
        else
            print_error "Gmail OAuth not configured"
            overall_ok=0
        fi
        if echo "$configured" | grep -qx "googledrive"; then
            print_success "Google Drive OAuth configured"
        else
            print_error "Google Drive OAuth not configured"
            overall_ok=0
        fi
    fi

    write_state_file "$overall_ok"

    echo ""
    if [ "$overall_ok" = "1" ]; then
        echo -e "${GREEN}All checks passed.${NC}"
    else
        echo -e "${RED}Some checks failed.${NC} See messages above and re-run:"
        echo "  ./scripts/install-connectors.sh"
        exit 1
    fi
}

write_state_file() {
    local overall_ok="$1"
    local mail_ok="false"
    local gmail_ok="false"
    local drive_ok="false"
    [ "$SKIP_MAILFLARE" = "1" ] || mailflare_configured && mail_ok="true"
    local configured
    configured=$(list_configured_oauth_services)
    echo "$configured" | grep -qx "gmail" && gmail_ok="true"
    echo "$configured" | grep -qx "googledrive" && drive_ok="true"

    mkdir -p "$(dirname "$STATE_FILE")"
    cat > "$STATE_FILE" <<EOF
{
  "installedAt": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "publicOrigin": "$ALLTERNIT_PUBLIC_BASE_URL",
  "sidecarUrl": "$SIDECAR_URL",
  "allternitMailConfigured": $mail_ok,
  "gmailConfigured": $gmail_ok,
  "googleDriveConfigured": $drive_ok,
  "allChecksPassed": $( [ "$overall_ok" = "1" ] && echo "true" || echo "false" )
}
EOF
    print_success "Wrote install state to $STATE_FILE"
}

print_summary() {
    print_section "NEXT STEPS"
    echo ""
    echo "Connector provisioning is complete. Users can now:"
    echo "  1. Open the Allternit platform."
    echo "  2. Go to a bot's Runtime Config or the chat '+' sheet → Connectors."
    echo "  3. Connect Gmail, Google Drive, or Allternit Mail."
    echo ""
    echo "To re-run any phase later:"
    echo "  ./scripts/install-connectors.sh"
    echo ""
    echo "To reconfigure a specific phase:"
    echo "  ./scripts/install-connectors.sh --reconfigure"
    echo ""
    echo "Docs: docs/CONNECTOR_SETUP.md"
}

# =============================================================================
# MAIN
# =============================================================================

main() {
    parse_args "$@"
    print_header
    preflight
    ensure_sidecar
    run_mailflare_setup
    run_google_oauth_setup
    verify_setup
    print_summary
}

if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi
