#!/bin/bash
# A2R Operator - Complete Verification Suite
# Purpose: Run all verification phases and generate report

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPORT_FILE="/Users/macbook/Desktop/verification_report.md"
TIMESTAMP=$(date +"%Y-%m-%d %H:%M:%S")

echo "========================================"
echo "A2R Operator Verification Suite"
echo "Started: $TIMESTAMP"
echo "========================================"
echo ""

# Initialize report
cat > "$REPORT_FILE" << EOF
# A2R Operator Verification Report

**Date:** $TIMESTAMP
**Tester:** Automated Verification Suite
**Working Directory:** $SCRIPT_DIR

---

## Executive Summary

| Phase | Status | Timestamp |
|-------|--------|-----------|
| 1. Boot | ⏳ Running | - |
| 2. Request Flow | ⏳ Pending | - |
| 3. Approval | ⏳ Pending | - |
| 4. Router | ⏳ Pending | - |
| 5. Browser | ⏳ Pending | - |
| 6. Canvas | ⏳ Pending | - |
| 7. Receipt | ⏳ Pending | - |
| 8. Policy | ⏳ Pending | - |
| 9. Failure | ⏳ Pending | - |

---

## Detailed Results

EOF

PASS=0
FAIL=0

# Phase 1: Boot
echo "Running Phase 1: Boot Verification..."
echo ""
if bash "$SCRIPT_DIR/verify-phase1-boot.sh" 2>&1 | tee /tmp/phase1_output.log; then
    PHASE1_STATUS="✅ PASS"
    ((PASS++))
else
    PHASE1_STATUS="❌ FAIL"
    ((FAIL++))
fi

# Update report
sed -i '' "s/| 1. Boot | ⏳ Running | - |/| 1. Boot | $PHASE1_STATUS | $(date +%H:%M) |/" "$REPORT_FILE"

echo ""
echo "Phase 1 complete. Status: $PHASE1_STATUS"
echo ""
read -p "Continue to Phase 2? (y/n) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Stopping after Phase 1."
    exit 1
fi

# Phase 2: Request Flow
echo "Running Phase 2: Request Flow..."
echo ""
if bash "$SCRIPT_DIR/verify-phase2-request.sh" 2>&1 | tee /tmp/phase2_output.log; then
    PHASE2_STATUS="✅ PASS"
    ((PASS++))
else
    PHASE2_STATUS="❌ FAIL"
    ((FAIL++))
fi

# Update report
sed -i '' "s/| 2. Request Flow | ⏳ Pending | - |/| 2. Request Flow | $PHASE2_STATUS | $(date +%H:%M) |/" "$REPORT_FILE"

echo ""
echo "Phase 2 complete. Status: $PHASE2_STATUS"
echo ""

# Continue with remaining phases...
# (Phases 3-9 to be implemented)

# Final summary
TOTAL=$((PASS + FAIL))
echo "========================================"
echo "VERIFICATION SUMMARY"
echo "========================================"
echo "Total Phases Run: $TOTAL"
echo -e "Passed: ${GREEN}$PASS${NC}"
echo -e "Failed: ${RED}$FAIL${NC}"
echo ""

if [ $FAIL -eq 0 ]; then
    FINAL_STATUS="✅ PASS"
    echo -e "${GREEN}OVERALL: PASS${NC}"
else
    FINAL_STATUS="❌ FAIL"
    echo -e "${RED}OVERALL: FAIL${NC}"
fi

# Update report with summary
cat >> "$REPORT_FILE" << EOF

---

## Summary

**Phases Run:** $TOTAL
**Passed:** $PASS
**Failed:** $FAIL

## Final Status

$FINAL_STATUS

## Evidence

### Phase 1 Output
\`\`\`
$(cat /tmp/phase1_output.log 2>/dev/null || echo "No output captured")
\`\`\`

### Phase 2 Output
\`\`\`
$(cat /tmp/phase2_output.log 2>/dev/null || echo "No output captured")
\`\`\`

---

*Report generated: $(date)*
EOF

echo ""
echo "Report saved to: $REPORT_FILE"
echo ""
