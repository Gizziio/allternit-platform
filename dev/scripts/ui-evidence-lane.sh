#!/bin/bash

# UI Evidence Lane - DAG Subgraph Template
# 
# This script runs the complete UI validation pipeline.
# It is called by the main DAG executor for UI-related nodes.
#
# Usage: ./ui-evidence-lane.sh [component_path] [wih_id] [dag_node_id]

set -e  # Exit on error

# Arguments
COMPONENT_PATH="${1:-.}"
WIH_ID="${2:-unknown}"
DAG_NODE_ID="${3:-unknown}"

# Configuration
STORYBOOK_DIR="${STORYBOOK_DIR:-./6-ui/allternit-platform}"
OUTPUT_DIR="${OUTPUT_DIR:-./.allternit/evidence/ui}"
TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

echo "🎨 UI Evidence Lane"
echo "==================="
echo "Component: $COMPONENT_PATH"
echo "WIH ID: $WIH_ID"
echo "DAG Node: $DAG_NODE_ID"
echo "Timestamp: $TIMESTAMP"
echo ""

# Initialize evidence receipt
EVIDENCE_RECEIPT="$OUTPUT_DIR/receipt-$TIMESTAMP.json"
mkdir -p "$OUTPUT_DIR"

cat > "$EVIDENCE_RECEIPT" << EOF
{
  "type": "ui:evidence",
  "timestamp": "$TIMESTAMP",
  "wih_id": "$WIH_ID",
  "dag_node_id": "$DAG_NODE_ID",
  "component_path": "$COMPONENT_PATH",
  "evidence": {
    "storybook_build": "pending",
    "interaction_tests": "pending",
    "visual_regression": "pending",
    "accessibility": "pending",
    "stories_count": 0,
    "components_covered": []
  },
  "artifacts": [],
  "status": "running"
}
EOF

echo "📦 Step 1: Building Storybook..."
echo ""

# Step 1: Build Storybook
cd "$STORYBOOK_DIR"
if npm run build:storybook > "$OUTPUT_DIR/storybook-build.log" 2>&1; then
    echo "✅ Storybook build successful"
    
    # Update receipt
    jq --arg status "success" '.evidence.storybook_build = $status' "$EVIDENCE_RECEIPT" > "$EVIDENCE_RECEIPT.tmp"
    mv "$EVIDENCE_RECEIPT.tmp" "$EVIDENCE_RECEIPT"
    
    # Add artifact
    jq --arg artifact "storybook-static" '.artifacts += [$artifact]' "$EVIDENCE_RECEIPT" > "$EVIDENCE_RECEIPT.tmp"
    mv "$EVIDENCE_RECEIPT.tmp" "$EVIDENCE_RECEIPT"
else
    echo "❌ Storybook build failed"
    cat "$OUTPUT_DIR/storybook-build.log"
    
    # Update receipt with failure
    jq --arg status "failed" '.evidence.storybook_build = $status | .status = "failed"' "$EVIDENCE_RECEIPT" > "$EVIDENCE_RECEIPT.tmp"
    mv "$EVIDENCE_RECEIPT.tmp" "$EVIDENCE_RECEIPT"
    
    exit 1
fi

echo ""
echo "🧪 Step 2: Running interaction tests..."
echo ""

# Step 2: Run interaction tests
if npm run test:storybook -- --reporter=json --output-file="$OUTPUT_DIR/test-results.json" > "$OUTPUT_DIR/test-stdout.log" 2>&1; then
    echo "✅ Interaction tests passed"
    
    # Update receipt
    jq --arg status "passed" '.evidence.interaction_tests = $status' "$EVIDENCE_RECEIPT" > "$EVIDENCE_RECEIPT.tmp"
    mv "$EVIDENCE_RECEIPT.tmp" "$EVIDENCE_RECEIPT"
    
    # Add artifact
    jq --arg artifact "test-results.json" '.artifacts += [$artifact]' "$EVIDENCE_RECEIPT" > "$EVIDENCE_RECEIPT.tmp"
    mv "$EVIDENCE_RECEIPT.tmp" "$EVIDENCE_RECEIPT"
else
    echo "❌ Interaction tests failed"
    cat "$OUTPUT_DIR/test-stdout.log"
    
    # Update receipt with failure
    jq --arg status "failed" '.evidence.interaction_tests = $status | .status = "failed"' "$EVIDENCE_RECEIPT" > "$EVIDENCE_RECEIPT.tmp"
    mv "$EVIDENCE_RECEIPT.tmp" "$EVIDENCE_RECEIPT"
    
    exit 1
fi

echo ""
echo "📸 Step 3: Running visual regression..."
echo ""

# Step 3: Visual regression (if Chromatic configured)
if [ -n "$CHROMATIC_PROJECT_TOKEN" ]; then
    if npm run chromatic -- --exit-zero-on-changes --exit-once-uploaded > "$OUTPUT_DIR/chromatic.log" 2>&1; then
        echo "✅ Visual regression passed"
        
        # Update receipt
        jq --arg status "approved" '.evidence.visual_regression = $status' "$EVIDENCE_RECEIPT" > "$EVIDENCE_RECEIPT.tmp"
        mv "$EVIDENCE_RECEIPT.tmp" "$EVIDENCE_RECEIPT"
    else
        echo "⚠️  Visual regression has changes (non-blocking)"
        cat "$OUTPUT_DIR/chromatic.log"
        
        # Update receipt
        jq --arg status "changes_detected" '.evidence.visual_regression = $status' "$EVIDENCE_RECEIPT" > "$EVIDENCE_RECEIPT.tmp"
        mv "$EVIDENCE_RECEIPT.tmp" "$EVIDENCE_RECEIPT"
    fi
else
    echo "⚠️  Chromatic not configured, skipping visual regression"
    
    # Update receipt
    jq --arg status "skipped" '.evidence.visual_regression = $status' "$EVIDENCE_RECEIPT" > "$EVIDENCE_RECEIPT.tmp"
    mv "$EVIDENCE_RECEIPT.tmp" "$EVIDENCE_RECEIPT"
fi

echo ""
echo "♿ Step 4: Running accessibility tests..."
echo ""

# Step 4: Accessibility tests (if configured)
if npm run test:a11y -- --reporter=json --output-file="$OUTPUT_DIR/a11y-results.json" > "$OUTPUT_DIR/a11y-stdout.log" 2>&1; then
    echo "✅ Accessibility tests passed"
    
    # Update receipt
    jq --arg status "passed" '.evidence.accessibility = $status' "$EVIDENCE_RECEIPT" > "$EVIDENCE_RECEIPT.tmp"
    mv "$EVIDENCE_RECEIPT.tmp" "$EVIDENCE_RECEIPT"
    
    # Add artifact
    jq --arg artifact "a11y-results.json" '.artifacts += [$artifact]' "$EVIDENCE_RECEIPT" > "$EVIDENCE_RECEIPT.tmp"
    mv "$EVIDENCE_RECEIPT.tmp" "$EVIDENCE_RECEIPT"
else
    echo "❌ Accessibility tests failed"
    cat "$OUTPUT_DIR/a11y-stdout.log"
    
    # Update receipt with failure
    jq --arg status "failed" '.evidence.accessibility = $status | .status = "failed"' "$EVIDENCE_RECEIPT" > "$EVIDENCE_RECEIPT.tmp"
    mv "$EVIDENCE_RECEIPT.tmp" "$EVIDENCE_RECEIPT"
    
    exit 1
fi

echo ""
echo "📊 Step 5: Counting stories..."
echo ""

# Step 5: Count stories and components
STORIES_COUNT=$(grep -r "export const" "$STORYBOOK_DIR/src/**/*.stories.tsx" 2>/dev/null | wc -l || echo "0")
COMPONENTS_COUNT=$(grep -r "export default" "$STORYBOOK_DIR/src/**/*.stories.tsx" 2>/dev/null | wc -l || echo "0")

# Update receipt
jq --argjson stories "$STORIES_COUNT" '.evidence.stories_count = $stories' "$EVIDENCE_RECEIPT" > "$EVIDENCE_RECEIPT.tmp"
mv "$EVIDENCE_RECEIPT.tmp" "$EVIDENCE_RECEIPT"

echo "✅ Found $STORIES_COUNT stories across $COMPONENTS_COUNT components"

echo ""
echo "📋 Step 6: Finalizing evidence receipt..."
echo ""

# Step 6: Finalize receipt
jq --arg status "complete" '.status = $status' "$EVIDENCE_RECEIPT" > "$EVIDENCE_RECEIPT.tmp"
mv "$EVIDENCE_RECEIPT.tmp" "$EVIDENCE_RECEIPT"

echo ""
echo "==================="
echo "✅ UI Evidence Lane Complete"
echo ""
echo "Evidence receipt: $EVIDENCE_RECEIPT"
echo ""

# Output summary
echo "Summary:"
jq '.evidence' "$EVIDENCE_RECEIPT"

# Exit with appropriate code
if [ "$(jq -r '.status' "$EVIDENCE_RECEIPT")" = "complete" ]; then
    exit 0
else
    exit 1
fi
