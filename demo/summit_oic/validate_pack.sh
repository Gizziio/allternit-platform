#!/bin/bash
# validate_pack.sh - Summit OIC Tenant Pack Validator
# Must pass before running demos

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
TENANT_DIR="$REPO_ROOT/tenants/summit_oic"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "============================================================"
echo "Summit OIC Tenant Pack Validator"
echo "============================================================"
echo ""

ERRORS=0
WARNINGS=0

# Helper functions
check_file() {
    if [ -f "$1" ]; then
        echo -e "${GREEN}✓${NC} Found: $1"
    else
        echo -e "${RED}✗${NC} Missing: $1"
        ((ERRORS++))
    fi
}

check_dir() {
    if [ -d "$1" ]; then
        echo -e "${GREEN}✓${NC} Found: $1"
    else
        echo -e "${RED}✗${NC} Missing: $1"
        ((ERRORS++))
    fi
}

check_json_valid() {
    if python3 -m json.tool "$1" > /dev/null 2>&1; then
        echo -e "${GREEN}✓${NC} Valid JSON: $1"
    else
        echo -e "${RED}✗${NC} Invalid JSON: $1"
        ((ERRORS++))
    fi
}

echo "1. Checking required directories..."
echo "------------------------------------------------------------"
check_dir "$TENANT_DIR"
check_dir "$TENANT_DIR/skills"
check_dir "$TENANT_DIR/tools"
check_dir "$TENANT_DIR/forms"
check_dir "$TENANT_DIR/memory"
check_dir "$TENANT_DIR/policies"
check_dir "$TENANT_DIR/tests"
echo ""

echo "2. Checking skill files..."
echo "------------------------------------------------------------"
check_file "$TENANT_DIR/skills/canvas/module_builder.skill.md"
check_file "$TENANT_DIR/skills/office/excel_editor.skill.md"
check_file "$TENANT_DIR/skills/desktop/cowork_portal_runner.skill.md"
echo ""

echo "3. Checking tool schemas..."
echo "------------------------------------------------------------"
for schema in "$TENANT_DIR/tools"/*/schemas/*.json; do
    if [ -f "$schema" ]; then
        check_json_valid "$schema"
    fi
done
echo ""

echo "4. Checking form definitions..."
echo "------------------------------------------------------------"
check_file "$TENANT_DIR/forms/module_builder.form.json"
check_json_valid "$TENANT_DIR/forms/module_builder.form.json"
echo ""

echo "5. Checking tenant configuration..."
echo "------------------------------------------------------------"
check_file "$TENANT_DIR/tenant.json"
check_json_valid "$TENANT_DIR/tenant.json"
check_file "$TENANT_DIR/pack.lock.json"
echo ""

echo "6. Checking tool registry resolution..."
echo "------------------------------------------------------------"
TOOLS_REGISTRY="$REPO_ROOT/tools/tool_registry.json"
check_file "$TOOLS_REGISTRY"

if [ -f "$TOOLS_REGISTRY" ]; then
    # Check that all Summit tools are registered
    SUMMIT_TOOLS=$(find "$TENANT_DIR/tools" -name "*.schema.json" | wc -l)
    REGISTERED_TOOLS=$(python3 -c "import json; print(len(json.load(open('$TOOLS_REGISTRY'))['tools']))" 2>/dev/null || echo "0")
    echo "   Summit tool schemas: $SUMMIT_TOOLS"
    echo "   Registered tools: $REGISTERED_TOOLS"
    
    if [ "$REGISTERED_TOOLS" -ge "$SUMMIT_TOOLS" ]; then
        echo -e "${GREEN}✓${NC} Tool registry has sufficient tools"
    else
        echo -e "${YELLOW}!${NC} Tool registry may be incomplete"
        ((WARNINGS++))
    fi
fi
echo ""

echo "7. Checking secrets (should NOT be present in pack)..."
echo "------------------------------------------------------------"
if [ -f "$TENANT_DIR/secrets/summit_oic.env" ]; then
    echo -e "${YELLOW}!${NC} WARNING: summit_oic.env found (should be provisioned on-site)"
    ((WARNINGS++))
else
    echo -e "${GREEN}✓${NC} No secrets in pack (correct for distribution)"
fi
echo ""

echo "8. Checking demo artifacts..."
echo "------------------------------------------------------------"
check_file "$SCRIPT_DIR/summit_oic.sample.env"
check_file "$SCRIPT_DIR/teacher_profile.sample.json"
check_file "$SCRIPT_DIR/run_demo.sh"
check_file "$SCRIPT_DIR/validate_pack.sh"
echo ""

echo "============================================================"
echo "Validation Summary"
echo "============================================================"
echo -e "Errors:   ${RED}$ERRORS${NC}"
echo -e "Warnings: ${YELLOW}$WARNINGS${NC}"
echo ""

if [ $ERRORS -gt 0 ]; then
    echo -e "${RED}VALIDATION FAILED${NC}"
    echo "Fix the errors above before running demos."
    exit 1
else
    if [ $WARNINGS -gt 0 ]; then
        echo -e "${YELLOW}VALIDATION PASSED WITH WARNINGS${NC}"
    else
        echo -e "${GREEN}VALIDATION PASSED${NC}"
    fi
    echo ""
    echo "Next step: Run 'bash demo/summit_oic/run_demo.sh'"
    exit 0
fi
