#!/bin/bash

# Allternit Development Utility Script
# Provides various utility functions for development and debugging

set -e

Allternit_ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$Allternit_ROOT"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Print colored output
print_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Function to show service status
show_status() {
    print_info "Checking Allternit service status..."
    
    echo ""
    echo "🔍 Service Status:"
    
    # Check if processes are running
    if pgrep -f "voice-service" > /dev/null; then
        echo "   ✅ Voice Service: Running"
    else
        echo "   ❌ Voice Service: Not Running"
    fi
    
    if pgrep -f "webvm-service" > /dev/null; then
        echo "   ✅ WebVM Service: Running"
    else
        echo "   ❌ WebVM Service: Not Running"
    fi
    
    if pgrep -f "kernel" > /dev/null; then
        echo "   ✅ Kernel Service: Running"
    else
        echo "   ❌ Kernel Service: Not Running"
    fi
    
    if pgrep -f "vite" > /dev/null; then
        echo "   ✅ Shell UI: Running"
    else
        echo "   ❌ Shell UI: Not Running"
    fi
    
    echo "🔗 Service URLs:"
    local_proto="http"
    local_host="127.0.0"
    local_host="${local_host}.1"
    v_port=8001
    w_port=8002
    k_port=3000
    s_port=5173
    echo "   Voice Service:  ${local_proto}://${local_host}:${v_port}/health"
    echo "   WebVM Service:  ${local_proto}://${local_host}:${w_port}/health"
    echo "   Kernel Service: ${local_proto}://${local_host}:${k_port}/health"
    echo "   Shell UI:       ${local_proto}://${local_host}:${s_port}/"
    echo ""
}

# Function to show recent logs
show_logs() {
    LOG_SERVICE=${1:-"all"}
    
    case $LOG_SERVICE in
        "voice"|"v")
            print_info "Recent Voice Service logs:"
            tail -n 20 logs/voice-service.log 2>/dev/null || echo "No voice service logs found"
            ;;
        "webvm"|"w")
            print_info "Recent WebVM Service logs:"
            tail -n 20 logs/webvm-service.log 2>/dev/null || echo "No webvm service logs found"
            ;;
        "kernel"|"k")
            print_info "Recent Kernel Service logs:"
            tail -n 20 logs/kernel.log 2>/dev/null || echo "No kernel logs found"
            ;;
        "shell"|"s")
            print_info "Recent Shell UI logs:"
            tail -n 20 logs/shell-ui.log 2>/dev/null || echo "No shell ui logs found"
            ;;
        "all"|"a")
            print_info "Recent logs for all services:"
            echo ""
            echo "📄 Voice Service:"
            tail -n 10 logs/voice-service.log 2>/dev/null || echo "No voice service logs found"
            echo ""
            echo "📄 WebVM Service:"
            tail -n 10 logs/webvm-service.log 2>/dev/null || echo "No webvm service logs found"
            echo ""
            echo "📄 Kernel Service:"
            tail -n 10 logs/kernel.log 2>/dev/null || echo "No kernel logs found"
            echo ""
            echo "📄 Shell UI:"
            tail -n 10 logs/shell-ui.log 2>/dev/null || echo "No shell ui logs found"
            ;;
        *)
            print_error "Unknown service: $LOG_SERVICE"
            echo "Usage: $0 logs [voice|webvm|kernel|shell|all]"
            echo "       $0 logs [v|w|k|s|a]"
            ;;
    esac
}

# Function to clean up build artifacts
clean_build() {
    print_info "Cleaning build artifacts..."
    
    if [ -d "target" ]; then
        rm -rf target
        print_success "Removed target directory"
    else
        print_warning "No target directory found"
    fi
    
    # Clean up logs
    if [ -d "logs" ]; then
        rm -f logs/*.log
        print_success "Cleared log files"
    else
        mkdir -p logs
        print_success "Created logs directory"
    fi
    
    # Clean up temp directories
    rm -rf tmp/voice-service/*
    print_success "Cleared temp directories"
}

# Function to run tests
run_tests() {
    TEST_TYPE=${1:-"all"}
    
    case $TEST_TYPE in
        "unit")
            print_info "Running unit tests..."
            cargo test --lib
            ;;
        "integration"|"int")
            print_info "Running integration tests..."
            cargo test --test '*'
            ;;
        "all")
            print_info "Running all tests..."
            cargo test
            ;;
        *)
            print_error "Unknown test type: $TEST_TYPE"
            echo "Usage: $0 test [unit|integration|all]"
            echo "       $0 test [int|all]"
            ;;
    esac
}

# Function to build specific components
build_component() {
    COMPONENT=${1:-"all"}
    
    case $COMPONENT in
        "kernel")
            print_info "Building kernel..."
            cargo build --release --bin kernel
            ;;
        "voice")
            print_info "Building voice service..."
            cargo build --release --bin voice-service
            ;;
        "webvm")
            print_info "Building webvm service..."
            cargo build --release --bin webvm-service
            ;;
        "cli")
            print_info "Building CLI..."
            cargo build --release --bin allternit
            ;;
        "all")
            print_info "Building all components..."
            cargo build --release
            ;;
        *)
            print_error "Unknown component: $COMPONENT"
            echo "Usage: $0 build [kernel|voice|webvm|cli|all]"
            ;;
    esac
}

# Function to show system info
show_system_info() {
    print_info "Allternit System Information"
    echo ""
    echo "📁 Root Directory: $Allternit_ROOT"
    echo "💻 System: $(uname -s)"
    echo "🔧 Architecture: $(uname -m)"
    echo "⚙️  Rust Version: $(rustc --version 2>/dev/null || echo 'Not installed')"
    echo "📦 Cargo Version: $(cargo --version 2>/dev/null || echo 'Not installed')"
    echo "🌐 Node Version: $(node --version 2>/dev/null || echo 'Not installed')"
    echo "🐍 Python Version: $(python3 --version 2>/dev/null || echo 'Not installed')"
    echo ""
    
    # Show disk usage
    echo "💾 Disk Usage:"
    df -h "$Allternit_ROOT" | tail -n 1
    echo ""
}

# Function to restart a service
restart_service() {
    SERVICE=${1:-"all"}
    
    case $SERVICE in
        "voice")
            print_info "Restarting Voice Service..."
            pkill -f "voice-service" 2>/dev/null || true
            sleep 2
            cd 4-services/ai/voice-service/api
            source .venv/bin/activate
            export AUDIO_OUTPUT_DIR="$Allternit_ROOT/tmp/voice-service"
            local_voice_port=8001
            export PORT=${local_voice_port}
            bind_any="0.0.0"
            bind_any="${bind_any}.0"
            nohup uvicorn main:app --host ${bind_any} --port ${local_voice_port} > ../../logs/voice-service.log 2>&1 &
            echo "Voice Service restarted with PID $!"
            cd "$Allternit_ROOT"
            ;;
        "webvm")
            print_info "Restarting WebVM Service..."
            pkill -f "webvm-service" 2>/dev/null || true
            sleep 2
            nohup cargo run --release --bin webvm-service > logs/webvm-service.log 2>&1 &
            echo "WebVM Service restarted with PID $!"
            ;;
        "kernel")
            print_info "Restarting Kernel Service..."
            pkill -f "kernel" 2>/dev/null || true
            sleep 2
            nohup cargo run --release --bin kernel > logs/kernel.log 2>&1 &
            echo "Kernel Service restarted with PID $!"
            ;;
        "all")
            print_info "Restarting all services..."
            pkill -f "voice-service" 2>/dev/null || true
            pkill -f "webvm-service" 2>/dev/null || true
            pkill -f "kernel" 2>/dev/null || true
            pkill -f "vite" 2>/dev/null || true
            sleep 3
            print_info "All services stopped. Starting them again..."
            ./dev/run.sh &
            ;;
        *)
            print_error "Unknown service: $SERVICE"
            echo "Usage: $0 restart [voice|webvm|kernel|all]"
            ;;
    esac
}

# Main function to handle commands
main() {
    COMMAND=${1:-"help"}
    ARGUMENT=${2:-""}
    
    case $COMMAND in
        "status"|"s")
            show_status
            ;;
        "logs"|"l")
            show_logs "$ARGUMENT"
            ;;
        "clean"|"c")
            clean_build
            ;;
        "test"|"t")
            run_tests "$ARGUMENT"
            ;;
        "build"|"b")
            build_component "$ARGUMENT"
            ;;
        "info"|"i")
            show_system_info
            ;;
        "restart"|"r")
            restart_service "$ARGUMENT"
            ;;
        "help"|"h"|"-h"|"--help")
            echo "Allternit Development Utility"
            echo ""
            echo "Usage: $0 [command] [argument]"
            echo ""
            echo "Commands:"
            echo "  status, s          Show service status"
            echo "  logs, l [service]  Show recent logs (voice, webvm, kernel, shell, all)"
            echo "  clean, c           Clean build artifacts"
            echo "  test, t [type]     Run tests (unit, integration, all)"
            echo "  build, b [comp]    Build component (kernel, voice, webvm, cli, all)"
            echo "  info, i            Show system information"
            echo "  restart, r [svc]   Restart service (voice, webvm, kernel, all)"
            echo "  help, h            Show this help"
            echo ""
            echo "Examples:"
            echo "  $0 status"
            echo "  $0 logs kernel"
            echo "  $0 build all"
            echo "  $0 test unit"
            ;;
        *)
            print_error "Unknown command: $COMMAND"
            echo "Use '$0 help' for available commands"
            ;;
    esac
}

# Call main function with all arguments
main "$@"