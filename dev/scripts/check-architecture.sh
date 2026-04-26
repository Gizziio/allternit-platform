#!/bin/bash
#
# Architecture Compliance Checker
# 
# This script verifies that all code follows the enterprise architecture:
# UI → Gateway → API → Services
#

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

VIOLATIONS=0
WARNINGS=0

print_header() {
    echo ""
    echo -e "${CYAN}╔════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${CYAN}║${NC}     ${GREEN}Allternit Architecture Compliance Check${NC}             ${CYAN}║${NC}"
    echo -e "${CYAN}╚════════════════════════════════════════════════════════════╝${NC}"
    echo ""
}

print_check() {
    echo -e "${BLUE}[CHECK]${NC} $1"
}

print_pass() {
    echo -e "${GREEN}[PASS]${NC} $1"
}

print_fail() {
    echo -e "${RED}[FAIL]${NC} $1"
    ((VIOLATIONS++)) || true
}

print_warning() {
    echo -e "${YELLOW}[WARN]${NC} $1"
    ((WARNINGS++)) || true
}

# Check 1: No direct kernel calls in UI
check_no_direct_kernel() {
    print_check "Checking for direct kernel calls in UI..."
    
    local violations=$(grep -r "127\.0\.0\.1:3004\|localhost:3004" \
        "$PROJECT_ROOT/5-ui/" \
        "$PROJECT_ROOT/6-apps/shell-ui/" \
        2>/dev/null | grep -v "node_modules" | grep -v ".deprecated" || true)
    
    if [ -n "$violations" ]; then
        print_fail "Found direct kernel references:"
        echo "$violations" | head -20
        return 1
    else
        print_pass "No direct kernel calls found"
        return 0
    fi
}

# Check 2: Gateway URL is configured
check_gateway_url() {
    print_check "Checking for Gateway URL configuration..."
    
    if grep -r "VITE_Allternit_GATEWAY_URL" "$PROJECT_ROOT/6-apps/shell-ui/" 2>/dev/null | grep -v "node_modules" > /dev/null; then
        print_pass "Gateway URL environment variable found"
        return 0
    else
        print_fail "VITE_Allternit_GATEWAY_URL not found in shell-ui"
        return 1
    fi
}

# Check 3: No old kernel URL env var
check_no_old_kernel_env() {
    print_check "Checking for deprecated kernel URL environment variable..."
    
    if grep -r "VITE_Allternit_KERNEL_URL" "$PROJECT_ROOT/6-apps/shell-ui/" 2>/dev/null | grep -v "node_modules" > /dev/null; then
        print_fail "Found deprecated VITE_Allternit_KERNEL_URL"
        return 1
    else
        print_pass "No deprecated kernel URL env var found"
        return 0
    fi
}

# Check 4: API client exists
check_api_client_exists() {
    print_check "Checking for API client..."
    
    if [ -f "$PROJECT_ROOT/5-ui/allternit-platform/src/integration/api-client.ts" ]; then
        print_pass "API client exists"
        return 0
    else
        print_fail "API client not found at 5-ui/allternit-platform/src/integration/api-client.ts"
        return 1
    fi
}

# Check 5: Unified gateway exists
check_gateway_exists() {
    print_check "Checking for unified gateway..."
    
    if [ -f "$PROJECT_ROOT/4-services/gateway/src/main.py" ]; then
        print_pass "Unified gateway exists"
        return 0
    else
        print_fail "Unified gateway not found"
        return 1
    fi
}

# Check 6: Deprecated services moved
check_deprecated_moved() {
    print_check "Checking that deprecated services are moved..."
    
    local all_moved=true
    
    # Check gateway services
    if [ -d "$PROJECT_ROOT/4-services/gateway/.deprecated" ]; then
        print_pass "Deprecated gateway services moved"
    else
        print_warning "Deprecated gateway services folder not found"
    fi
    
    # Check registry services
    if [ -d "$PROJECT_ROOT/4-services/registry/.deprecated" ]; then
        print_pass "Deprecated registry services moved"
    else
        print_warning "Deprecated registry services folder not found"
    fi
}

# Check 7: Services.json is canonical
check_services_json() {
    print_check "Checking services.json is canonical..."
    
    if [ -f "$PROJECT_ROOT/.allternit/services.json" ]; then
        # Check if it has the new canonical version
        if grep -q "2026-02-06-enterprise" "$PROJECT_ROOT/.allternit/services.json"; then
            print_pass "services.json is canonical enterprise version"
            return 0
        else
            print_warning "services.json may not be canonical (old version detected)"
            return 1
        fi
    else
        print_fail "services.json not found"
        return 1
    fi
}

# Check 8: UI exports API client
check_ui_exports_api() {
    print_check "Checking UI exports API client..."
    
    if grep -q "api-client" "$PROJECT_ROOT/5-ui/allternit-platform/src/index.ts"; then
        print_pass "UI exports API client"
        return 0
    else
        print_fail "UI does not export API client"
        return 1
    fi
}

# Check 9: Services are running (optional)
check_services_running() {
    print_check "Checking if services are running..."
    
    local gateway_running=false
    local api_running=false
    local kernel_running=false
    
    if lsof -ti:8013 > /dev/null 2>&1; then
        gateway_running=true
        print_pass "Gateway is running (port 8013)"
    else
        print_warning "Gateway not running (port 8013)"
    fi
    
    if lsof -ti:3000 > /dev/null 2>&1; then
        api_running=true
        print_pass "API is running (port 3000)"
    else
        print_warning "API not running (port 3000)"
    fi
    
    if lsof -ti:3004 > /dev/null 2>&1; then
        kernel_running=true
        print_pass "Kernel is running (port 3004)"
    else
        print_warning "Kernel not running (port 3004)"
    fi
    
    if [ "$gateway_running" = true ] && [ "$api_running" = true ]; then
        # Test end-to-end
        print_check "Testing end-to-end connectivity..."
        if curl -s http://127.0.0.1:8013/health > /dev/null 2>&1; then
            print_pass "Gateway health check passed"
        else
            print_warning "Gateway health check failed"
        fi
    fi
}

# Check 10: No deprecated imports
check_no_deprecated_imports() {
    print_check "Checking for deprecated imports..."
    
    local violations=""
    
    # Check for exec.facade imports
    if grep -r "exec.facade" "$PROJECT_ROOT/5-ui/" "$PROJECT_ROOT/6-apps/" 2>/dev/null | grep -v "node_modules" | grep -v ".deprecated"; then
        violations="$violations\nFound exec.facade imports"
    fi
    
    # Check for direct kernel/index imports
    if grep -r "integration/kernel" "$PROJECT_ROOT/5-ui/" "$PROJECT_ROOT/6-apps/" 2>/dev/null | grep -v "node_modules" | grep -v ".deprecated"; then
        violations="$violations\nFound integration/kernel imports"
    fi
    
    if [ -n "$violations" ]; then
        print_warning "Found deprecated imports:$violations"
        return 1
    else
        print_pass "No deprecated imports found"
        return 0
    fi
}

# Main execution
main() {
    print_header
    
    echo "Running architecture compliance checks..."
    echo ""
    
    # Run all checks
    check_no_direct_kernel
    check_gateway_url
    check_no_old_kernel_env
    check_api_client_exists
    check_gateway_exists
    check_deprecated_moved
    check_services_json
    check_ui_exports_api
    check_no_deprecated_imports
    check_services_running
    
    # Summary
    echo ""
    echo -e "${CYAN}════════════════════════════════════════════════════════════${NC}"
    echo -e "${GREEN}SUMMARY:${NC}"
    echo ""
    
    if [ $VIOLATIONS -eq 0 ] && [ $WARNINGS -eq 0 ]; then
        echo -e "${GREEN}✓ All checks passed! Architecture is compliant.${NC}"
        exit 0
    elif [ $VIOLATIONS -eq 0 ]; then
        echo -e "${YELLOW}⚠ All critical checks passed, but there are warnings.${NC}"
        echo -e "${YELLOW}  Warnings: $WARNINGS${NC}"
        exit 0
    else
        echo -e "${RED}✗ Architecture violations found!${NC}"
        echo -e "${RED}  Violations: $VIOLATIONS${NC}"
        echo -e "${YELLOW}  Warnings: $WARNINGS${NC}"
        echo ""
        echo -e "${RED}Please fix violations before submitting code.${NC}"
        echo -e "${BLUE}See AGENTS.md for architecture requirements.${NC}"
        exit 1
    fi
}

main "$@"
