#!/bin/bash
# =============================================================================
# Allternit Platform Services Startup Script
# =============================================================================
# This script starts all required services for Allternit platform development.
# Run this after setup-dev.sh or when restarting the environment.
# =============================================================================

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Logging functions
log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
log_warning() { echo -e "${YELLOW}[WARNING]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }
log_step() { echo -e "${CYAN}[STEP]${NC} $1"; }

# Script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WORKSPACE_DIR="$(dirname "$SCRIPT_DIR")"

# PID file for tracking background processes
PID_FILE="/tmp/allternit-services.pid"

# =============================================================================
# Cleanup function
# =============================================================================
cleanup() {
    log_info "Shutting down services..."
    if [ -f "$PID_FILE" ]; then
        while read -r pid; do
            if kill -0 "$pid" 2>/dev/null; then
                kill "$pid" 2>/dev/null || true
            fi
        done < "$PID_FILE"
        rm -f "$PID_FILE"
    fi
}

trap cleanup EXIT INT TERM

# =============================================================================
# Check if running in devcontainer
# =============================================================================
log_step "Checking environment..."

if [ -f /.dockerenv ] || grep -q docker /proc/1/cgroup 2>/dev/null; then
    log_success "Running inside devcontainer"
else
    log_warning "Not running in devcontainer. Some services may need manual startup."
fi

# =============================================================================
# Wait for infrastructure services
# =============================================================================
log_step "Checking infrastructure services..."

# Check PostgreSQL
wait_for_postgres() {
    log_info "Waiting for PostgreSQL..."
    local retries=30
    while [ $retries -gt 0 ]; do
        if pg_isready -h postgres -p 5432 -U postgres > /dev/null 2>&1; then
            log_success "PostgreSQL is ready"
            return 0
        fi
        sleep 2
        retries=$((retries - 1))
    done
    log_error "PostgreSQL failed to start"
    return 1
}

# Check Redis
wait_for_redis() {
    log_info "Waiting for Redis..."
    local retries=30
    while [ $retries -gt 0 ]; do
        if redis-cli -h redis -a "${REDIS_PASSWORD:-allternit-redis-password}" ping > /dev/null 2>&1; then
            log_success "Redis is ready"
            return 0
        fi
        sleep 2
        retries=$((retries - 1))
    done
    log_error "Redis failed to start"
    return 1
}

# Check MinIO
wait_for_minio() {
    log_info "Waiting for MinIO..."
    local retries=30
    while [ $retries -gt 0 ]; do
        if curl -sf http://minio:9000/minio/health/live > /dev/null 2>&1; then
            log_success "MinIO is ready"
            return 0
        fi
        sleep 2
        retries=$((retries - 1))
    done
    log_error "MinIO failed to start"
    return 1
}

# Check Temporal
wait_for_temporal() {
    log_info "Waiting for Temporal..."
    local retries=60
    while [ $retries -gt 0 ]; do
        if temporal workflow list --address temporal:7233 > /dev/null 2>&1; then
            log_success "Temporal is ready"
            return 0
        fi
        sleep 2
        retries=$((retries - 1))
    done
    log_error "Temporal failed to start"
    return 1
}

# Check NATS
wait_for_nats() {
    log_info "Waiting for NATS..."
    local retries=30
    while [ $retries -gt 0 ]; do
        if wget -q --spider http://nats:8222/healthz > /dev/null 2>&1; then
            log_success "NATS is ready"
            return 0
        fi
        sleep 2
        retries=$((retries - 1))
    done
    log_error "NATS failed to start"
    return 1
}

# Run all waits
wait_for_postgres || exit 1
wait_for_redis || exit 1
wait_for_minio || exit 1
wait_for_temporal || exit 1
wait_for_nats || exit 1

log_success "All infrastructure services are ready!"

# =============================================================================
# Run database migrations
# =============================================================================
log_step "Running database migrations..."

if command -v goose &> /dev/null && [ -d "$WORKSPACE_DIR/1-kernel/allternit-infrastructure/migrations" ]; then
    log_info "Running Goose migrations..."
    cd "$WORKSPACE_DIR/1-kernel/allternit-infrastructure/migrations"
    goose up || log_warning "Goose migrations may have already been applied"
    cd "$WORKSPACE_DIR"
fi

if command -v sqlx &> /dev/null && [ -d "$WORKSPACE_DIR/1-kernel/allternit-kernel/migrations" ]; then
    log_info "Running SQLx migrations..."
    cd "$WORKSPACE_DIR/1-kernel/allternit-kernel"
    sqlx migrate run || log_warning "SQLx migrations may have already been applied"
    cd "$WORKSPACE_DIR"
fi

# Run Prisma migrations if present
if [ -d "$WORKSPACE_DIR/6-ui/allternit-platform/prisma" ]; then
    log_info "Running Prisma migrations..."
    cd "$WORKSPACE_DIR/6-ui/allternit-platform"
    pnpm prisma migrate dev --name init --skip-generate --skip-seed 2>/dev/null || \
        pnpm prisma migrate deploy 2>/dev/null || \
        log_warning "Prisma migrations skipped (may already be applied)"
    pnpm prisma generate || log_warning "Prisma client generation failed"
    cd "$WORKSPACE_DIR"
fi

log_success "Database migrations complete"

# =============================================================================
# Seed initial data
# =============================================================================
log_step "Seeding initial data..."

# Seed database if seed script exists
if [ -f "$WORKSPACE_DIR/scripts/seed-db.sh" ]; then
    log_info "Running database seed..."
    bash "$WORKSPACE_DIR/scripts/seed-db.sh" || log_warning "Database seed failed"
fi

# Create MinIO buckets
log_info "Ensuring MinIO buckets exist..."
if command -v mc &> /dev/null; then
    mc alias set local http://minio:9000 minioadmin "${MINIO_ROOT_PASSWORD:-minio-admin-password}" > /dev/null 2>&1 || true
    mc mb local/allternit-assets 2>/dev/null || true
    mc mb local/allternit-uploads 2>/dev/null || true
    mc mb local/allternit-exports 2>/dev/null || true
    mc policy set public local/allternit-assets 2>/dev/null || true
    mc policy set download local/allternit-uploads 2>/dev/null || true
    log_success "MinIO buckets configured"
fi

# =============================================================================
# Start Allternit services
# =============================================================================
log_step "Starting Allternit services..."

# Clear PID file
> "$PID_FILE"

# Start Kernel services (Go)
start_kernel_services() {
    if [ -d "$WORKSPACE_DIR/1-kernel/allternit-kernel" ]; then
        log_info "Starting Allternit Kernel services..."
        cd "$WORKSPACE_DIR/1-kernel/allternit-kernel"
        
        # Check if air is available for hot reload
        if command -v air &> /dev/null && [ -f ".air.toml" ]; then
            log_info "Starting kernel with air (hot reload)..."
            air &
            echo $! >> "$PID_FILE"
        elif [ -f "main.go" ]; then
            log_info "Starting kernel with go run..."
            go run main.go &
            echo $! >> "$PID_FILE"
        fi
        
        cd "$WORKSPACE_DIR"
    fi
}

# Start API Gateway (Go)
start_api_gateway() {
    if [ -d "$WORKSPACE_DIR/1-kernel/allternit-cloud" ]; then
        log_info "Starting Allternit API Gateway..."
        cd "$WORKSPACE_DIR/1-kernel/allternit-cloud"
        
        if command -v air &> /dev/null && [ -f ".air.toml" ]; then
            air &
            echo $! >> "$PID_FILE"
        elif [ -f "main.go" ]; then
            go run main.go &
            echo $! >> "$PID_FILE"
        fi
        
        cd "$WORKSPACE_DIR"
    fi
}

# Start Infrastructure services (Rust)
start_infrastructure_services() {
    if [ -d "$WORKSPACE_DIR/1-kernel/allternit-infrastructure" ]; then
        log_info "Starting Allternit Infrastructure services..."
        cd "$WORKSPACE_DIR/1-kernel/allternit-infrastructure"
        
        if command -v cargo-watch &> /dev/null; then
            cargo watch -x run &
            echo $! >> "$PID_FILE"
        elif [ -f "Cargo.toml" ]; then
            cargo run &
            echo $! >> "$PID_FILE"
        fi
        
        cd "$WORKSPACE_DIR"
    fi
}

# Start UI development server
start_ui() {
    if [ -d "$WORKSPACE_DIR/6-ui/allternit-platform" ]; then
        log_info "Starting Allternit Platform UI (Next.js)..."
        cd "$WORKSPACE_DIR/6-ui/allternit-platform"
        
        # Check for package.json
        if [ -f "package.json" ]; then
            pnpm dev &
            echo $! >> "$PID_FILE"
        fi
        
        cd "$WORKSPACE_DIR"
    fi
}

# Start services in background
start_kernel_services || log_warning "Kernel services failed to start"
sleep 2
start_api_gateway || log_warning "API Gateway failed to start"
sleep 2
start_infrastructure_services || log_warning "Infrastructure services failed to start"
sleep 2
start_ui || log_warning "UI failed to start"

# =============================================================================
# Print status
# =============================================================================
log_step "Service Status"

echo ""
echo -e "${GREEN}╔════════════════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║              Allternit Platform Services Started!                       ║${NC}"
echo -e "${GREEN}╚════════════════════════════════════════════════════════════════════╝${NC}"
echo ""

# Service status table
echo -e "${CYAN}Service Endpoints:${NC}"
echo "  ┌─────────────────────┬───────────────────────────────────────────┐"
echo "  │ Service             │ URL                                       │"
echo "  ├─────────────────────┼───────────────────────────────────────────┤"
echo "  │ Platform UI         │ http://localhost:3000                     │"
echo "  │ API Gateway         │ http://localhost:8080                     │"
echo "  │ Kernel Services     │ http://localhost:8081                     │"
echo "  │ MinIO Console       │ http://localhost:9001                     │"
echo "  │ Mailpit UI          │ http://localhost:8025                     │"
echo "  │ Temporal UI         │ http://localhost:8088                     │"
echo "  │ ChromaDB            │ http://localhost:8000                     │"
echo "  │ LocalStack          │ http://localhost:4566                     │"
echo "  └─────────────────────┴───────────────────────────────────────────┘"
echo ""

# Database connections
echo -e "${CYAN}Database Connections:${NC}"
echo "  PostgreSQL:  postgres://postgres:***@localhost:5432/allternit_platform"
echo "  Redis:       redis://:***@localhost:6379/0"
echo ""

# Log locations
echo -e "${CYAN}Log Locations:${NC}"
echo "  Service logs: /workspace/.data/logs/"
echo "  Docker logs:  docker compose logs -f [service]"
echo ""

# Quick commands
echo -e "${CYAN}Quick Commands:${NC}"
echo "  docker compose logs -f          - View all service logs"
echo "  docker compose restart [name]   - Restart a service"
echo "  pkill -f 'air|cargo-watch|next' - Stop all dev servers"
echo ""

log_success "All services are starting up. Press Ctrl+C to stop."

# Keep script running to maintain trap
echo ""
log_info "Services are running. Press Ctrl+C to stop all services."
echo ""

# Wait for interrupt
wait
