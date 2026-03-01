#!/bin/bash
# Test that UI memory promotion exists and follows requirements

set -e

echo "Testing UI Memory Promotion requirements..."

# Check that memory promotion component exists
if [ ! -f "apps/ui/src/pages/MemoryPromotionUI.tsx" ]; then
    echo "FAIL: MemoryPromotionUI component not found"
    exit 1
fi

# Check that memory candidate card component exists
if [ ! -f "apps/ui/src/components/MemoryCandidateCard.tsx" ]; then
    echo "FAIL: MemoryCandidateCard component not found"
    exit 1
fi

# Check that memory candidate detail component exists
if [ ! -f "apps/ui/src/components/MemoryCandidateDetail.tsx" ]; then
    echo "FAIL: MemoryCandidateDetail component not found"
    exit 1
fi

# Check that memory promotion hook exists
if [ ! -f "apps/ui/src/hooks/useMemoryPromotion.ts" ]; then
    echo "FAIL: useMemoryPromotion hook not found"
    exit 1
fi

# Check that memory promotion UI has required elements
if ! grep -q "MemoryCandidateCard\|MemoryCandidateDetail\|useMemoryPromotion\|candidates\|approve\|reject" apps/ui/src/pages/MemoryPromotionUI.tsx; then
    echo "FAIL: MemoryPromotionUI missing required elements"
    exit 1
fi

# Check that UI registry has memory promotion actions
if ! grep -q "action-memory-promote\|action-memory-candidates-list\|action-memory-candidate-approve\|action-memory-candidate-reject" apps/ui/src/ui_registry.json; then
    echo "FAIL: UI registry missing memory promotion actions"
    exit 1
fi

# Check for live polling implementation
if ! grep -q "setInterval\|polling\|refresh" apps/ui/src/pages/MemoryPromotionUI.tsx; then
    echo "FAIL: Memory promotion UI missing live polling implementation"
    exit 1
fi

echo "PASS: UI Memory Promotion requirements verified"
exit 0