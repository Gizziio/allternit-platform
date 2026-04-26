#!/bin/bash
# Allternit Mode & Provider Logo Testing Script
# Run this to verify all implementations

set -e

echo "======================================"
echo "Allternit Implementation Testing"
echo "======================================"
echo ""

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test counter
TESTS_PASSED=0
TESTS_FAILED=0

# Function to check if a file exists
check_file() {
    if [ -f "$1" ]; then
        echo -e "${GREEN}✓${NC} File exists: $1"
        ((TESTS_PASSED++))
        return 0
    else
        echo -e "${RED}✗${NC} File missing: $1"
        ((TESTS_FAILED++))
        return 1
    fi
}

# Function to check if a string exists in a file
check_string_in_file() {
    if grep -q "$2" "$1"; then
        echo -e "${GREEN}✓${NC} Found in $1: $2"
        ((TESTS_PASSED++))
        return 0
    else
        echo -e "${RED}✗${NC} Not found in $1: $2"
        ((TESTS_FAILED++))
        return 1
    fi
}

echo "1. Checking Mode Prompt Files..."
echo "--------------------------------"
check_file "cmd/gizzi-code/src/runtime/session/prompt/plan-mode.txt"
check_file "cmd/gizzi-code/src/runtime/session/prompt/build-mode.txt"
echo ""

echo "2. Checking Provider Logos..."
echo "------------------------------"
LOGO_DIR="6-ui/allternit-platform/public/assets/runtime-logos"
check_file "$LOGO_DIR/anthropic-logo.svg"
check_file "$LOGO_DIR/openai-logo.svg"
check_file "$LOGO_DIR/google-logo.svg"
check_file "$LOGO_DIR/gemini-logo.svg"
check_file "$LOGO_DIR/ollama-logo.svg"
check_file "$LOGO_DIR/qwen-logo.svg"
check_file "$LOGO_DIR/zai-logo.svg"
check_file "$LOGO_DIR/claude-logo.svg"
echo ""

echo "3. Checking Frontend Mode Integration..."
echo "-----------------------------------------"
check_string_in_file "6-ui/allternit-platform/src/views/chat/ChatComposer.tsx" "Compass\|Hammer"
check_string_in_file "6-ui/allternit-platform/src/views/ChatView.tsx" "useRuntimeExecutionMode"
check_string_in_file "6-ui/allternit-platform/src/views/ChatView.tsx" "mode,"
check_string_in_file "6-ui/allternit-platform/src/lib/ai/rust-stream-adapter.ts" "mode?: 'plan' | 'build'"
check_string_in_file "6-ui/allternit-platform/src/integration/api-client.ts" "mode?: 'plan' | 'build'"
echo ""

echo "4. Checking Gizmi Mode Integration..."
echo "--------------------------------------"
check_string_in_file "cmd/gizzi-code/src/runtime/session/llm.ts" "mode?: 'plan' | 'build'"
check_string_in_file "cmd/gizzi-code/src/runtime/session/llm.ts" "SystemPrompt.provider(input.model, input.mode)"
check_string_in_file "cmd/gizzi-code/src/runtime/session/system.ts" "mode?: 'plan' | 'build'"
check_string_in_file "cmd/gizzi-code/src/runtime/session/system.ts" "PROMPT_PLAN_MODE"
check_string_in_file "cmd/gizzi-code/src/runtime/session/system.ts" "PROMPT_BUILD_MODE"
echo ""

echo "5. Checking Provider Logo Implementation..."
echo "--------------------------------------------"
check_string_in_file "6-ui/allternit-platform/src/views/chat/ChatComposer.tsx" "selectedProviderMeta"
check_string_in_file "6-ui/allternit-platform/src/views/chat/ChatComposer.tsx" "/assets/runtime-logos/"
check_string_in_file "6-ui/allternit-platform/src/lib/providers/provider-registry.ts" "PROVIDER_REGISTRY"
echo ""

echo "======================================"
echo "Test Summary"
echo "======================================"
echo -e "${GREEN}Passed: $TESTS_PASSED${NC}"
echo -e "${RED}Failed: $TESTS_FAILED${NC}"
echo ""

if [ $TESTS_FAILED -eq 0 ]; then
    echo -e "${GREEN}✓ All tests passed!${NC}"
    echo ""
    echo "Next Steps:"
    echo "1. Start the frontend: cd 6-ui/allternit-platform && npm run dev"
    echo "2. Start Gizmi: cd cmd/gizzi-code && bun run start"
    echo "3. Test mode toggle in the UI"
    echo "4. Verify provider logos display"
    echo "5. Test LLM behavior in Plan vs Build mode"
    exit 0
else
    echo -e "${RED}✗ Some tests failed${NC}"
    echo "Please review the failures above"
    exit 1
fi
