#!/usr/bin/env bash
# =============================================================================
# ALLTERNIT AGENT EMAIL (mailflare fork) - PER-USER INSTALLER
# =============================================================================
# Deploys services/mailflare to the INSTALLING USER'S OWN Cloudflare account:
#   - verifies a scoped Cloudflare API token and resolves the zone
#   - provisions D1 / R2 / Queues (idempotent, check-before-create)
#   - writes the per-install D1 database_id into wrangler.jsonc
#   - runs remote D1 migrations and deploys the Worker
#   - enables Email Routing + sending-subdomain DNS, adds a DMARC record
#   - bootstraps the first admin account and an admin-scope API key
#   - merges ALLTERNIT_MAILFLARE_* vars into the repo-root .env
#   - optional end-to-end smoke test (gated outbound -> approve -> cleanup)
#
# Re-runnable: every Cloudflare creation step checks before creating, and a
# previous run's values are reused from services/mailflare/.env.install.
#
# Two things Cloudflare does NOT allow to be automated — the installer detects
# both, deep-links the dashboard, and polls/waits until done:
#   1. Creating the scoped API token (dashboard-only) — the installer probes the
#      token's permissions empirically and prints the exact missing groups.
#   2. One-time R2 activation on the account (API code 10042) — the installer
#      polls `wrangler r2 bucket list` until R2 is enabled.
#
# Non-interactive use: pass --non-interactive and export CF_TOKEN, CF_ACCOUNT_ID,
# MAILFLARE_ZONE, ADMIN_PASSWORD (plus optional AGENT_SUBDOMAIN, WORKER_NAME,
# MAILFLARE_WORKER_URL, ALLTERNIT_HOST, ADMIN_USERNAME, ADMIN_RECOVERY_EMAIL,
# EMAIL_TRANSPORT, RESEND_API_KEY).
# Missing required vars fail fast with a list instead of prompting.
#
# Flags:
#   --skip-smoke-test   skip the end-to-end smoke test
#   --reconfigure       ignore values from a previous .env.install
#   --non-interactive   never prompt; require all config via env, fail fast
#   --help              show usage
# =============================================================================

set -euo pipefail

# Colors (match scripts/onboarding-setup.sh)
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
MAGENTA='\033[0;35m'
NC='\033[0m'

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
INSTALL_ENV_FILE="$SCRIPT_DIR/.env.install"
ROOT_ENV_FILE="$REPO_ROOT/.env"

# Resource names — must match wrangler.jsonc exactly.
DEFAULT_WORKER_NAME="allternit-agent-mail"
D1_NAME="allternit-agent-mail"
R2_BUCKET="allternit-agent-mail-raw"
QUEUE_INBOUND="allternit-agent-mail-inbound"
QUEUE_OUTBOUND="allternit-agent-mail-outbound"

CF_API_BASE="https://api.cloudflare.com/client/v4"
DNS_POLL_TIMEOUT=300   # seconds
DNS_POLL_INTERVAL=15   # seconds
WORKER_WAIT_TIMEOUT=120

SKIP_SMOKE_TEST=0
RECONFIGURE=0
NON_INTERACTIVE=0
HAVE_JQ=0
command -v jq &>/dev/null && HAVE_JQ=1
INTERACTIVE=0
[ -t 0 ] && INTERACTIVE=1

print_header() {
    echo ""
    echo -e "${CYAN}╔════════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${CYAN}║${NC}           ${GREEN}ALLTERNIT AGENT EMAIL${NC}                           ${CYAN}║${NC}"
    echo -e "${CYAN}║${NC}              ${BLUE}mailflare per-user installer${NC}                   ${CYAN}║${NC}"
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

usage() {
    cat <<EOF
Usage: ./setup.sh [--skip-smoke-test] [--reconfigure] [--non-interactive] [--help]

Deploys the allternit agent email rail (services/mailflare) to your own
Cloudflare account. Interactive by default; every value can also be supplied
via environment variable for non-interactive runs:

  CF_TOKEN                Scoped Cloudflare API token (the installer probes it
                          empirically and prints any missing permissions)
  CF_ACCOUNT_ID           Cloudflare account ID
  MAILFLARE_ZONE          Zone domain already on Cloudflare nameservers
  AGENT_SUBDOMAIN         Inbound/outbound domain for agents (default: agents.<zone>)
  WORKER_NAME             Worker name (default: allternit-agent-mail)
  EMAIL_TRANSPORT         cloudflare (default) | resend
  RESEND_API_KEY          Required when EMAIL_TRANSPORT=resend
  MAILFLARE_WORKER_URL    Override the deployed worker URL (skip auto-detect)
  ALLTERNIT_HOST          Public host of your allternit instance; when set, the
                          message.inbound webhook is registered automatically
  ADMIN_USERNAME          First admin mailbox local-part (default: admin)
  ADMIN_PASSWORD          First admin password (min 8 chars)
  ADMIN_RECOVERY_EMAIL    Recovery email for the first admin account

For EMAIL_TRANSPORT=cloudflare the CF_TOKEN needs Zone Read, DNS Edit, DNS Settings
Edit, Zone Settings Edit, Email Routing Rules Edit (Account) and Email Sending Edit,
Email Routing Addresses Edit, DNS Settings Edit (Zone). Email Sending additionally
requires the Workers Paid plan.

For EMAIL_TRANSPORT=resend the CF_TOKEN only needs Zone Read, DNS Edit and Email
Routing Rules Edit; outbound sends go through resend.com.

Flags:
  --skip-smoke-test   Skip the end-to-end smoke test
  --reconfigure       Ignore saved values from a previous run (.env.install)
  --non-interactive   Never prompt. Requires CF_TOKEN, CF_ACCOUNT_ID,
                      MAILFLARE_ZONE and ADMIN_PASSWORD via the environment
                      (values saved in .env.install also count); exits with a
                      list of missing variables if any are absent.
  --help              Show this message
EOF
}

die() {
    print_error "$1"
    exit 1
}

# y/N confirm, default NO (matches onboarding-setup.sh). Non-interactive: NO.
confirm() {
    local prompt="$1"
    if [ "$INTERACTIVE" != "1" ]; then
        return 1
    fi
    read -p "$prompt (y/N) " -n 1 -r
    echo
    [[ $REPLY =~ ^[Yy]$ ]]
}

# Prompt for a value with a default. Usage: prompt_var "prompt" "default"
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

# Secret prompt (no echo). Usage: prompt_secret "prompt"
prompt_secret() {
    local prompt="$1" value=""
    [ "$INTERACTIVE" = "1" ] || die "Non-interactive run and no value for: $prompt"
    read -s -p "$prompt: " -r value
    echo ""
    [ -n "$value" ] || die "Empty value not allowed for: $prompt"
    echo "$value"
}

# Extract a dotted path from JSON on stdin. Prefers jq, falls back to node.
# Path syntax: result.status, result[0].id, etc.
json_get() {
    local path="$1"
    if [ "$HAVE_JQ" = "1" ]; then
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

# Authenticated Cloudflare API call. Prints the raw JSON response.
cf_api() {
    local method="$1" path="$2" body="${3:-}"
    local args=(
        -sS -X "$method" "${CF_API_BASE}${path}"
        -H "Authorization: Bearer ${CF_TOKEN}"
        -H "Content-Type: application/json"
    )
    [ -n "$body" ] && args+=(-d "$body")
    curl "${args[@]}"
}

# cf_api + assert success; aborts with the API error message otherwise.
cf_api_expect() {
    local description="$1" method="$2" path="$3" body="${4:-}"
    local response success
    response=$(cf_api "$method" "$path" "$body")
    success=$(echo "$response" | json_get "success")
    if [ "$success" != "true" ]; then
        local message
        message=$(echo "$response" | json_get "errors[0].message")
        print_error "$description failed: ${message:-unknown Cloudflare API error}"
        print_info "Response: $response"
        exit 1
    fi
    echo "$response"
}

# Set (or replace) KEY=VALUE in an env file. Never overwrites an existing
# non-empty value without confirmation, unless the 4th argument is "force".
# Commented-out keys are replaced.
upsert_env() {
    local file="$1" key="$2" value="$3" mode="${4:-}"
    touch "$file"
    local current=""
    current=$(grep -E "^${key}=" "$file" 2>/dev/null | head -1 | cut -d= -f2- || true)
    if [ -n "$current" ] && [ "$mode" != "force" ]; then
        if ! confirm "$file already sets $key — overwrite?"; then
            print_info "Keeping existing $key"
            return 0
        fi
    fi
    local tmp
    tmp=$(mktemp)
    grep -vE "^#?[[:space:]]*${key}=" "$file" > "$tmp" || true
    printf '%s=%s\n' "$key" "$value" >> "$tmp"
    mv "$tmp" "$file"
    print_success "Wrote $key to $file"
}

random_hex() {
    if command -v openssl &>/dev/null; then
        openssl rand -hex 32
    else
        node -e 'console.log(require("crypto").randomBytes(32).toString("hex"))'
    fi
}

# =============================================================================
# ARGUMENTS
# =============================================================================

parse_args() {
    while [ $# -gt 0 ]; do
        case "$1" in
            --skip-smoke-test) SKIP_SMOKE_TEST=1 ;;
            --reconfigure) RECONFIGURE=1 ;;
            --non-interactive)
                NON_INTERACTIVE=1
                INTERACTIVE=0
                ;;
            --help|-h)
                usage
                exit 0
                ;;
            *)
                print_error "Unknown flag: $1"
                usage
                exit 1
                ;;
        esac
        shift
    done
}

# Fail fast in --non-interactive mode when required env vars are missing.
# Runs after load_previous_install so saved .env.install values count.
validate_non_interactive() {
    [ "$NON_INTERACTIVE" = "1" ] || return 0
    local missing=()
    [ -n "${CF_TOKEN:-}" ] || missing+=("CF_TOKEN")
    [ -n "${CF_ACCOUNT_ID:-}" ] || missing+=("CF_ACCOUNT_ID")
    [ -n "${MAILFLARE_ZONE:-}" ] || missing+=("MAILFLARE_ZONE")
    [ -n "${ADMIN_PASSWORD:-}" ] || missing+=("ADMIN_PASSWORD (first-run register, or login if the admin exists)")
    if [ "${EMAIL_TRANSPORT:-cloudflare}" = "resend" ] && [ -z "${RESEND_API_KEY:-}" ]; then
        missing+=("RESEND_API_KEY (required when EMAIL_TRANSPORT=resend)")
    fi
    if [ ${#missing[@]} -gt 0 ]; then
        print_error "Non-interactive run is missing required environment variables:"
        local var
        for var in "${missing[@]}"; do
            print_info "  - $var"
        done
        print_info "Optional: AGENT_SUBDOMAIN (default agents.<zone>), WORKER_NAME,"
        print_info "ADMIN_USERNAME (default admin), MAILFLARE_WORKER_URL, ALLTERNIT_HOST."
        print_info "ADMIN_RECOVERY_EMAIL is additionally required on a first-run register."
        print_info "EMAIL_TRANSPORT defaults to cloudflare (requires Workers Paid); set to resend"
        print_info "for free outbound sending via resend.com (RESEND_API_KEY required)."
        exit 1
    fi
}

# =============================================================================
# PREVIOUS RUN
# =============================================================================

load_previous_install() {
    if [ "$RECONFIGURE" = "1" ] || [ ! -f "$INSTALL_ENV_FILE" ]; then
        return 0
    fi

    print_section "PREVIOUS INSTALL DETECTED"
    print_info "Found $INSTALL_ENV_FILE — checking what's already done..."

    # Merge saved values: they fill in anything NOT already set via the
    # environment (env always wins, so re-runs can override selectively).
    local key value
    local merged_keys=()
    while IFS='=' read -r key value; do
        case "$key" in ''|\#*) continue ;; esac
        if [ -z "${!key:-}" ]; then
            printf -v "$key" '%s' "$value"
            merged_keys+=("$key")
        fi
    done < "$INSTALL_ENV_FILE"

    # D1 state (per-install database_id lives in wrangler.jsonc).
    local db_id=""
    db_id=$(grep -oE '"database_id"[[:space:]]*:[[:space:]]*"[0-9a-f-]{36}"' "$SCRIPT_DIR/wrangler.jsonc" 2>/dev/null | grep -oE '[0-9a-f-]{36}' | head -1 || true)
    if [ -n "$db_id" ]; then
        print_success "D1 database provisioned ($db_id)"
    else
        print_info "D1 not yet provisioned (no database_id in wrangler.jsonc)"
    fi

    # Worker + first-run admin state.
    if [ -n "${MAILFLARE_WORKER_URL:-}" ]; then
        local code status_response has_admin
        code=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 "${MAILFLARE_WORKER_URL}/api/setup/status" 2>/dev/null || true)
        if [ "$code" = "200" ]; then
            status_response=$(curl -s --max-time 10 "${MAILFLARE_WORKER_URL}/api/setup/status" 2>/dev/null || true)
            has_admin=$(echo "$status_response" | json_get "hasAdminAccount")
            if [ "$has_admin" = "true" ]; then
                print_success "Worker live at $MAILFLARE_WORKER_URL (admin account exists)"
            else
                print_success "Worker live at $MAILFLARE_WORKER_URL (no admin account yet)"
            fi
        else
            print_info "Worker $MAILFLARE_WORKER_URL not answering (HTTP $code) — deploy will re-run"
        fi
    fi

    print_info "Completed steps are detected and skipped automatically."
    if [ "$NON_INTERACTIVE" = "1" ]; then
        print_info "Non-interactive: resuming with saved values (environment takes precedence)"
        return 0
    fi
    if [ "$INTERACTIVE" = "1" ]; then
        if confirm "Resume this install, reusing the saved values?"; then
            print_success "Resuming with values from .env.install"
        else
            print_info "Reconfiguring from scratch (saved values ignored)"
            for key in ${merged_keys[@]+"${merged_keys[@]}"}; do
                unset "$key"
            done
        fi
    fi
}

# =============================================================================
# PREREQUISITES
# =============================================================================

check_prereqs() {
    print_section "PREREQUISITE CHECKS"

    case "$(uname -s)" in
        Darwin|Linux) ;;
        *) die "Unsupported OS: $(uname -s). macOS and Linux only." ;;
    esac

    command -v curl &>/dev/null || die "curl is required"
    command -v node &>/dev/null || die "Node.js >= 18 is required (https://nodejs.org)"
    command -v npm &>/dev/null || die "npm is required"

    local node_major
    node_major=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
    [ "$node_major" -ge 18 ] || die "Node.js >= 18 required, found $(node -v)"
    print_success "Node.js $(node -v)"

    if command -v jq &>/dev/null; then
        print_success "jq found (used for JSON parsing)"
    else
        print_info "jq not found — falling back to node for JSON parsing"
    fi

    cd "$SCRIPT_DIR"
    if [ ! -d node_modules ]; then
        print_step "Installing npm dependencies..."
        npm install
    fi
    print_success "npm dependencies present"

    npx wrangler --version &>/dev/null || die "npx wrangler is not working — check the npm install above"
    print_success "wrangler $(npx wrangler --version 2>/dev/null)"
}

check_wrangler_auth() {
    print_section "WRANGLER AUTHENTICATION"
    cd "$SCRIPT_DIR"
    if npx wrangler whoami &>/dev/null; then
        print_success "wrangler is authenticated"
        return 0
    fi

    if [ "$INTERACTIVE" != "1" ]; then
        print_error "wrangler is not authenticated."
        print_info "Set CLOUDFLARE_API_TOKEN (Workers/D1/R2/Queues edit) in the environment,"
        print_info "or run 'npx wrangler login' once before re-running this script."
        exit 1
    fi

    print_warning "wrangler is not authenticated — deploys and D1/R2/Queue commands need it."
    print_info "Note: 'wrangler login' (OAuth) covers deploys and D1/R2/Queues only. The"
    print_info "Email Routing / DNS APIs additionally need the scoped CF_TOKEN collected below."
    while true; do
        read -p "Press Enter to run 'npx wrangler login' (opens your browser)..." -r
        npx wrangler login || true
        if npx wrangler whoami &>/dev/null; then
            print_success "wrangler is authenticated"
            return 0
        fi
        print_warning "wrangler still isn't authenticated."
        if ! confirm "Try logging in again?"; then
            print_info "You can also export CLOUDFLARE_API_TOKEN and re-run this script."
            exit 1
        fi
    done
}

# =============================================================================
# CONFIG COLLECTION
# =============================================================================

collect_config() {
    print_section "CLOUDFLARE CONFIGURATION"

    if [ -z "${CF_TOKEN:-}" ]; then
        print_info "Create a scoped Cloudflare API token at:"
        print_info "  https://dash.cloudflare.com/profile/api-tokens"
        print_info "Required permissions (verified against a live install):"
        print_info "  Account:            Email Sending:Edit, Email Routing Addresses:Edit, DNS Settings:Edit"
        print_info "  Zone (this domain): Zone:Read, DNS:Edit, DNS Settings:Edit, Zone Settings:Edit,"
        print_info "                      Email Routing Rules:Edit"
        print_info "Don't worry about getting these exactly right — the installer probes the token"
        print_info "empirically in a moment and tells you precisely what's missing."
        CF_TOKEN=$(prompt_secret "Cloudflare API token")
    else
        print_success "CF_TOKEN provided via environment"
    fi

    if [ -z "${CF_ACCOUNT_ID:-}" ]; then
        print_info "Find your account ID in the Cloudflare dashboard (right-hand column of any zone overview)."
        CF_ACCOUNT_ID=$(prompt_value "Cloudflare account ID" "")
        [ -n "$CF_ACCOUNT_ID" ] || die "CF_ACCOUNT_ID is required"
    else
        print_success "CF_ACCOUNT_ID provided"
    fi

    if [ -z "${MAILFLARE_ZONE:-}" ]; then
        print_info "Enter a domain whose nameservers already point at Cloudflare (e.g. example.com)."
        MAILFLARE_ZONE=$(prompt_value "Zone domain" "")
        [ -n "$MAILFLARE_ZONE" ] || die "MAILFLARE_ZONE is required"
    fi
    MAILFLARE_ZONE=$(echo "$MAILFLARE_ZONE" | tr '[:upper:]' '[:lower:]' | tr -d ' ')
    print_success "Zone: $MAILFLARE_ZONE"

    if [ -z "${AGENT_SUBDOMAIN:-}" ]; then
        # A dedicated subdomain isolates agent mail from the root domain, so a
        # misbehaving agent cannot burn the root domain's sender reputation.
        print_info "Agent mail uses a dedicated subdomain so a misbehaving agent can't burn your root domain's sender reputation."
        AGENT_SUBDOMAIN=$(prompt_value "Agent subdomain" "agents.${MAILFLARE_ZONE}")
    fi
    AGENT_SUBDOMAIN=$(echo "$AGENT_SUBDOMAIN" | tr '[:upper:]' '[:lower:]' | tr -d ' ')
    print_success "Agent subdomain: $AGENT_SUBDOMAIN"

    if [ -z "${WORKER_NAME:-}" ]; then
        WORKER_NAME=$(prompt_value "Worker name" "$DEFAULT_WORKER_NAME")
    fi
    print_success "Worker name: $WORKER_NAME"

    if [ -z "${EMAIL_TRANSPORT:-}" ]; then
        print_info "Outbound email transport:"
        print_info "  cloudflare = Cloudflare Email Sending (default; requires Workers Paid plan)"
        print_info "  resend     = Resend.com API (free tier 100 emails/day, works on free Workers plan)"
        EMAIL_TRANSPORT=$(prompt_value "Email transport" "cloudflare")
    fi
    EMAIL_TRANSPORT=$(echo "$EMAIL_TRANSPORT" | tr '[:upper:]' '[:lower:]' | tr -d ' ')
    if [ "$EMAIL_TRANSPORT" != "cloudflare" ] && [ "$EMAIL_TRANSPORT" != "resend" ]; then
        die "EMAIL_TRANSPORT must be 'cloudflare' or 'resend' (got '$EMAIL_TRANSPORT')"
    fi
    print_success "Email transport: $EMAIL_TRANSPORT"

    if [ "$EMAIL_TRANSPORT" = "resend" ]; then
        if [ -z "${RESEND_API_KEY:-}" ]; then
            print_info "Get a Resend API key at https://resend.com/api-keys (needs 'Sending' access)."
            RESEND_API_KEY=$(prompt_secret "Resend API key")
        else
            print_success "RESEND_API_KEY provided"
        fi
        RESEND_API_KEY=$(echo "$RESEND_API_KEY" | tr -d ' ')
        [ -n "$RESEND_API_KEY" ] || die "RESEND_API_KEY is required when EMAIL_TRANSPORT=resend"
    fi
}

# =============================================================================
# TOKEN + ZONE VERIFICATION
# =============================================================================

verify_token_and_zone() {
    print_section "VERIFYING CLOUDFLARE TOKEN & ZONE"

    print_step "Verifying API token..."
    local response status
    response=$(cf_api GET "/user/tokens/verify")
    status=$(echo "$response" | json_get "result.status")
    if [ "$status" != "active" ]; then
        print_error "Cloudflare API token is not active (status: ${status:-unknown})."
        print_info "Paste only the token secret value — no 'Bearer' prefix, not the token ID."
        print_info "Expected response: \"success\": true and \"status\": \"active\"."
        exit 1
    fi
    print_success "API token is active"

    print_step "Resolving zone '$MAILFLARE_ZONE'..."
    response=$(cf_api GET "/zones?name=${MAILFLARE_ZONE}&status=active")
    ZONE_ID=$(echo "$response" | json_get "result[0].id")
    local zone_name
    zone_name=$(echo "$response" | json_get "result[0].name")
    if [ -z "$ZONE_ID" ] || [ "$zone_name" != "$MAILFLARE_ZONE" ]; then
        print_error "Zone '$MAILFLARE_ZONE' was not found in this Cloudflare account."
        print_info "Check that the domain is added to the account, its nameservers point at"
        print_info "Cloudflare, and the token has Zone Read on this zone."
        exit 1
    fi
    print_success "Zone resolved: $MAILFLARE_ZONE ($ZONE_ID)"
}

# =============================================================================
# TOKEN PERMISSION PREFLIGHT (empirical)
# =============================================================================
# /user/tokens/verify only proves a token is ACTIVE — not that its permissions
# suffice, and token introspection (GET /user/tokens/{id}) is not permitted for
# scoped tokens (9109). So probe with read-only calls and report the exact gaps.

# probe_perm <label> <path> — returns 0 when the call succeeds.
probe_perm() {
    local label="$1" path="$2"
    local response success code
    response=$(cf_api GET "$path")
    success=$(echo "$response" | json_get "success")
    if [ "$success" = "true" ]; then
        print_success "$label"
        return 0
    fi
    code=$(echo "$response" | json_get "errors[0].code")
    print_error "$label — not granted (Cloudflare API code ${code:-unknown})"
    return 1
}

print_required_permissions() {
    print_info "The token needs exactly these permission groups:"
    if [ "$EMAIL_TRANSPORT" = "resend" ]; then
        print_info "  Zone ($MAILFLARE_ZONE): Zone:Read, DNS:Edit, Email Routing Rules:Edit"
        print_info "Resend handles outbound delivery, so Account → Email Sending:Edit is NOT required."
    else
        print_info "  Account:            Email Sending:Edit, Email Routing Addresses:Edit, DNS Settings:Edit"
        print_info "  Zone ($MAILFLARE_ZONE): Zone:Read, DNS:Edit, DNS Settings:Edit, Zone Settings:Edit,"
        print_info "                      Email Routing Rules:Edit"
    fi
    print_info "Scope the token to: Account = yours, Zone = $MAILFLARE_ZONE (or All zones)."
}

preflight_token_permissions() {
    print_section "TOKEN PERMISSION PREFLIGHT"
    print_info "Probing the token with read-only API calls (verify alone doesn't check permissions)..."

    while true; do
        local missing=()
        local sending_failed=0
        probe_perm "Zone Read              (GET /zones/{id})" \
            "/zones/${ZONE_ID}" || missing+=("Zone → Zone:Read")
        probe_perm "DNS records            (GET /zones/{id}/dns_records)" \
            "/zones/${ZONE_ID}/dns_records?per_page=1" || missing+=("Zone → DNS:Edit")
        probe_perm "Email Routing          (GET /zones/{id}/email/routing/dns)" \
            "/zones/${ZONE_ID}/email/routing/dns" || missing+=("Zone → Email Routing Rules:Edit")

        if [ "$EMAIL_TRANSPORT" != "resend" ]; then
            probe_perm "Email Sending          (GET /zones/{id}/email/sending/subdomains)" \
                "/zones/${ZONE_ID}/email/sending/subdomains" || { missing+=("Account → Email Sending:Edit"); sending_failed=1; }
        fi

        if [ ${#missing[@]} -eq 0 ]; then
            print_success "Token has all required permissions"
            return 0
        fi

        echo ""
        print_error "The API token is missing permissions:"
        local group
        for group in "${missing[@]}"; do
            print_info "  missing: $group"
        done
        print_required_permissions
        if [ "$sending_failed" = "1" ]; then
            echo ""
            print_warning "If Account → Email Sending:Edit is already on the token and this still fails"
            print_warning "with code 2036, the account lacks the Email Sending ENTITLEMENT, which"
            print_warning "requires the Workers Paid plan. Enable it: dash.cloudflare.com → Workers &"
            print_warning "Pages → plan upgrade, or Compute → Email Service → Email Sending → Get started."
            print_warning "Alternatively, abort and re-run with EMAIL_TRANSPORT=resend to send via Resend."
        fi
        print_info "Edit the SAME token (no need to re-enter it here) at:"
        print_info "  https://dash.cloudflare.com/profile/api-tokens"

        if [ "$INTERACTIVE" != "1" ]; then
            print_error "Non-interactive run — fix the token permissions and re-run."
            exit 1
        fi
        read -p "Press Enter after saving the token to re-check..." -r
    done
}

# =============================================================================
# RESOURCE PROVISIONING
# =============================================================================

patch_wrangler_jsonc() {
    local db_id="$1"
    print_step "Writing database_id and vars into wrangler.jsonc..."
    MF_DB_ID="$db_id" MF_WORKER_NAME="$WORKER_NAME" MF_DEFAULT_WORKER_NAME="$DEFAULT_WORKER_NAME" EMAIL_TRANSPORT="$EMAIL_TRANSPORT" node <<'EOF'
const fs = require("fs");
const path = "wrangler.jsonc";
let src = fs.readFileSync(path, "utf8");
const dbId = process.env.MF_DB_ID;
const workerName = process.env.MF_WORKER_NAME;
const defaultWorkerName = process.env.MF_DEFAULT_WORKER_NAME;

// Per-install D1 database_id (account-specific; never commit this value).
if (/"database_id"\s*:/.test(src)) {
    src = src.replace(/"database_id"\s*:\s*"[^"]*"/, `"database_id": "${dbId}"`);
} else {
    const anchor = new RegExp(`("database_name"\\s*:\\s*"${defaultWorkerName}"\\s*,)`);
    if (!anchor.test(src)) {
        console.error(`Could not find the D1 database_name entry for ${defaultWorkerName} in wrangler.jsonc`);
        process.exit(1);
    }
    src = src.replace(anchor, `$1\n\t\t\t"database_id": "${dbId}",`);
}

// Worker rename (name + WORKER_SELF_REFERENCE service binding must agree).
if (workerName !== defaultWorkerName) {
    src = src.replace(/"name"\s*:\s*"allternit-agent-mail"/, `"name": "${workerName}"`);
    src = src.replace(/"service"\s*:\s*"allternit-agent-mail"/, `"service": "${workerName}"`);
}

// Runtime vars: CF_EMAIL_WORKER_NAME must match the deployed Worker name;
// REQUIRE_SEND_APPROVAL gates outbound mail behind human approval;
// EMAIL_TRANSPORT selects the outbound provider.
if (/"CF_EMAIL_WORKER_NAME"\s*:/.test(src)) {
    src = src.replace(/"CF_EMAIL_WORKER_NAME"\s*:\s*"[^"]*"/, `"CF_EMAIL_WORKER_NAME": "${workerName}"`);
} else {
    src = src.replace(/"vars"\s*:\s*\{/, `"vars": {\n\t\t"CF_EMAIL_WORKER_NAME": "${workerName}",`);
}
if (/"EMAIL_TRANSPORT"\s*:/.test(src)) {
    src = src.replace(/"EMAIL_TRANSPORT"\s*:\s*"[^"]*"/, `"EMAIL_TRANSPORT": "${EMAIL_TRANSPORT}"`);
} else {
    src = src.replace(/"vars"\s*:\s*\{/, `"vars": {\n\t\t"EMAIL_TRANSPORT": "${EMAIL_TRANSPORT}",`);
}
if (!/"REQUIRE_SEND_APPROVAL"\s*:/.test(src)) {
    src = src.replace(/"vars"\s*:\s*\{/, `"vars": {\n\t\t"REQUIRE_SEND_APPROVAL": "true",`);
}

// The send_email binding requires the Cloudflare Email Sending entitlement
// (Workers Paid). Remove it when using Resend so the worker deploys on the
// free plan; keep (or restore) it for the Cloudflare transport.
const emailTransport = process.env.EMAIL_TRANSPORT || "cloudflare";
if (emailTransport === "resend") {
    src = src.replace(/"send_email"\s*:\s*\[[\s\S]*?\]\s*,?/, "");
} else if (!/"send_email"\s*:/.test(src)) {
    src = src.replace(/(\}\s*,?\s*"observability")/, `,\n\t"send_email": [{ "name": "EMAIL", "remote": true }]\n$1`);
}

fs.writeFileSync(path, src);
console.log("wrangler.jsonc updated");
EOF
}

provision_d1() {
    print_step "Checking D1 database '$D1_NAME'..."
    cd "$SCRIPT_DIR"
    local db_id=""
    db_id=$(npx wrangler d1 list 2>/dev/null | grep "$D1_NAME" | grep -oE '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}' | head -1 || true)
    if [ -z "$db_id" ]; then
        print_step "Creating D1 database '$D1_NAME'..."
        local create_output
        create_output=$(npx wrangler d1 create "$D1_NAME" 2>&1) || {
            echo "$create_output"
            die "wrangler d1 create failed"
        }
        db_id=$(echo "$create_output" | grep -oE '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}' | head -1)
        [ -n "$db_id" ] || die "Could not parse database_id from wrangler output"
        print_success "Created D1 database ($db_id)"
    else
        print_success "D1 database already exists ($db_id)"
    fi
    patch_wrangler_jsonc "$db_id"
}

# R2 requires one-time, dashboard-only activation on the account (API code
# 10042). Poll until the user enables it, then let the caller retry.
wait_for_r2_activation() {
    local timeout=600 interval=15 elapsed=0
    print_warning "R2 is not enabled on this Cloudflare account yet (API code 10042)."
    print_info "R2 activation is a one-time dashboard step (may ask for a payment method):"
    print_info "  https://dash.cloudflare.com/${CF_ACCOUNT_ID}/r2"
    print_info "Enable R2 there — this script polls every ${interval}s and continues automatically."
    while [ "$elapsed" -lt "$timeout" ]; do
        if npx wrangler r2 bucket list &>/dev/null; then
            print_success "R2 is enabled — continuing"
            return 0
        fi
        print_info "  still waiting for R2 activation... ($((elapsed / 60))m $((elapsed % 60))s elapsed)"
        sleep "$interval"
        elapsed=$((elapsed + interval))
    done
    print_error "Timed out (10 min) waiting for R2 activation."
    print_info "Enable R2 at the link above and re-run this script — completed steps are skipped."
    exit 1
}

provision_r2() {
    print_step "Checking R2 bucket '$R2_BUCKET'..."
    cd "$SCRIPT_DIR"

    local list_output
    if ! list_output=$(npx wrangler r2 bucket list 2>&1); then
        if echo "$list_output" | grep -qiE "10042|enable R2"; then
            wait_for_r2_activation
        else
            echo "$list_output"
            die "wrangler r2 bucket list failed"
        fi
    fi

    if npx wrangler r2 bucket list 2>/dev/null | grep -q "$R2_BUCKET"; then
        print_success "R2 bucket already exists"
        return 0
    fi

    print_step "Creating R2 bucket '$R2_BUCKET'..."
    local create_output
    if create_output=$(npx wrangler r2 bucket create "$R2_BUCKET" 2>&1); then
        print_success "R2 bucket created"
        return 0
    fi
    if echo "$create_output" | grep -qiE "10042|enable R2"; then
        wait_for_r2_activation
        print_step "Retrying R2 bucket creation..."
        npx wrangler r2 bucket create "$R2_BUCKET"
        print_success "R2 bucket created"
    else
        echo "$create_output"
        die "wrangler r2 bucket create failed"
    fi
}

provision_queues() {
    print_step "Checking queues..."
    cd "$SCRIPT_DIR"
    local existing
    existing=$(npx wrangler queues list 2>/dev/null || true)
    local queue
    for queue in "$QUEUE_INBOUND" "$QUEUE_OUTBOUND"; do
        if echo "$existing" | grep -q "$queue"; then
            print_success "Queue '$queue' already exists"
        else
            print_step "Creating queue '$queue'..."
            # Deploy also auto-creates queues declared in wrangler.jsonc, so a
            # failure here (older wrangler, permissions) is non-fatal.
            if npx wrangler queues create "$queue" 2>/dev/null; then
                print_success "Queue '$queue' created"
            else
                print_warning "Could not create queue '$queue' explicitly — it will be auto-created on deploy"
            fi
        fi
    done
}

put_secret() {
    local name="$1" value="$2"
    printf '%s' "$value" | npx wrangler secret put "$name" >/dev/null
    print_success "Secret $name set"
}

provision_secrets() {
    print_step "Setting Worker secrets (values are never echoed)..."
    cd "$SCRIPT_DIR"
    put_secret CF_TOKEN "$CF_TOKEN"
    put_secret CF_ACCOUNT_ID "$CF_ACCOUNT_ID"
    if [ "$EMAIL_TRANSPORT" = "resend" ]; then
        put_secret RESEND_API_KEY "$RESEND_API_KEY"
    fi
}

provision_resources() {
    print_section "PROVISIONING CLOUDFLARE RESOURCES"
    provision_d1
    provision_r2
    provision_queues
    provision_secrets
}

# =============================================================================
# MIGRATE + DEPLOY
# =============================================================================

migrate_and_deploy() {
    print_section "MIGRATING DATABASE & DEPLOYING WORKER"
    cd "$SCRIPT_DIR"

    print_step "Applying remote D1 migrations..."
    npm run db:migrate:remote
    print_success "Migrations applied"

    print_step "Building and deploying the Worker (this can take a few minutes)..."
    local deploy_output
    if deploy_output=$(npm run deploy 2>&1); then
        print_success "Worker deployed"
        return 0
    fi

    echo "$deploy_output"
    if echo "$deploy_output" | grep -qiE "triggers failed to deploy|/workflows/"; then
        print_error "Deploy failed on the Workflows trigger (database-backup workflow)."
        print_info "This account doesn't have the Cloudflare Workflows product. The"
        print_info "'workflows' block in wrangler.jsonc ships commented out for exactly this"
        print_info "reason — if it was re-enabled, comment it out again and re-run this script."
    elif echo "$deploy_output" | grep -qiE "R2 bucket.*not (found|exist)|bucket_name"; then
        print_error "Deploy failed on the R2 binding."
        print_info "The bucket '$R2_BUCKET' must exist before deploy — the R2 step above"
        print_info "normally handles this. Re-run this script to retry."
    fi
    exit 1
}

# =============================================================================
# DNS / EMAIL ROUTING
# =============================================================================

setup_dns() {
    print_section "DNS & EMAIL ROUTING"

    print_step "Enabling inbound Email Routing + MX/SPF/DKIM records for $MAILFLARE_ZONE..."
    local response success message
    response=$(cf_api POST "/zones/${ZONE_ID}/email/routing/dns")
    success=$(echo "$response" | json_get "success")
    if [ "$success" = "true" ]; then
        print_success "Email Routing enabled (records provisioned)"
    else
        message=$(echo "$response" | json_get "errors[0].message")
        print_warning "Email Routing DNS call returned: ${message:-unknown error} (may already be enabled — continuing)"
    fi

    if [ "$EMAIL_TRANSPORT" = "resend" ]; then
        provision_resend_domain
    else
        print_step "Enabling Cloudflare Email Sending for subdomain $AGENT_SUBDOMAIN..."
        response=$(cf_api POST "/zones/${ZONE_ID}/email/sending/subdomains" "{\"name\":\"${AGENT_SUBDOMAIN}\"}")
        success=$(echo "$response" | json_get "success")
        if [ "$success" = "true" ]; then
            print_success "Sending subdomain enabled: $AGENT_SUBDOMAIN"
        else
            message=$(echo "$response" | json_get "errors[0].message")
            print_warning "Sending-subdomain call returned: ${message:-unknown error} (may already exist — continuing)"
        fi
    fi

    print_step "Waiting for Email Routing DNS records to be ready (up to $((DNS_POLL_TIMEOUT / 60)) min)..." 
    local elapsed=0 missing_count="?"
    while [ "$elapsed" -lt "$DNS_POLL_TIMEOUT" ]; do
        response=$(cf_api GET "/zones/${ZONE_ID}/email/routing/dns")
        success=$(echo "$response" | json_get "success")
        if [ "$success" = "true" ]; then
            missing_count=$(echo "$response" | node -e '
let data = "";
process.stdin.on("data", (c) => (data += c)).on("end", () => {
    try {
        const result = JSON.parse(data).result || {};
        const missing = (result.errors || []).filter((e) => e.missing).length;
        console.log(missing);
    } catch {
        console.log("?");
    }
});')
            if [ "$missing_count" = "0" ]; then
                print_success "All Email Routing DNS records are in place"
                break
            fi
        fi
        print_info "  $missing_count record(s) still missing — waiting ${DNS_POLL_INTERVAL}s..."
        sleep "$DNS_POLL_INTERVAL"
        elapsed=$((elapsed + DNS_POLL_INTERVAL))
    done
    if [ "$elapsed" -ge "$DNS_POLL_TIMEOUT" ]; then
        print_warning "Timed out waiting for DNS records. Check the zone in the Cloudflare dashboard"
        print_info "(Email Routing → your zone) and re-run this script — it is safe to re-run."
    fi

    if [ "$EMAIL_TRANSPORT" = "resend" ]; then
        wait_for_resend_verification
    fi

    setup_dmarc
}

setup_dmarc() {
    print_step "Adding DMARC record for $AGENT_SUBDOMAIN..."
    local response success
    response=$(cf_api POST "/zones/${ZONE_ID}/dns_records" \
        "{\"type\":\"TXT\",\"name\":\"_dmarc.${AGENT_SUBDOMAIN}\",\"content\":\"v=DMARC1; p=quarantine;\",\"ttl\":3600}")
    success=$(echo "$response" | json_get "success")
    if [ "$success" = "true" ]; then
        print_success "DMARC record created: _dmarc.${AGENT_SUBDOMAIN}"
    else
        print_warning "Could not create the DMARC record automatically (token may lack Zone DNS Edit)."
        print_info "Add this DNS TXT record manually in the Cloudflare dashboard:"
        print_info "  Type:    TXT"
        print_info "  Name:    _dmarc.${AGENT_SUBDOMAIN}"
        print_info "  Content: v=DMARC1; p=quarantine;"
    fi
}

# =============================================================================
# RESEND OUTBOUND TRANSPORT (free tier, no Workers Paid plan required)
# =============================================================================

RESEND_API_BASE="https://api.resend.com"

# Authenticated Resend API call. Prints raw JSON.
resend_api() {
    local method="$1" path="$2" body="${3:-}"
    local args=(
        -sS -X "$method" "${RESEND_API_BASE}${path}"
        -H "Authorization: Bearer ${RESEND_API_KEY}"
        -H "Content-Type: application/json"
    )
    [ -n "$body" ] && args+=(-d "$body")
    curl "${args[@]}"
}

# Find a Resend domain by name via the list endpoint.
resend_find_domain() {
    local name="$1"
    resend_api GET "/domains" | node -e '
let data = "";
process.stdin.on("data", (c) => (data += c)).on("end", () => {
    try {
        const parsed = JSON.parse(data);
        const list = parsed.data || parsed;
        const match = (Array.isArray(list) ? list : []).find((d) => d.name === process.argv[1]);
        if (match) console.log(match.id);
    } catch {
        process.exit(0);
    }
});' "$name"
}

# Normalize a Resend DNS record name to a Cloudflare-relative name.
resend_record_name_to_cf() {
    local name="$1"
    local zone="$2"
    # Resend returns names like "agents.example.com" or "_dmarc.agents.example.com".
    # Cloudflare wants them relative to the zone, e.g. "agents" or "_dmarc.agents".
    if [ "$name" = "$zone" ]; then
        echo "@"
    elif [[ "$name" == *."${zone}" ]]; then
        echo "${name%.${zone}}"
    else
        echo "$name"
    fi
}

# Create or update a Cloudflare DNS record idempotently for a Resend record.
resend_create_dns_record() {
    local record_type="$1" record_name="$2" record_value="$3" record_priority="${4:-}"
    local cf_name
    cf_name=$(resend_record_name_to_cf "$record_name" "$MAILFLARE_ZONE")

    # Search for an existing matching record.
    local existing search_name
    if [ "$cf_name" = "@" ]; then
        search_name="$MAILFLARE_ZONE"
    else
        search_name="${cf_name}.${MAILFLARE_ZONE}"
    fi
    existing=$(cf_api GET "/zones/${ZONE_ID}/dns_records?type=${record_type}&name=${search_name}&per_page=100" | node -e '
let data = "";
process.stdin.on("data", (c) => (data += c)).on("end", () => {
    try {
        const parsed = JSON.parse(data);
        const records = (parsed.result || []).filter((r) => r.content === process.argv[1]);
        if (records.length) console.log(records[0].id);
    } catch {
        process.exit(0);
    }
};' "$record_value")

    local body
    if [ -n "$record_priority" ]; then
        body="{\"type\":\"${record_type}\",\"name\":\"${cf_name}\",\"content\":\"${record_value}\",\"priority\":${record_priority},\"ttl\":3600}"
    else
        body="{\"type\":\"${record_type}\",\"name\":\"${cf_name}\",\"content\":\"${record_value}\",\"ttl\":3600}"
    fi

    if [ -n "$existing" ]; then
        print_info "  Updating existing ${record_type} record for ${cf_name}"
        cf_api_expect "Update ${record_type} ${cf_name}" PUT "/zones/${ZONE_ID}/dns_records/${existing}" "$body" >/dev/null
    else
        cf_api_expect "Create ${record_type} ${cf_name}" POST "/zones/${ZONE_ID}/dns_records" "$body" >/dev/null
    fi
}

provision_resend_domain() {
    print_step "Configuring Resend outbound domain for $AGENT_SUBDOMAIN..."

    local domain_id
    domain_id=$(resend_find_domain "$AGENT_SUBDOMAIN")
    if [ -n "$domain_id" ]; then
        print_info "Resend domain already exists ($domain_id)"
    else
        print_step "Creating Resend domain $AGENT_SUBDOMAIN..."
        local create_response create_name create_message
        create_response=$(resend_api POST "/domains" "{\"name\":\"${AGENT_SUBDOMAIN}\"}")
        domain_id=$(echo "$create_response" | json_get "id")
        create_name=$(echo "$create_response" | json_get "name")
        if [ -z "$domain_id" ]; then
            # Domain may already exist (either on this account or under another one).
            if [ "$create_name" = "already_exists" ] || [ "$create_name" = "invalid_request" ]; then
                create_message=$(echo "$create_response" | json_get "message")
                print_warning "Resend create returned: ${create_message:-domain already exists}"
                domain_id=$(resend_find_domain "$AGENT_SUBDOMAIN")
            fi
            if [ -z "$domain_id" ]; then
                print_error "Resend domain creation failed: $create_response"
                print_info "Check that the Resend API key has 'Sending' access and that the"
                print_info "subdomain is not already registered under a different Resend account."
                exit 1
            fi
            print_info "Reusing existing Resend domain ($domain_id)"
        else
            print_success "Resend domain created ($domain_id)"
        fi
    fi

    # Save for polling.
    RESEND_DOMAIN_ID="$domain_id"

    print_step "Fetching Resend DNS records for $AGENT_SUBDOMAIN..."
    local records_response records_count
    records_response=$(resend_api GET "/domains/${domain_id}")
    records_count=$(echo "$records_response" | node -e '
let data = "";
process.stdin.on("data", (c) => (data += c)).on("end", () => {
    try {
        const parsed = JSON.parse(data);
        const records = parsed.records || parsed.data?.records || [];
        console.log(records.length);
    } catch {
        console.log("0");
    }
};')
    if [ "$records_count" = "0" ]; then
        print_warning "Resend returned no DNS records for $AGENT_SUBDOMAIN yet."
        print_info "The installer will still poll for verification, but you may need to add"
        print_info "the records manually from https://resend.com/domains if verification fails."
    else
        print_step "Creating DNS records in Cloudflare for Resend..."
        echo "$records_response" | node -e '
let data = "";
process.stdin.on("data", (c) => (data += c)).on("end", () => {
    const parsed = JSON.parse(data);
    const records = parsed.records || parsed.data?.records || [];
    records.forEach((r) => {
        const parts = [r.type || "", r.name || "", r.value || ""];
        if (r.priority !== undefined && r.priority !== null) parts.push(String(r.priority));
        console.log(parts.join("\t"));
    });
});' | while IFS=$'\t' read -r r_type r_name r_value r_priority; do
            [ -n "$r_type" ] || continue
            resend_create_dns_record "$r_type" "$r_name" "$r_value" "$r_priority"
        done
        print_success "Resend DNS records created/updated in Cloudflare"
    fi
}

wait_for_resend_verification() {
    print_step "Waiting for Resend to verify $AGENT_SUBDOMAIN (up to $((DNS_POLL_TIMEOUT / 60)) min)..."
    local elapsed=0 status="pending"
    while [ "$elapsed" -lt "$DNS_POLL_TIMEOUT" ]; do
        status=$(resend_api GET "/domains/${RESEND_DOMAIN_ID}" | node -e '
let data = "";
process.stdin.on("data", (c) => (data += c)).on("end", () => {
    try {
        const parsed = JSON.parse(data);
        console.log(parsed.status || parsed.data?.status || "pending");
    } catch {
        console.log("pending");
    }
};')
        if [ "$status" = "verified" ]; then
            print_success "Resend domain verified: $AGENT_SUBDOMAIN"
            return 0
        fi
        print_info "  Resend status: $status — waiting ${DNS_POLL_INTERVAL}s..."
        sleep "$DNS_POLL_INTERVAL"
        elapsed=$((elapsed + DNS_POLL_INTERVAL))
    done
    print_warning "Timed out waiting for Resend verification (last status: $status)."
    print_info "DNS changes can take a few minutes to propagate. You can check status in"
    print_info "the Resend dashboard (https://resend.com/domains) or re-run this script."
}

# =============================================================================
# WORKER URL
# =============================================================================

resolve_worker_url() {
    print_section "RESOLVING WORKER URL"

    if [ -n "${MAILFLARE_WORKER_URL:-}" ]; then
        print_success "Worker URL provided: $MAILFLARE_WORKER_URL"
        return 0
    fi

    print_step "Looking up the account's workers.dev subdomain..."
    local response subdomain
    response=$(cf_api GET "/accounts/${CF_ACCOUNT_ID}/workers/subdomain")
    subdomain=$(echo "$response" | json_get "result.subdomain")
    if [ -n "$subdomain" ]; then
        MAILFLARE_WORKER_URL="https://${WORKER_NAME}.${subdomain}.workers.dev"
        print_success "Worker URL: $MAILFLARE_WORKER_URL"
    else
        print_warning "Could not determine the workers.dev subdomain via the API."
        print_info "Find the URL in the Cloudflare dashboard → Workers & Pages → $WORKER_NAME."
        MAILFLARE_WORKER_URL=$(prompt_value "Worker URL (e.g. https://${WORKER_NAME}.<subdomain>.workers.dev)" "")
        [ -n "$MAILFLARE_WORKER_URL" ] || die "Worker URL is required"
    fi
    MAILFLARE_WORKER_URL="${MAILFLARE_WORKER_URL%/}"

    print_step "Waiting for the Worker to answer /api/setup/status..."
    local elapsed=0 code="000"
    while [ "$elapsed" -lt "$WORKER_WAIT_TIMEOUT" ]; do
        code=$(curl -s -o /dev/null -w "%{http_code}" "${MAILFLARE_WORKER_URL}/api/setup/status" || true)
        if [ "$code" = "200" ]; then
            print_success "Worker is live"
            return 0
        fi
        print_info "  HTTP $code — waiting 5s..."
        sleep 5
        elapsed=$((elapsed + 5))
    done
    print_warning "Worker did not answer within ${WORKER_WAIT_TIMEOUT}s (last HTTP $code)."
    print_info "If you use a custom route instead of workers.dev, re-run with MAILFLARE_WORKER_URL set."
    confirm "Continue anyway?" || exit 1
}

# =============================================================================
# ADMIN BOOTSTRAP
# =============================================================================

api_call() {
    # api_call <method> <path> <bearer-token-or-empty> <json-body-or-empty>
    local method="$1" path="$2" token="${3:-}" body="${4:-}"
    local args=(
        -sS -X "$method" "${MAILFLARE_WORKER_URL}${path}"
        -H "Content-Type: application/json"
    )
    [ -n "$token" ] && args+=(-H "Authorization: Bearer ${token}")
    [ -n "$body" ] && args+=(-d "$body")
    curl "${args[@]}"
}

bootstrap_admin() {
    print_section "BOOTSTRAPPING ADMIN ACCOUNT"

    local status_response has_admin
    status_response=$(api_call GET "/api/setup/status")
    has_admin=$(echo "$status_response" | json_get "hasAdminAccount")

    local admin_email=""
    if [ "$has_admin" = "true" ]; then
        print_warning "An admin account already exists — registration is closed."
        admin_email=$(prompt_value "Existing admin email" "${ADMIN_USERNAME:-admin}@${AGENT_SUBDOMAIN}")
        local existing_password="${ADMIN_PASSWORD:-}"
        [ -n "$existing_password" ] || existing_password=$(prompt_secret "Admin password")
        login_admin "$admin_email" "$existing_password"
    else
        ADMIN_USERNAME="${ADMIN_USERNAME:-$(prompt_value "Admin username (local-part)" "admin")}"
        ADMIN_RECOVERY_EMAIL="${ADMIN_RECOVERY_EMAIL:-$(prompt_value "Recovery email (for password resets)" "")}"
        [ -n "$ADMIN_RECOVERY_EMAIL" ] || die "A recovery email is required"
        if [ -z "${ADMIN_PASSWORD:-}" ]; then
            ADMIN_PASSWORD=$(prompt_secret "Admin password (min 8 chars)")
            local confirm_password
            confirm_password=$(prompt_secret "Confirm admin password")
            [ "$ADMIN_PASSWORD" = "$confirm_password" ] || die "Passwords do not match"
        fi
        [ "${#ADMIN_PASSWORD}" -ge 8 ] || die "Admin password must be at least 8 characters"
        admin_email="${ADMIN_USERNAME}@${AGENT_SUBDOMAIN}"

        print_step "Registering first admin: $admin_email..."
        local response ok error
        response=$(api_call POST "/api/auth/register" "" \
            "{\"domain\":\"${AGENT_SUBDOMAIN}\",\"username\":\"${ADMIN_USERNAME}\",\"password\":\"${ADMIN_PASSWORD}\",\"resetEmail\":\"${ADMIN_RECOVERY_EMAIL}\"}")
        ok=$(echo "$response" | json_get "ok")
        if [ "$ok" != "true" ]; then
            error=$(echo "$response" | json_get "error")
            print_error "Registration failed: ${error:-$response}"
            print_info "Registration onboards the domain via the Cloudflare API — a 502 here"
            print_info "almost always means the CF_TOKEN secret is missing a permission group"
            print_info "(see the preflight list above). Nothing half-created blocks a retry:"
            print_info "fix the token, then re-run this script."
            exit 1
        fi
        SESSION_TOKEN=$(echo "$response" | json_get "token")
        [ -n "$SESSION_TOKEN" ] || die "Registration did not return a session token"
        print_success "Admin account registered"
    fi

    print_step "Creating admin-scope API key 'allternit-integration'..."
    local key_response
    key_response=$(api_call POST "/api/api-keys" "$SESSION_TOKEN" \
        "{\"name\":\"allternit-integration\",\"scopes\":[\"admin\"]}")
    MAILFLARE_ADMIN_KEY=$(echo "$key_response" | json_get "key")
    if [ -z "$MAILFLARE_ADMIN_KEY" ]; then
        print_error "Failed to create the admin API key: $key_response"
        exit 1
    fi

    echo ""
    echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${YELLOW}  ADMIN API KEY — shown ONCE, store it somewhere safe:${NC}"
    echo -e "${GREEN}  $MAILFLARE_ADMIN_KEY${NC}"
    echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""

    write_install_env "$admin_email"
}

login_admin() {
    local email="$1" password="$2"
    print_step "Logging in as $email..."
    local response ok error
    response=$(api_call POST "/api/auth/login" "" "{\"email\":\"${email}\",\"password\":\"${password}\"}")
    ok=$(echo "$response" | json_get "ok")
    if [ "$ok" != "true" ]; then
        error=$(echo "$response" | json_get "error")
        print_error "Login failed: ${error:-$response}"
        exit 1
    fi
    SESSION_TOKEN=$(echo "$response" | json_get "token")
    [ -n "$SESSION_TOKEN" ] || die "Login did not return a session token"
    print_success "Logged in"
}

write_install_env() {
    local admin_email="$1"
    cat > "$INSTALL_ENV_FILE" <<EOF
# allternit agent email — install state written by setup.sh.
# Gitignored (.env*); do NOT commit. Sourced on re-runs for reuse.
MAILFLARE_WORKER_URL=$MAILFLARE_WORKER_URL
MAILFLARE_ADMIN_KEY=$MAILFLARE_ADMIN_KEY
MAILFLARE_ADMIN_EMAIL=$admin_email
AGENT_SUBDOMAIN=$AGENT_SUBDOMAIN
MAILFLARE_ZONE=$MAILFLARE_ZONE
WORKER_NAME=$WORKER_NAME
CF_ACCOUNT_ID=$CF_ACCOUNT_ID
EMAIL_TRANSPORT=$EMAIL_TRANSPORT
EOF
    if [ "$EMAIL_TRANSPORT" = "resend" ]; then
        echo "RESEND_API_KEY=$RESEND_API_KEY" >> "$INSTALL_ENV_FILE"
    fi
    chmod 600 "$INSTALL_ENV_FILE"
    print_success "Wrote install state to $INSTALL_ENV_FILE (mode 600, gitignored)"
}

# =============================================================================
# ROOT .env MERGE
# =============================================================================

write_root_env() {
    print_section "WRITING ROOT .env"
    print_info "Merging into $ROOT_ENV_FILE (existing non-empty values are kept unless you confirm)."

    MAILFLARE_WEBHOOK_SECRET="${ALLTERNIT_MAILFLARE_WEBHOOK_SECRET:-$(random_hex)}"
    upsert_env "$ROOT_ENV_FILE" "ALLTERNIT_MAILFLARE_URL" "$MAILFLARE_WORKER_URL"
    upsert_env "$ROOT_ENV_FILE" "ALLTERNIT_MAILFLARE_ADMIN_KEY" "$MAILFLARE_ADMIN_KEY"
    upsert_env "$ROOT_ENV_FILE" "ALLTERNIT_BOT_EMAIL_DOMAIN" "$AGENT_SUBDOMAIN"
    upsert_env "$ROOT_ENV_FILE" "ALLTERNIT_MAILFLARE_WEBHOOK_SECRET" "$MAILFLARE_WEBHOOK_SECRET"
    print_info "Note: ALLTERNIT_MAILFLARE_WEBHOOK_SECRET is replaced by the real signing"
    print_info "secret if a webhook is registered below (the API generates it server-side)."
}

# =============================================================================
# SMOKE TEST
# =============================================================================

smoke_test() {
    print_section "SMOKE TEST"

    if [ "$SKIP_SMOKE_TEST" = "1" ]; then
        print_info "Skipped via --skip-smoke-test"
        return 0
    fi
    if [ "$INTERACTIVE" = "1" ] && ! confirm "Run the end-to-end smoke test (mailbox + gated send + approve + cleanup)?"; then
        print_info "Skipping smoke test"
        return 0
    fi

    local test_local_part="smoketest"
    local test_address="${test_local_part}@${AGENT_SUBDOMAIN}"

    print_step "Looking up domain id for $AGENT_SUBDOMAIN..."
    local domains_response domain_id
    domains_response=$(api_call GET "/api/domains" "$MAILFLARE_ADMIN_KEY")
    domain_id=$(echo "$domains_response" | node -e '
let data = "";
process.stdin.on("data", (c) => (data += c)).on("end", () => {
    try {
        const domains = JSON.parse(data).domains || [];
        const match = domains.find((d) => d.hostname === process.argv[1]);
        if (match) console.log(match.id);
    } catch {
        process.exit(0);
    }
});' "$AGENT_SUBDOMAIN")
    if [ -z "$domain_id" ]; then
        print_warning "Domain $AGENT_SUBDOMAIN not found via the API — skipping smoke test."
        print_info "Response was: $domains_response"
        return 0
    fi

    print_step "Creating test mailbox $test_address..."
    local mailbox_response mailbox_id mailbox_error
    mailbox_response=$(api_call POST "/api/mailboxes" "$MAILFLARE_ADMIN_KEY" \
        "{\"domainId\":\"${domain_id}\",\"localPart\":\"${test_local_part}\",\"displayName\":\"Smoke Test\"}")
    mailbox_id=$(echo "$mailbox_response" | json_get "id")
    if [ -z "$mailbox_id" ]; then
        mailbox_error=$(echo "$mailbox_response" | json_get "error")
        if [ "$mailbox_error" = "Mailbox already exists" ]; then
            print_info "Test mailbox already exists — reusing it"
            mailbox_id=$(api_call GET "/api/mailboxes" "$MAILFLARE_ADMIN_KEY" | node -e '
let data = "";
process.stdin.on("data", (c) => (data += c)).on("end", () => {
    try {
        const mailboxes = JSON.parse(data).mailboxes || [];
        const match = mailboxes.find((m) => m.localPart === process.argv[1]);
        if (match) console.log(match.id);
    } catch {
        process.exit(0);
    }
});' "$test_local_part")
        fi
    fi
    if [ -z "$mailbox_id" ]; then
        print_warning "Could not create the test mailbox — skipping the rest of the smoke test."
        print_info "Response was: $mailbox_response"
        return 0
    fi
    print_success "Test mailbox ready ($mailbox_id)"

    print_step "Creating a send+read key scoped to the test mailbox..."
    local key_response test_key test_key_id
    key_response=$(api_call POST "/api/api-keys" "$SESSION_TOKEN" \
        "{\"name\":\"smoketest-$(date +%s)\",\"scopes\":[\"send\",\"read\"],\"mailboxIds\":[\"${mailbox_id}\"]}")
    test_key=$(echo "$key_response" | json_get "key")
    test_key_id=$(echo "$key_response" | json_get "id")
    if [ -z "$test_key" ] || [ -z "$test_key_id" ]; then
        print_warning "Could not create the test API key — aborting smoke test: $key_response"
        smoke_cleanup "$mailbox_id" ""
        return 0
    fi

    print_step "Sending gated outbound (expect pending_approval)..."
    local admin_email send_response send_status job_id
    admin_email=$(grep -E '^MAILFLARE_ADMIN_EMAIL=' "$INSTALL_ENV_FILE" | cut -d= -f2-)
    send_response=$(curl -sS -X POST "${MAILFLARE_WORKER_URL}/api/v1/send" \
        -H "Authorization: Bearer ${test_key}" \
        -H "Content-Type: application/json" \
        -H "Idempotency-Key: smoketest-$(date +%s)" \
        -d "{\"from\":\"${test_address}\",\"to\":\"${admin_email}\",\"subject\":\"mailflare smoke test\",\"text\":\"Automated smoke test from setup.sh — safe to ignore.\",\"mailboxId\":\"${mailbox_id}\"}")
    send_status=$(echo "$send_response" | json_get "status")
    job_id=$(echo "$send_response" | json_get "jobId")
    if [ "$send_status" != "pending_approval" ] || [ -z "$job_id" ]; then
        print_warning "Expected status 'pending_approval', got '${send_status:-nothing}': $send_response"
        smoke_cleanup "$mailbox_id" "$test_key_id"
        return 0
    fi
    print_success "Outbound is gated as expected (job $job_id is pending_approval)"

    print_step "Approving the outbound job..."
    local approve_response approve_status
    approve_response=$(api_call POST "/api/v1/outbound/${job_id}/approve" "$test_key")
    approve_status=$(echo "$approve_response" | json_get "status")
    if [ "$approve_status" = "queued" ]; then
        print_success "Job approved and queued for delivery"
        print_info "Delivery itself depends on DNS propagation; check the dashboard outbox if it matters."
    else
        print_warning "Approve returned unexpected status '${approve_status:-nothing}': $approve_response"
    fi

    smoke_cleanup "$mailbox_id" "$test_key_id"
    print_success "Smoke test complete"
}

smoke_cleanup() {
    local mailbox_id="$1" test_key_id="$2"
    print_step "Cleaning up smoke-test artifacts..."
    if [ -n "$test_key_id" ]; then
        api_call DELETE "/api/api-keys/${test_key_id}" "$SESSION_TOKEN" >/dev/null || true
        print_success "Revoked test API key"
    fi
    if [ -n "$mailbox_id" ]; then
        api_call DELETE "/api/mailboxes/${mailbox_id}" "$MAILFLARE_ADMIN_KEY" >/dev/null || true
        print_success "Deleted test mailbox"
    fi
}

register_webhook() {
    print_step "Inbound webhook registration..."
    local host="${ALLTERNIT_HOST:-}"
    if [ -z "$host" ] && [ "$INTERACTIVE" = "1" ]; then
        host=$(prompt_value "Public host of your allternit instance (blank to skip)" "")
    fi
    if [ -z "$host" ]; then
        print_info "No allternit host given. Register the inbound webhook later with:"
        echo ""
        echo "  curl -X POST ${MAILFLARE_WORKER_URL}/api/webhooks \\"
        echo "    -H \"Authorization: Bearer <session-token>\" \\"
        echo "    -H \"Content-Type: application/json\" \\"
        echo "    -d '{\"url\":\"https://<your-allternit-host>/api/v1/agent-email/inbound\",\"events\":[\"message.inbound\"]}'"
        echo ""
        print_info "The response contains the signing secret — set it as ALLTERNIT_MAILFLARE_WEBHOOK_SECRET."
        return 0
    fi
    host="${host#https://}"
    host="${host#http://}"
    host="${host%/}"

    local response webhook_secret
    response=$(api_call POST "/api/webhooks" "$SESSION_TOKEN" \
        "{\"url\":\"https://${host}/api/v1/agent-email/inbound\",\"events\":[\"message.inbound\"]}")
    webhook_secret=$(echo "$response" | json_get "secret")
    if [ -z "$webhook_secret" ]; then
        print_warning "Webhook registration failed: $response"
        return 0
    fi
    print_success "Registered message.inbound webhook → https://${host}/api/v1/agent-email/inbound"
    # The API generates the per-webhook signing secret; keep the root .env in
    # sync (we know we generated the previous placeholder, so force it).
    upsert_env "$ROOT_ENV_FILE" "ALLTERNIT_MAILFLARE_WEBHOOK_SECRET" "$webhook_secret" "force"
}

# =============================================================================
# NEXT STEPS
# =============================================================================

print_next_steps() {
    print_section "INSTALL COMPLETE"
    echo ""
    echo -e "${GREEN}The allternit agent email rail is deployed.${NC}"
    echo ""
    echo "  Worker URL:        $MAILFLARE_WORKER_URL"
    echo "  Dashboard:         $MAILFLARE_WORKER_URL (log in with your admin account)"
    echo "  Agent domain:      $AGENT_SUBDOMAIN"
    echo "  Install state:     $INSTALL_ENV_FILE"
    echo ""
    echo "Root .env now provides:"
    echo "  ALLTERNIT_MAILFLARE_URL, ALLTERNIT_MAILFLARE_ADMIN_KEY,"
    echo "  ALLTERNIT_BOT_EMAIL_DOMAIN, ALLTERNIT_MAILFLARE_WEBHOOK_SECRET"
    echo ""
    echo "Next steps:"
    echo "  1. The allternit platform reads the ALLTERNIT_MAILFLARE_* vars and points"
    echo "     agent mail at this deployment — no further wiring needed on this side."
    echo "  2. If you skipped webhook registration, register message.inbound later"
    echo "     (the exact curl was printed above)."
    echo "  3. Create per-agent mailboxes and scoped keys via the API:"
    echo "       POST /api/mailboxes   (admin key)"
    echo "       POST /api/api-keys    (session, scopes send/read per mailbox)"
    echo "  4. Outbound mail is approval-gated: review pending jobs in the dashboard"
    echo "     or via POST /api/v1/outbound/<id>/approve."
    echo "  5. Deliverability: keep volume low for the first weeks, keep DMARC at"
    echo "     p=quarantine until reports look clean, and never send agent mail from"
    echo "     the root domain."
    echo ""
    echo "Re-run this script any time — it is idempotent and reuses .env.install."
    echo ""
}

# =============================================================================
# MAIN
# =============================================================================

main() {
    parse_args "$@"
    print_header
    load_previous_install
    validate_non_interactive
    check_prereqs
    check_wrangler_auth
    collect_config
    verify_token_and_zone
    preflight_token_permissions
    provision_resources
    migrate_and_deploy
    setup_dns
    resolve_worker_url
    bootstrap_admin
    write_root_env
    smoke_test
    register_webhook
    print_next_steps
}

if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi
