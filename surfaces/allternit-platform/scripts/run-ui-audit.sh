#!/bin/bash

# A2R Platform UI Audit Script
# This script runs a comprehensive UI audit using Playwright

set -e

echo "========================================"
echo "A2R Platform UI Audit"
echo "========================================"
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Directories
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
TEST_RESULTS_DIR="$SCRIPT_DIR/test-results"
SCREENSHOTS_DIR="$TEST_RESULTS_DIR/screenshots"

# Create directories
echo "📁 Creating test results directories..."
mkdir -p "$SCREENSHOTS_DIR"
mkdir -p "$TEST_RESULTS_DIR/html-report"

# Check if dev server is running
echo ""
echo "🔍 Checking if dev server is running..."
if lsof -ti:5177 >/dev/null 2>&1; then
    echo -e "${GREEN}✓ Dev server is running on port 5177${NC}"
else
    echo -e "${YELLOW}⚠ Dev server not running on port 5177${NC}"
    echo "Starting dev server..."
    cd "$SCRIPT_DIR/../../7-apps/shell/web"
    pnpm dev &
    DEV_SERVER_PID=$!
    echo "Waiting for dev server to start..."
    sleep 10
fi

# Check if Playwright is installed
echo ""
echo "🔍 Checking Playwright installation..."
if command -v playwright &> /dev/null; then
    echo -e "${GREEN}✓ Playwright is installed${NC}"
else
    echo -e "${YELLOW}⚠ Playwright not found, installing...${NC}"
    cd "$SCRIPT_DIR"
    pnpm add -D @playwright/test
    pnpm exec playwright install
fi

# Run the audit
echo ""
echo "========================================"
echo "🚀 Running UI Audit Tests"
echo "========================================"
echo ""

cd "$SCRIPT_DIR"

# Run Playwright tests
pnpm exec playwright test tests/ui-audit.spec.ts \
    --config=playwright.config.ts \
    --reporter=html,json,list \
    --output="$TEST_RESULTS_DIR/output" \
    --timeout=60000

# Capture exit code
TEST_EXIT_CODE=$?

# Generate report
echo ""
echo "========================================"
echo "📊 Generating Audit Report"
echo "========================================"
echo ""

# Open HTML report
echo "📄 HTML Report available at: $TEST_RESULTS_DIR/html-report/index.html"
echo "Opening report in browser..."
open "$TEST_RESULTS_DIR/html-report/index.html" 2>/dev/null || echo "Could not auto-open report"

# Summary
echo ""
echo "========================================"
echo "✅ Audit Complete"
echo "========================================"
echo ""

if [ $TEST_EXIT_CODE -eq 0 ]; then
    echo -e "${GREEN}✓ All tests passed!${NC}"
else
    echo -e "${RED}✗ Some tests failed. Check the report for details.${NC}"
fi

echo ""
echo "📁 Test Results:"
echo "   - HTML Report: $TEST_RESULTS_DIR/html-report/index.html"
echo "   - JSON Results: $TEST_RESULTS_DIR/test-results.json"
echo "   - Screenshots: $SCREENSHOTS_DIR/"
echo "   - JUnit XML: $TEST_RESULTS_DIR/junit.xml"
echo ""
echo "📝 Next Steps:"
echo "   1. Review the HTML report for visual issues"
echo "   2. Check screenshots for rendering problems"
echo "   3. Update UI_ISSUES_TRACKER.md with findings"
echo "   4. Prioritize and fix issues"
echo ""

# Cleanup if we started the dev server
if [ ! -z "$DEV_SERVER_PID" ]; then
    echo "Stopping dev server (PID: $DEV_SERVER_PID)..."
    kill $DEV_SERVER_PID 2>/dev/null || true
fi

exit $TEST_EXIT_CODE
