#!/bin/bash
# =============================================================================
# Allternit Platform Development Setup Script
# =============================================================================
# This script runs after the devcontainer is created to set up the development
# environment, install dependencies, and configure the workspace.
# =============================================================================

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging functions
log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
log_warning() { echo -e "${YELLOW}[WARNING]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

# Script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WORKSPACE_DIR="$(dirname "$SCRIPT_DIR")"

log_info "Starting Allternit Platform development environment setup..."
log_info "Workspace: $WORKSPACE_DIR"

# =============================================================================
# Check prerequisites
# =============================================================================
log_info "Checking prerequisites..."

# Check Node.js
if ! command -v node &> /dev/null; then
    log_error "Node.js is not installed"
    exit 1
fi
NODE_VERSION=$(node --version)
log_success "Node.js version: $NODE_VERSION"

# Check pnpm
if ! command -v pnpm &> /dev/null; then
    log_error "pnpm is not installed"
    exit 1
fi
PNPM_VERSION=$(pnpm --version)
log_success "pnpm version: $PNPM_VERSION"

# Check Go
if ! command -v go &> /dev/null; then
    log_error "Go is not installed"
    exit 1
fi
GO_VERSION=$(go version)
log_success "Go version: $GO_VERSION"

# Check Rust
if ! command -v rustc &> /dev/null; then
    log_error "Rust is not installed"
    exit 1
fi
RUST_VERSION=$(rustc --version)
log_success "Rust version: $RUST_VERSION"

# Check Docker
if ! command -v docker &> /dev/null; then
    log_warning "Docker CLI not available (expected in devcontainer)"
else
    log_success "Docker CLI available"
fi

# =============================================================================
# Setup environment files
# =============================================================================
log_info "Setting up environment files..."

cd "$WORKSPACE_DIR"

# Create .env file if it doesn't exist
if [ ! -f ".env" ]; then
    if [ -f ".env.example" ]; then
        cp .env.example .env
        log_success "Created .env from .env.example"
    else
        log_warning ".env.example not found, skipping .env creation"
    fi
else
    log_info ".env file already exists"
fi

# Create .env.local for UI
if [ -d "6-ui/allternit-platform" ]; then
    if [ ! -f "6-ui/allternit-platform/.env.local" ]; then
        cat > 6-ui/allternit-platform/.env.local << 'EOF'
# Local development environment variables
NEXT_PUBLIC_API_URL=http://localhost:8080
NEXT_PUBLIC_WS_URL=ws://localhost:8080
NEXT_PUBLIC_APP_NAME=Allternit Platform
NEXT_PUBLIC_APP_VERSION=dev
EOF
        log_success "Created 6-ui/allternit-platform/.env.local"
    fi
fi

# =============================================================================
# Install Node.js dependencies
# =============================================================================
log_info "Installing Node.js dependencies..."

# UI workspace
if [ -d "6-ui/allternit-platform" ]; then
    log_info "Installing 6-ui/allternit-platform dependencies..."
    cd "$WORKSPACE_DIR/6-ui/allternit-platform"
    
    # Use pnpm for faster installs
    if [ -f "pnpm-lock.yaml" ]; then
        pnpm install --frozen-lockfile
    else
        pnpm install
    fi
    
    log_success "UI dependencies installed"
    cd "$WORKSPACE_DIR"
else
    log_warning "6-ui/allternit-platform directory not found"
fi

# =============================================================================
# Install Go dependencies
# =============================================================================
log_info "Installing Go dependencies..."

if [ -d "1-kernel" ]; then
    # Install dependencies for all Go modules
    find 1-kernel -name "go.mod" -type f | while read -r gomod; do
        dir=$(dirname "$gomod")
        log_info "Installing dependencies in $dir..."
        cd "$WORKSPACE_DIR/$dir"
        go mod download
        go mod tidy
    done
    cd "$WORKSPACE_DIR"
    log_success "Go dependencies installed"
else
    log_warning "1-kernel directory not found"
fi

# =============================================================================
# Install Rust dependencies
# =============================================================================
log_info "Installing Rust dependencies..."

if [ -d "1-kernel" ]; then
    # Find and build all Rust projects
    find 1-kernel -name "Cargo.toml" -type f | while read -r cargotoml; do
        dir=$(dirname "$cargotoml")
        # Skip if it's a workspace root
        if grep -q "\[workspace\]" "$cargotoml" 2>/dev/null; then
            log_info "Found workspace at $dir"
            cd "$WORKSPACE_DIR/$dir"
            cargo fetch
        fi
    done
    cd "$WORKSPACE_DIR"
    log_success "Rust dependencies fetched"
else
    log_warning "1-kernel directory not found"
fi

# =============================================================================
# Setup Git hooks
# =============================================================================
log_info "Setting up Git hooks..."

if [ -d ".git" ]; then
    # Create pre-commit hook
    cat > .git/hooks/pre-commit << 'EOF'
#!/bin/bash
# Pre-commit hook for Allternit Platform

echo "Running pre-commit checks..."

# Check for secrets using detect-secrets or similar
if command -v detect-secrets &> /dev/null; then
    detect-secrets scan --baseline .secrets.baseline
fi

# Run linting on staged files
if command -v pnpm &> /dev/null && [ -f "6-ui/allternit-platform/package.json" ]; then
    cd 6-ui/allternit-platform
    pnpm lint-staged || true
fi

echo "Pre-commit checks complete."
EOF
    chmod +x .git/hooks/pre-commit
    log_success "Git hooks configured"
else
    log_warning "Not a git repository, skipping git hooks"
fi

# =============================================================================
# Create helpful aliases
# =============================================================================
log_info "Creating shell aliases..."

if [ -f "$HOME/.bashrc" ]; then
    # Add Allternit specific aliases if not already present
    if ! grep -q "# Allternit Platform Aliases" "$HOME/.bashrc"; then
        cat >> "$HOME/.bashrc" << 'EOF'

# Allternit Platform Aliases
alias allternit='cd /workspace'
alias allternit-kernel='cd /workspace/1-kernel'
alias allternit-ui='cd /workspace/6-ui/allternit-platform'
alias allternit-apps='cd /workspace/7-apps'
alias allternit-agents='cd /workspace/8-agents'

# Development shortcuts
alias allternit-dev='./scripts/start-services.sh'
alias allternit-build='task build'
alias allternit-test='task test'
alias allternit-lint='task lint'

# Service access
alias psql-allternit='psql $DATABASE_URL'
alias redis-allternit='redis-cli -u $REDIS_URL'
alias minio-console='echo "MinIO Console: http://localhost:9001"'
alias mailpit-ui='echo "Mailpit UI: http://localhost:8025"'
EOF
        log_success "Shell aliases added to ~/.bashrc"
    fi
fi

# =============================================================================
# Setup database schemas (if migration files exist)
# =============================================================================
log_info "Checking for database migrations..."

# Wait for PostgreSQL to be ready
if command -v pg_isready &> /dev/null; then
    log_info "Waiting for PostgreSQL..."
    until pg_isready -h postgres -p 5432 -U postgres > /dev/null 2>&1; do
        sleep 1
    done
    log_success "PostgreSQL is ready"
    
    # Run migrations if goose is available
    if command -v goose &> /dev/null; then
        if [ -d "1-kernel/allternit-infrastructure/migrations" ]; then
            log_info "Running database migrations..."
            cd "$WORKSPACE_DIR/1-kernel/allternit-infrastructure/migrations"
            goose up || log_warning "Migration failed or already applied"
            cd "$WORKSPACE_DIR"
        fi
    fi
    
    # Run SQLx migrations if available
    if command -v sqlx &> /dev/null; then
        if [ -f "1-kernel/allternit-kernel/sqlx-data.json" ] || [ -d "1-kernel/allternit-kernel/migrations" ]; then
            log_info "Running SQLx migrations..."
            cd "$WORKSPACE_DIR/1-kernel/allternit-kernel"
            sqlx migrate run || log_warning "SQLx migration failed or already applied"
            cd "$WORKSPACE_DIR"
        fi
    fi
fi

# =============================================================================
# Create initial data directories
# =============================================================================
log_info "Creating data directories..."

mkdir -p /workspace/.data/{uploads,exports,logs,temp}
chmod -R 755 /workspace/.data
log_success "Data directories created"

# =============================================================================
# Print completion message
# =============================================================================
echo ""
echo -e "${GREEN}╔════════════════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║         Allternit Platform Development Environment Ready!               ║${NC}"
echo -e "${GREEN}╚════════════════════════════════════════════════════════════════════╝${NC}"
echo ""
log_info "Quick Start Commands:"
echo "  ./scripts/start-services.sh  - Start all development services"
echo "  task --list-all              - List available tasks"
echo "  pnpm dev                     - Start UI development server"
echo ""
log_info "Useful URLs:"
echo "  Platform UI:       http://localhost:3000"
echo "  API Gateway:       http://localhost:8080"
echo "  MinIO Console:     http://localhost:9001 (minioadmin / minio-admin-password)"
echo "  Mailpit UI:        http://localhost:8025"
echo "  Temporal UI:       http://localhost:8088"
echo ""
log_info "Workspace directories:"
echo "  /workspace/1-kernel    - Go/Rust backend services"
echo "  /workspace/6-ui        - TypeScript/React frontend"
echo "  /workspace/7-apps      - Application shells"
echo "  /workspace/8-agents    - Agent definitions"
echo ""
log_success "Setup complete! Run './scripts/start-services.sh' to begin."
