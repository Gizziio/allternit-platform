# Visual Evidence for Agent Verification

This module captures visual artifacts that help AI agents verify code correctness beyond what can be understood from text alone.

## The Problem

An AI agent reading code cannot "see":
- UI components rendered during tests (e.g., is the button actually red?)
- Visual output of the code (HTML, SVG, charts)
- Test coverage heatmaps
- Error visual states
- Performance visualizations

## The Solution

Capture **meaningful visual evidence** that the agent can use to verify claims:

```typescript
const manager = new VisualCaptureManager({
  outputDir: "./visual-evidence",
  enabledTypes: ["ui-state", "coverage-map", "console-output"],
});

const result = await manager.capture({
  sessionId: "sess_123",
  verificationId: "ver_456",
  cwd: "./my-project",
  files: ["src/Button.tsx"],
  testFiles: ["src/Button.test.tsx"],
});

// The LLM prompt includes:
// "VISUAL EVIDENCE: Component Button renders with red background ✓"
```

## Artifact Types

### 1. `ui-state` - Rendered UI Components
Captures what components actually look like when rendered:
- React/Vue/Svelte component screenshots
- Computed CSS styles
- DOM structure snapshots

**Use case**: Verify that a "red button" fix actually renders a red button.

```typescript
// Artifact shows:
// [Image: button-render.png]
// Computed styles: { backgroundColor: "#ff0000", color: "#ffffff" }
// VERIFIED: Button is red
```

### 2. `coverage-map` - Test Coverage Visualization
Generates coverage heatmaps from test runs:
- Line-by-line coverage status
- Percentage metrics
- Uncovered code highlighting

**Use case**: Verify that changed code is adequately tested.

```typescript
// Artifact shows:
// auth.ts: 87% coverage
// Lines 45-52: UNCOVERED (error handling)
// RECOMMENDATION: Add test for error case
```

### 3. `console-output` - Test Output Capture
Captures test results with rich formatting:
- Pass/fail counts
- Error messages with stack traces
- Test duration

**Use case**: Verify that tests pass with expected output.

```typescript
// Artifact shows:
// Tests: 45/47 passed, 2 failed
// FAIL: Button › should handle click
//   Error: Expected onClick to be called
```

### 4. `visual-diff` - Before/After Comparison *(planned)*
Side-by-side visual comparison of changes.

### 5. `performance-chart` - Performance Visualization *(planned)*
Flame graphs, memory usage, timing charts.

### 6. `error-state` - Error Visualization *(planned)*
Screenshots of error states, stack traces with context.

## Integration with Verification

### Automatic Capture

```typescript
const orchestrator = new VerificationOrchestrator("session_123", {
  visualCapture: {
    outputDir: "./captures",
    enabledTypes: ["ui-state", "coverage-map", "console-output"],
    viewport: { width: 1280, height: 720 },
  },
});

const result = await orchestrator.verify(plan, receipts, context);

// Access visual evidence
console.log(result.visualEvidence);
// {
//   artifacts: [...],
//   summary: { totalArtifacts: 3, ... },
//   llmContext: "...formatted for LLM..."
// }
```

### Including in LLM Prompt

```typescript
const visualContext = orchestrator.getVisualEvidenceForLLM();

const prompt = `
Verify this code change:
${codeDiff}

VISUAL EVIDENCE:
${visualContext}

Based on both the code and visual evidence, is this change correct?
`;
```

### Standalone Usage

```typescript
import { 
  VisualCaptureManager, 
  artifactToLLMContext,
  summarizeArtifacts 
} from "@/runtime/verification/visual";

const manager = new VisualCaptureManager({
  outputDir: "./evidence",
  enabledTypes: ["console-output", "coverage-map"],
});

const result = await manager.capture({
  sessionId: "sess_123",
  verificationId: "ver_456",
  cwd: "./project",
  testFiles: ["src/auth.test.ts"],
});

// Export for later use
await manager.exportArtifacts(result);

// Get formatted context for specific claim
const evidence = manager.getEvidenceForClaim(result, "button color");
for (const artifact of evidence) {
  console.log(artifactToLLMContext(artifact));
}
```

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│            VisualCaptureManager                         │
│  ┌─────────────────────────────────────────────────┐   │
│  │  ConsoleCaptureProvider    → console-output     │   │
│  │  CoverageCaptureProvider   → coverage-map       │   │
│  │  UIStateCaptureProvider    → ui-state           │   │
│  │  (more providers...)       → ...                │   │
│  └─────────────────────────────────────────────────┘   │
│                         ↓                               │
│  ┌─────────────────────────────────────────────────┐   │
│  │  VisualArtifact[] → formatted for LLM           │   │
│  └─────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
```

## Provider Implementation

Each provider extends `VisualCaptureProvider`:

```typescript
class MyProvider extends VisualCaptureProvider {
  readonly type = "my-type";
  readonly name = "My Provider";
  readonly supported = true;
  
  async checkAvailability(): Promise<boolean> {
    // Check if required tools exist
    return true;
  }
  
  async capture(context: CaptureContext): Promise<VisualArtifact[]> {
    // Generate visual artifacts
    return [{
      id: this.generateId("my"),
      type: "my-type",
      description: "...",
      verificationClaim: "...",
      confidence: 0.9,
      annotations: [...],
      llmContext: "...",
      data: { ... },
    }];
  }
}
```

## LLM Context Format

Visual evidence is formatted for optimal LLM consumption:

```
============================================================
VISUAL EVIDENCE FOR VERIFICATION
============================================================

Total Artifacts: 3
Types: console-output, coverage-map, ui-state
High Confidence: 2

----------------------------------------
[CONSOLE-OUTPUT] Command output: npm test
ID: console_1234567890_abc123
Claim: Tests: 45/47 passed
Confidence: 96%

Annotations:
  - [PASS] PASS: 45 passed
  - [TOTAL] TOTAL: 47 tests
  - [FAIL] FAIL: 2 failed

Details:
Command: npm test
Status: PASSED

Test Results: 45/47 passed

Failures:
  - Button › should handle click: Expected onClick to be called

----------------------------------------
[UI-STATE] UI component: Button
ID: ui_1234567890_def456
Claim: Component "Button" renders correctly
Confidence: 85%

Annotations:
  - COMPONENT: Button
  - FILE: Button.tsx

Details:
Component: Button
File: src/components/Button.tsx

Computed Styles:
  button { background-color: #ff0000; color: #ffffff }

============================================================
```

## Configuration

```typescript
// gizzi.json
{
  "verification": {
    "visualCapture": {
      "outputDir": "./visual-evidence",
      "enabledTypes": [
        "ui-state",
        "coverage-map", 
        "console-output"
      ],
      "viewport": {
        "width": 1280,
        "height": 720
      },
      "includeBase64": false,
      "maxImageDimensions": {
        "width": 1920,
        "height": 1080
      }
    }
  }
}
```

## Future Enhancements

- **Browser automation**: Uses existing `browser-use` skill or `agent-browser` (via CDP) instead of direct Playwright
- **Visual diffs**: Pixel-perfect before/after comparisons  
- **Performance charts**: Flame graphs, memory profiles
- **Error visualizations**: Annotated stack traces, crash dumps
- **Structure diagrams**: Auto-generated from code analysis
- **Video capture**: Record interactions for complex scenarios
