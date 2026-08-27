#!/usr/bin/env bash
# =============================================================================
# ALLTERNIT GOOGLE OAUTH SETUP — Gmail + Google Drive sidecar connectors
# =============================================================================
# One-time operator step: register a Google OAuth app so the allternit platform
# can connect user Gmail and Google Drive accounts through the open-connector
# sidecar (services/open-connector).
#
# Google does not allow OAuth app creation via API for this use-case, so the
# script cannot create the app for you. What it DOES automate:
#   - computes the exact redirect URI the Google app must allow
#   - finds the sidecar admin token (env or /tmp/allternit-connector-sidecar.env)
#   - registers the client id/secret for gmail and googledrive in the sidecar
#   - writes the relevant env vars into the repo-root .env as documentation
#
# Re-runnable: registering the same client id again overwrites the previous
# value in the sidecar. Changing the client id requires updating the Google app
# too (redirect URI must stay in sync).
#
# Non-interactive use: export ALLTERNIT_PUBLIC_BASE_URL, GMAIL_CLIENT_ID,
# GMAIL_CLIENT_SECRET, GOOGLE_DRIVE_CLIENT_ID, GOOGLE_DRIVE_CLIENT_SECRET.
# The script still needs the sidecar to be reachable.
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
SIDECAR_ENV_FILE="${ALLTERNIT_CONNECTOR_SIDECAR_ENV_FILE:-/tmp/allternit-connector-sidecar.env}"

INTERACTIVE=0
[ -t 0 ] && INTERACTIVE=1

print_header() {
    echo ""
    echo -e "${CYAN}╔════════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${CYAN}║${NC}           ${GREEN}ALLTERNIT GOOGLE OAUTH SETUP${NC}                    ${CYAN}║${NC}"
    echo -e "${CYAN}║${NC}       Gmail + Google Drive sidecar connectors                ${CYAN}║${NC}"
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

confirm() {
    local prompt="$1"
    if [ "$INTERACTIVE" != "1" ]; then
        return 1
    fi
    read -p "$prompt (y/N) " -n 1 -r
    echo
    [[ $REPLY =~ ^[Yy]$ ]]
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

# Read a KEY from a KEY=VALUE file (ignoring comments/blank lines).
read_env_file() {
    local file="$1" key="$2"
    [ -f "$file" ] || return 0
    grep -E "^${key}=" "$file" 2>/dev/null | head -1 | cut -d= -f2- || true
}

resolve_public_origin() {
    if [ -n "${ALLTERNIT_PUBLIC_BASE_URL:-}" ]; then
        echo "${ALLTERNIT_PUBLIC_BASE_URL%/}"
        return
    fi
    if [ -n "${OOMOL_CONNECT_ORIGIN:-}" ]; then
        echo "${OOMOL_CONNECT_ORIGIN%/}"
        return
    fi
    if [ -f "$ROOT_ENV_FILE" ]; then
        local from_env
        from_env=$(read_env_file "$ROOT_ENV_FILE" "ALLTERNIT_PUBLIC_BASE_URL")
        if [ -n "$from_env" ]; then
            echo "${from_env%/}"
            return
        fi
    fi
    if [ -f "$SIDECAR_ENV_FILE" ]; then
        local sidecar_url
        sidecar_url=$(read_env_file "$SIDECAR_ENV_FILE" "ALLTERNIT_CONNECTOR_SIDECAR_URL")
        # Sidecar URL is the loopback bind address; the public origin is the API.
        # Dev default is http://127.0.0.1:8013, so ask rather than guess.
        if [ -n "$sidecar_url" ]; then
            print_info "Sidecar is running locally; default public origin for dev is http://127.0.0.1:8013"
        fi
    fi
    if [ "$INTERACTIVE" = "1" ]; then
        prompt_value "Public origin where allternit-api is reachable (e.g. https://ai.example.com)" "http://127.0.0.1:8013"
    else
        die "ALLTERNIT_PUBLIC_BASE_URL or OOMOL_CONNECT_ORIGIN is required in non-interactive mode"
    fi
}

resolve_sidecar_url() {
    if [ -n "${ALLTERNIT_CONNECTOR_SIDECAR_URL:-}" ]; then
        echo "${ALLTERNIT_CONNECTOR_SIDECAR_URL%/}"
        return
    fi
    if [ -f "$SIDECAR_ENV_FILE" ]; then
        local url
        url=$(read_env_file "$SIDECAR_ENV_FILE" "ALLTERNIT_CONNECTOR_SIDECAR_URL")
        if [ -n "$url" ]; then
            echo "${url%/}"
            return
        fi
    fi
    local port="${ALLTERNIT_CONNECTOR_SIDECAR_PORT:-8014}"
    echo "http://127.0.0.1:${port}"
}

resolve_admin_token() {
    if [ -n "${ALLTERNIT_CONNECTOR_SIDECAR_ADMIN_TOKEN:-}" ]; then
        echo "$ALLTERNIT_CONNECTOR_SIDECAR_ADMIN_TOKEN"
        return
    fi
    if [ -f "$SIDECAR_ENV_FILE" ]; then
        local tok
        tok=$(read_env_file "$SIDECAR_ENV_FILE" "ALLTERNIT_CONNECTOR_SIDECAR_ADMIN_TOKEN")
        if [ -n "$tok" ]; then
            echo "$tok"
            return
        fi
    fi
    if [ "$INTERACTIVE" = "1" ]; then
        print_warning "Could not find the sidecar admin token automatically."
        prompt_secret "Sidecar admin token"
    else
        die "ALLTERNIT_CONNECTOR_SIDECAR_ADMIN_TOKEN is required in non-interactive mode"
    fi
}

check_sidecar() {
    print_step "Checking open-connector sidecar at $SIDECAR_URL..."
    local code
    code=$(curl -s -o /dev/null -w "%{http_code}" --max-time 5 "${SIDECAR_URL}/health" || true)
    if [ "$code" != "200" ]; then
        print_error "Sidecar is not answering at $SIDECAR_URL (HTTP $code)."
        print_info "Start it first: ./dev/scripts/start-connector-sidecar.sh"
        print_info "Or, in production, ensure the sidecar is running and set ALLTERNIT_CONNECTOR_SIDECAR_URL."
        exit 1
    fi
    print_success "Sidecar is healthy"
}

sidecar_api() {
    local method="$1" path="$2" body="${3:-}"
    local args=(
        -sS -X "$method" "${SIDECAR_URL}${path}"
        -H "Authorization: Bearer ${ADMIN_TOKEN}"
        -H "Content-Type: application/json"
    )
    [ -n "$body" ] && args+=(-d "$body")
    curl "${args[@]}"
}

list_existing_configs() {
    sidecar_api GET "/api/oauth/configs" | node -e '
let data = "";
process.stdin.on("data", (c) => (data += c)).on("end", () => {
    try {
        const parsed = JSON.parse(data);
        const list = Array.isArray(parsed) ? parsed : (parsed.data || []);
        list.forEach((c) => console.log(`${c.service}\t${c.clientId || c.client_id || ""}`));
    } catch {
        // silent
    }
});'
}

register_oauth_config() {
    local service="$1" client_id="$2" client_secret="$3"
    print_step "Registering OAuth client for '$service' in the sidecar..."
    local response
    response=$(sidecar_api PUT "/api/oauth/configs/${service}" \
        "{\"clientId\":\"${client_id}\",\"clientSecret\":\"${client_secret}\"}")
    local configured
    configured=$(echo "$response" | node -e '
let data = "";
process.stdin.on("data", (c) => (data += c)).on("end", () => {
    try {
        const parsed = JSON.parse(data);
        console.log(parsed.configured === true || parsed.configured === "true" ? "true" : "");
    } catch {
        process.exit(0);
    }
});')
    if [ "$configured" = "true" ]; then
        print_success "Registered OAuth client for '$service'"
    else
        print_error "Failed to register '$service': $response"
        return 1
    fi
}

collect_google_credentials() {
    print_section "GOOGLE OAUTH CREDENTIALS"
    print_info "The same Google Cloud OAuth app can serve both Gmail and Google Drive."
    print_info "Redirect URI to allow in the Google app: ${PUBLIC_ORIGIN}/oauth/callback"
    echo ""
    print_info "Create the OAuth app at:"
    print_info "  https://console.cloud.google.com/apis/credentials"
    print_info "Scopes needed:"
    print_info "  Gmail:        https://www.googleapis.com/auth/gmail.modify"
    print_info "  Google Drive: https://www.googleapis.com/auth/drive"
    print_info "  (plus any narrower scopes your actions require)"
    echo ""

    GMAIL_CLIENT_ID="${GMAIL_CLIENT_ID:-$(prompt_value "Gmail client ID" "")}"
    GMAIL_CLIENT_ID=$(echo "$GMAIL_CLIENT_ID" | tr -d ' ')
    [ -n "$GMAIL_CLIENT_ID" ] || die "Gmail client ID is required"
    GMAIL_CLIENT_SECRET="${GMAIL_CLIENT_SECRET:-$(prompt_secret "Gmail client secret")}"
    GMAIL_CLIENT_SECRET=$(echo "$GMAIL_CLIENT_SECRET" | tr -d ' ')
    [ -n "$GMAIL_CLIENT_SECRET" ] || die "Gmail client secret is required"

    GOOGLE_DRIVE_CLIENT_ID="${GOOGLE_DRIVE_CLIENT_ID:-$(prompt_value "Google Drive client ID (usually same as Gmail)" "$GMAIL_CLIENT_ID")}"
    GOOGLE_DRIVE_CLIENT_ID=$(echo "$GOOGLE_DRIVE_CLIENT_ID" | tr -d ' ')
    [ -n "$GOOGLE_DRIVE_CLIENT_ID" ] || die "Google Drive client ID is required"
    GOOGLE_DRIVE_CLIENT_SECRET="${GOOGLE_DRIVE_CLIENT_SECRET:-$(prompt_secret "Google Drive client secret (usually same as Gmail)" )}"
    GOOGLE_DRIVE_CLIENT_SECRET=$(echo "$GOOGLE_DRIVE_CLIENT_SECRET" | tr -d ' ')
    [ -n "$GOOGLE_DRIVE_CLIENT_SECRET" ] || die "Google Drive client secret is required"
}

write_root_env() {
    print_section "WRITING ROOT .env"
    print_info "Storing the Google OAuth client ids in $ROOT_ENV_FILE for documentation."
    print_info "The actual secrets live in the open-connector sidecar vault."
    upsert_env "$ROOT_ENV_FILE" "ALLTERNIT_PUBLIC_BASE_URL" "$PUBLIC_ORIGIN"
    upsert_env "$ROOT_ENV_FILE" "GMAIL_CLIENT_ID" "$GMAIL_CLIENT_ID"
    upsert_env "$ROOT_ENV_FILE" "GOOGLE_DRIVE_CLIENT_ID" "$GOOGLE_DRIVE_CLIENT_ID"
    # Do NOT write client secrets to .env; they are already in the sidecar vault.
    print_success "Updated $ROOT_ENV_FILE"
}

print_next_steps() {
    print_section "SETUP COMPLETE"
    echo ""
    echo -e "${GREEN}Google OAuth is configured for the sidecar.${NC}"
    echo ""
    echo "  Public origin:       $PUBLIC_ORIGIN"
    echo "  Redirect URI:        ${PUBLIC_ORIGIN}/oauth/callback"
    echo "  Sidecar admin env:   $SIDECAR_ENV_FILE"
    echo ""
    echo "Next steps:"
    echo "  1. In the Google Cloud Console, make sure the OAuth app allows the"
    echo "     redirect URI above and has the Gmail/Drive API scopes enabled."
    echo "  2. Users can now connect Gmail and Google Drive from the allternit"
    echo "     connector marketplace."
    echo "  3. If you change the public origin or the Google client credentials,"
    echo "     re-run this script."
    echo ""
}

main() {
    print_header

    PUBLIC_ORIGIN=$(resolve_public_origin)
    print_success "Public origin: $PUBLIC_ORIGIN"
    print_info "Redirect URI for Google app: ${PUBLIC_ORIGIN}/oauth/callback"

    SIDECAR_URL=$(resolve_sidecar_url)
    ADMIN_TOKEN=$(resolve_admin_token)
    check_sidecar

    print_step "Existing sidecar OAuth configs:"
    list_existing_configs | while IFS=$'\t' read -r svc cid; do
        [ -n "$svc" ] && print_info "  $svc: ${cid:-<no client id>}"
    done

    collect_google_credentials

    register_oauth_config "gmail" "$GMAIL_CLIENT_ID" "$GMAIL_CLIENT_SECRET"
    register_oauth_config "googledrive" "$GOOGLE_DRIVE_CLIENT_ID" "$GOOGLE_DRIVE_CLIENT_SECRET"

    write_root_env
    print_next_steps
}

if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi
