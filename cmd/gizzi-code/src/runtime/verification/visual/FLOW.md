# Visual Capture Auto-Trigger Flow

This document describes how visual evidence capture is automatically triggered in the allternit platform.

## Architecture Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                            gizzi.json Configuration                          │
├─────────────────────────────────────────────────────────────────────────────┤
│  {                                                                          │
│    "verification": {                                                        │
│      "enabled": true,                                                       │
│      "visualCapture": {              ←── Configuration here                │
│        "enabled": true,                                                     │
│        "enabledTypes": ["ui-state", "coverage-map", "console-output"],      │
│        "outputDir": "./.verification/visual"                                │
│      }                                                                      │
│    }                                                                        │
│  }                                                                          │
└─────────────────────────────────────────────────────────────────────────────┘
                                      ↓
┌─────────────────────────────────────────────────────────────────────────────┐
│                           Config Loading (config.ts)                         │
├─────────────────────────────────────────────────────────────────────────────┤
│  Zod schema validates config.visualCapture.visualCapture                     │
│  Merged into Config.Info type                                                │
└─────────────────────────────────────────────────────────────────────────────┘
                                      ↓
┌─────────────────────────────────────────────────────────────────────────────┐
│                           Agent / Runtime Initialization                     │
├─────────────────────────────────────────────────────────────────────────────┤
│  const config = await Config.load()                                          │
│                                                                              │
│  const turnOptions: TurnOptions = {                                          │
│    verificationMode: config.verification?.mode,                              │
│    visualCapture: config.verification?.visualCapture,        ←── Passed here │
│  }                                                                           │
└─────────────────────────────────────────────────────────────────────────────┘
                                      ↓
┌─────────────────────────────────────────────────────────────────────────────┐
│                              Turn.execute()                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│  1. GATHER: ContextPacker.pack()                                            │
│  2. PLAN: Planner.generatePlan()                                            │
│  3. ACT: Executor.run() → returns receipts                                  │
│  4. VERIFY:                                                                 │
│                                                                              │
│     const orchestrator = new VerificationOrchestrator(                       │
│       this.sessionId,                                                        │
│       {                                                                      │
│         defaultMode: strategy.mode,                                          │
│         visualCapture: this.options.visualCapture,  ←── Passed to orchestrator│
│       }                                                                      │
│     );                                                                       │
│                                                                              │
│     const verification = await orchestrator.verify(plan, receipts);          │
│                                                                              │
│     // Inside orchestrator.verify():                                         │
│     await this.captureVisualEvidence(plan, receipts, context, result);       │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
                                      ↓
┌─────────────────────────────────────────────────────────────────────────────┐
│                    VerificationOrchestrator.captureVisualEvidence()          │
├─────────────────────────────────────────────────────────────────────────────┤
│  if (!this.visualManager) return;  ←── Skip if not configured                │
│                                                                              │
│  this.visualResult = await this.visualManager.capture({                      │
│    sessionId: this.id,                                                       │
│    verificationId: `verify_${Date.now()}`,                                   │
│    cwd: process.cwd(),                                                       │
│    files: context?.patches?.map(p => p.path),                                │
│    patches: context?.patches,                                                │
│    testFiles: context?.testFiles,                                            │
│  });                                                                         │
│                                                                              │
│  // Attach to result                                                         │
│  result.visualEvidence = {                                                   │
│    artifacts: [...],                                                         │
│    summary: {...},                                                           │
│    llmContext: this.visualManager.formatForLLM(this.visualResult),           │
│  };                                                                          │
└─────────────────────────────────────────────────────────────────────────────┘
                                      ↓
┌─────────────────────────────────────────────────────────────────────────────┐
│                         VisualCaptureManager.capture()                       │
├─────────────────────────────────────────────────────────────────────────────┤
│  for each enabledType in ['ui-state', 'coverage-map', ...]:                  │
│    const provider = getProvider(enabledType)                                 │
│    if (await provider.checkAvailability()):                                  │
│      const artifacts = await provider.capture(context)                       │
│      allArtifacts.push(...artifacts)                                         │
│                                                                              │
│  // Providers:                                                               │
│  // - UIStateCaptureProvider → browser-use / agent-browser                   │
│  // - CoverageCaptureProvider → coverage SVG                                 │
│  // - ConsoleCaptureProvider → test output                                   │
│  // - VisualDiffCaptureProvider → before/after comparison                    │
│  // - ErrorStateCaptureProvider → failure screenshots                        │
└─────────────────────────────────────────────────────────────────────────────┘
                                      ↓
┌─────────────────────────────────────────────────────────────────────────────┐
│                         Semi-Formal Verifier                                 │
├─────────────────────────────────────────────────────────────────────────────┤
│  // Visual evidence passed to LLM in prompt                                  │
│                                                                              │
│  ## Visual Evidence                                                          │
│                                                                              │
│  [UI-STATE] Button renders with red background                               │
│  - Confidence: 95%                                                           │
│  - Screenshot: ./visual-evidence/component_Button_123.png                    │
│  - Computed styles: background-color: #ff0000                                │
│                                                                              │
│  [COVERAGE-MAP] auth.ts: 87% line coverage                                   │
│  - Lines 45-52: UNCOVERED (error handling)                                   │
│                                                                              │
│  Based on code AND visual evidence, verify this change.                      │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Entry Points

### 1. Automatic (Turn-based)
```typescript
// In runtime initialization
const config = await Config.load();

const turn = new Turn(sessionId, budget, {
  verificationMode: config.verification?.mode ?? "adaptive",
  visualCapture: config.verification?.visualCapture,  // ← Auto-triggered
});

const result = await turn.execute();
```

### 2. Manual (CLI)
```bash
# Run verification with visual capture
gizzi verify run \
  --mode semi-formal \
  --visual-capture \
  --visual-types ui-state coverage-map

# Or capture manually
gizzi verify visual capture \
  --files src/Button.tsx \
  --types ui-state console-output \
  --output ./captures
```

### 3. Programmatic
```typescript
import { VerificationOrchestrator } from "@/runtime/verification";

const orchestrator = new VerificationOrchestrator("session_123", {
  defaultMode: "adaptive",
  visualCapture: {
    enabled: true,
    enabledTypes: ["ui-state", "coverage-map", "console-output"],
    outputDir: "./visual-evidence",
  },
});

const result = await orchestrator.verify(plan, receipts, context);

// Access visual evidence
console.log(result.visualEvidence.artifacts);
console.log(orchestrator.getVisualEvidenceForLLM());
```

## Configuration Options

```typescript
// gizzi.json
{
  "verification": {
    "enabled": true,
    "mode": "adaptive",
    "visualCapture": {
      "enabled": true,           // Master switch
      "outputDir": "./.verification/visual",
      "enabledTypes": [          // Which artifacts to capture
        "ui-state",              // Component screenshots
        "visual-diff",           // Before/after comparisons
        "coverage-map",          // Coverage heatmaps
        "error-state",           // Failure screenshots
        "console-output"         // Test output
      ],
      "viewport": {              // Screenshot size
        "width": 1280,
        "height": 720
      },
      "includeBase64": false,    // Embed images in JSON
      "quality": 90              // Screenshot quality
    }
  }
}
```

## Browser Detection Priority

When visual capture is triggered, the system tries browsers in this order:

1. **browser-use** skill (Python + Ollama)
   - Path: `~/browser-use/scripts/browser_controller.py`
   - Best for: Complex UI interactions, AI-guided navigation
   
2. **agent-browser** (CDP-based)
   - Command: `agent-browser`
   - Best for: Electron apps, Chrome DevTools Protocol
   
3. **Playwright** (fallback)
   - Direct Playwright integration
   - Best for: Headless environments, CI/CD

## Result Flow

```typescript
// 1. Visual artifacts attached to verification result
interface OrchestratedVerificationResult {
  passed: boolean;
  confidence: "high" | "medium" | "low";
  certificate?: VerificationCertificate;
  visualEvidence?: {              // ← Added by capture
    artifacts: VisualArtifact[];
    summary: {
      totalArtifacts: number;
      typesCaptured: string[];
      hasVisualEvidence: boolean;
    };
    llmContext: string;          // Formatted for LLM
  };
}

// 2. Visual evidence included in certificate
interface VerificationCertificate {
  // ... existing fields ...
  visualEvidence?: VisualEvidence[];  // ← For LLM reasoning
}

// 3. LLM prompt includes visual context
const prompt = `
  Verify this code:
  ${code}
  
  VISUAL EVIDENCE:
  ${visualEvidence.llmContext}  // ← LLM "sees" the evidence
  
  Based on code AND visual evidence above, is this correct?
`;
```

## Summary

1. **Config**: Set `verification.visualCapture.enabled: true` in `gizzi.json`
2. **Auto-trigger**: Turn.execute() → orchestrator.verify() → captureVisualEvidence()
3. **Capture**: VisualCaptureManager → Providers → Browser Skills
4. **Result**: Visual artifacts attached to verification result and certificate
5. **LLM**: Visual context included in prompt for reasoning
