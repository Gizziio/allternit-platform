#!/bin/bash
# A2R Operator - Complete Verification Suite
# Purpose: Run all 9 verification phases and prove the system works
# Rule: If it isn't verified running, it isn't done.

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
REPORT_FILE="/Users/macbook/Desktop/verification_report_full.md"
TIMESTAMP=$(date +"%Y-%m-%d %H:%M:%S")

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo "========================================"
echo "A2R Operator Verification Suite"
echo "Started: $TIMESTAMP"
echo "========================================"
echo ""

# Initialize report
cat > "$REPORT_FILE" << 'EOF'
# A2R Operator - Full Verification Report

**Date:** TIMESTAMP_PLACEHOLDER
**Tester:** Automated Verification Suite
**Working Directory:** PROJECT_ROOT_PLACEHOLDER

---

## Executive Summary

| Phase | Status | Timestamp | Duration |
|-------|--------|-----------|----------|
EOF

sed -i '' "s/TIMESTAMP_PLACEHOLDER/$TIMESTAMP/" "$REPORT_FILE"
sed -i '' "s|PROJECT_ROOT_PLACEHOLDER|$PROJECT_ROOT|" "$REPORT_FILE"

PASS=0
FAIL=0
TOTAL=9

# Function to record phase result
record_phase() {
    local phase_num=$1
    local phase_name=$2
    local status=$3
    local timestamp=$(date +%H:%M)
    local duration=${4:-0}
    
    if [ "$status" = "PASS" ]; then
        echo "| $phase_num. $phase_name | ✅ PASS | $timestamp | ${duration}s |" >> "$REPORT_FILE"
        ((PASS++))
    else
        echo "| $phase_num. $phase_name | ❌ FAIL | $timestamp | ${duration:-0}s |" >> "$REPORT_FILE"
        ((FAIL++))
    fi
}

# Function to run a phase
run_phase() {
    local phase_num=$1
    local phase_name=$2
    local script=$3
    
    echo ""
    echo -e "${BLUE}════════════════════════════════════════${NC}"
    echo -e "${BLUE}PHASE $phase_num: $phase_name${NC}"
    echo -e "${BLUE}════════════════════════════════════════${NC}"
    
    local start_time=$(date +%s)
    
    if bash "$SCRIPT_DIR/$script" 2>&1 | tee /tmp/phase${phase_num}_output.log; then
        local end_time=$(date +%s)
        local duration=$((end_time - start_time))
        echo -e "${GREEN}✓ PHASE $phase_num: PASS${NC} (${duration}s)"
        record_phase "$phase_num" "$phase_name" "PASS" "$duration"
        
        # Add evidence to report
        echo "" >> "$REPORT_FILE"
        echo "### PHASE $phase_num: $phase_name ✅ PASS" >> "$REPORT_FILE"
        echo "" >> "$REPORT_FILE"
        echo "\`\`\`" >> "$REPORT_FILE"
        cat /tmp/phase${phase_num}_output.log >> "$REPORT_FILE"
        echo "\`\`\`" >> "$REPORT_FILE"
        echo "" >> "$REPORT_FILE"
        
        return 0
    else
        echo -e "${RED}✗ PHASE $phase_num: FAIL${NC}"
        record_phase "$phase_num" "$phase_name" "FAIL"
        
        # Add failure evidence
        echo "" >> "$REPORT_FILE"
        echo "### PHASE $phase_num: $phase_name ❌ FAIL" >> "$REPORT_FILE"
        echo "" >> "$REPORT_FILE"
        echo "**Error:**" >> "$REPORT_FILE"
        echo "\`\`\`" >> "$REPORT_FILE"
        cat /tmp/phase${phase_num}_output.log >> "$REPORT_FILE"
        echo "\`\`\`" >> "$REPORT_FILE"
        echo "" >> "$REPORT_FILE"
        
        return 1
    fi
}

# Check if daemon is running, start if needed
echo "Checking operator daemon status..."
if ! pgrep -f "operator-daemon.js" > /dev/null; then
    echo -e "${YELLOW}Daemon not running, starting...${NC}"
    cd "$PROJECT_ROOT/1-kernel/agent-systems/a2r-dak-runner"
    nohup node dist/operator-daemon.js --port 3010 > /tmp/operator-daemon.log 2>&1 &
    sleep 3
    
    if pgrep -f "operator-daemon.js" > /dev/null; then
        echo -e "${GREEN}✓ Daemon started${NC}"
    else
        echo -e "${RED}✗ Failed to start daemon${NC}"
        cat /tmp/operator-daemon.log
        exit 1
    fi
else
    echo -e "${GREEN}✓ Daemon already running${NC}"
fi

echo ""

# PHASE 1: Boot Verification
run_phase 1 "Boot Verification" "verify-phase1-boot.sh" || true

# PHASE 2: Request Flow
run_phase 2 "Request Flow" "verify-phase2-request.sh" || true

# PHASE 3-9: Run remaining phases
run_phase 3 "Approval Execution" "verify-phase3-approval.sh" || true
run_phase 4 "Router Decision" "verify-phase4-router.sh" || true
run_phase 5 "Browser Automation" "verify-phase5-browser.sh" || true
run_phase 6 "Canvas Verification" "verify-phase6-canvas.sh" || true
run_phase 7 "Receipt Generation" "verify-phase7-receipt.sh" || true
run_phase 8 "Policy Enforcement" "verify-phase8-policy.sh" || true
run_phase 9 "Failure Handling" "verify-phase9-failure.sh" || true

# Summary
echo ""
echo "========================================"
echo "VERIFICATION SUMMARY"
echo "========================================"
echo "Total Phases: $TOTAL"
echo -e "Passed: ${GREEN}$PASS${NC}"
echo -e "Failed: ${RED}$FAIL${NC}"
echo ""

if [ $FAIL -eq 0 ]; then
    FINAL_STATUS="✅ PASS"
    echo -e "${GREEN}OVERALL: PASS${NC}"
    echo "All verification phases completed successfully."
else
    FINAL_STATUS="❌ FAIL"
    echo -e "${RED}OVERALL: FAIL${NC}"
    echo "$FAIL phase(s) failed. Review the report for details."
fi

# Complete the report
cat >> "$REPORT_FILE" << EOF

---

## Summary

**Phases Run:** $TOTAL
**Passed:** $PASS
**Failed:** $FAIL
**Success Rate:** $(( (PASS * 100) / TOTAL ))%

## Final Status

$FINAL_STATUS

## Evidence

EOF

for phase in 1 2 3 4 5 6 7 8 9; do
    if [ -f "/tmp/phase${phase}_output.log" ]; then
        echo "### Phase $phase Output" >> "$REPORT_FILE"
        echo "\`\`\`" >> "$REPORT_FILE"
        cat "/tmp/phase${phase}_output.log" >> "$REPORT_FILE"
        echo "\`\`\`" >> "$REPORT_FILE"
        echo "" >> "$REPORT_FILE"
    fi
done

cat >> "$REPORT_FILE" << EOF
---

*Report generated: $(date)*
*Verification Suite v1.0*
EOF

echo "========================================"
echo "Report saved to: $REPORT_FILE"
echo "========================================"
echo ""

# Exit with appropriate code
if [ $FAIL -eq 0 ]; then
    exit 0
else
    exit 1
fi
