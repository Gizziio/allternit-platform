# Visual Capture Integration Points

## Summary

Visual evidence capture is **automatically enabled** in the following places:

## 1. **Turn-Based Execution** (Main Runtime Loop)

**Location**: `src/runtime/loop/turn.ts`

Every time a Turn executes, verification runs with visual capture:

```typescript
// Turn.execute() - line 94-98
const orchestrator = new VerificationOrchestrator(this.sessionId, {
  defaultMode: strategy.mode,
  visualCapture: this.options.visualCapture ?? { enabled: true },  // ← ALWAYS ON
});
const verification = await orchestrator.verify(plan, receipts, strategy.context);
```

**Result**: `verification.visualEvidence` contains screenshots, coverage maps, etc.

## 2. **AgentLoop** (Production Agent Loop)

**Location**: `src/runtime/loop/loop.ts`

The main agent loop creates Turns with visual capture:

```typescript
// AgentLoop.start() - line 43
const turn = new Turn(this.sessionId, this.budget, this.options);
const result = await turn.execute();
```

**Triggered**: Every turn in the agent loop automatically captures visual evidence.

## 3. **VerificationOrchestrator** (All Modes)

**Location**: `src/runtime/loop/verification-orchestrator.ts`

Visual capture is integrated into ALL verification modes:

```typescript
// verify() method - runs for ALL modes
async verify(plan: Plan, receipts: ExecutionReceipt[]): Promise<OrchestratedVerificationResult> {
  // 1. Run verification (empirical/semi-formal/both/adaptive)
  const result = await this.run...();
  
  // 2. Capture visual evidence (ALWAYS RUNS)
  await this.captureVisualEvidence(plan, receipts, result);
  
  return result;
}
```

**Modes Covered**:
- ✅ `empirical` - Test-based verification
- ✅ `semi-formal` - Reasoning-based verification  
- ✅ `both` - Both methods
- ✅ `adaptive` - Smart selection (default)

## 4. **Where It's NOT Yet Integrated**

### ❌ ShellUI Chat (Web Interface)
**Status**: NOT integrated
**Location**: Would need to be added to session processing

The ShellUI uses `SessionProcessor` which doesn't currently use Turn/AgentLoop.

**To Add**: 
```typescript
// In session processor or message handler
import { AgentLoop } from "@/runtime/loop/loop";

const loop = new AgentLoop(sessionId, {
  visualCapture: { enabled: true }
});
await loop.start();
```

### ❌ CLI Direct Commands  
**Status**: NOT integrated for agent execution
**Location**: `src/cli/commands/run.ts`

The CLI uses SDK client, not the Turn-based system.

**To Add**:
```typescript
// In run command or similar
import { AgentLoop } from "@/runtime/loop/loop";

const loop = new AgentLoop(sessionId, {
  verificationMode: "adaptive",
  visualCapture: { enabled: true }
});
await loop.start();
```

## 5. **Current Integration Status**

| Component | Status | Location |
|-----------|--------|----------|
| **Turn.execute()** | ✅ Integrated | `src/runtime/loop/turn.ts` |
| **AgentLoop** | ✅ Integrated | `src/runtime/loop/loop.ts` |
| **VerificationOrchestrator** | ✅ Integrated | `src/runtime/loop/verification-orchestrator.ts` |
| **Config Schema** | ✅ Integrated | `src/runtime/context/config/config.ts` |
| **ShellUI Chat** | ❌ NOT integrated | Needs session processor update |
| **CLI Run Command** | ❌ NOT integrated | Uses SDK, not Turn system |

## 6. **How to Enable Everywhere**

### Option A: Use AgentLoop in ShellUI/CLI

Replace direct session processing with AgentLoop:

```typescript
// Instead of direct session processing
const loop = new AgentLoop(sessionId, {
  verificationMode: "adaptive",
  visualCapture: {
    enabled: true,
    enabledTypes: ["ui-state", "coverage-map", "console-output"],
  }
});
await loop.start();
```

### Option B: Add Visual Capture to SessionProcessor

Integrate directly into the session processing:

```typescript
// src/runtime/session/processor.ts
import { VisualCaptureManager } from "@/runtime/verification/visual";

export namespace SessionProcessor {
  export async function process(streamInput: LLM.StreamInput) {
    // ... existing processing ...
    
    // Add visual capture
    const visualManager = new VisualCaptureManager({
      outputDir: "./.verification/visual",
    });
    
    const visualResult = await visualManager.capture({
      sessionId,
      verificationId: `verify_${Date.now()}`,
      cwd: process.cwd(),
    });
    
    // Include in context
    streamInput.context.visualEvidence = 
      visualManager.formatForLLM(visualResult);
  }
}
```

## 7. **Visual Evidence Flow**

```
┌─────────────────────────────────────────────────────────────────┐
│  USER: "Fix the button color"                                    │
│  ├─> ShellUI or CLI                                             │
│      ├─> SessionProcessor / AgentLoop                           │
│          ├─> Turn.execute()                                     │
│              ├─> VerificationOrchestrator.verify()              │
│                  ├─> Run verification (empirical/semi-formal)   │
│                  ├─> captureVisualEvidence()                    │
│                      ├─> VisualCaptureManager.capture()         │
│                          ├─> UIStateCaptureProvider             │
│                          │   ├─> BrowserAdapter.renderHTML()    │
│                          │       ├─> browser-use skill          │
│                          │       └─> Screenshot of Button       │
│                          ├─> CoverageCaptureProvider             │
│                          │   └─> Coverage SVG                   │
│                          └─> ConsoleCaptureProvider              │
│                              └─> Test output                     │
│                  └─> Attach to result.visualEvidence            │
│              └─> Return verification result                      │
│          └─> Continue/Complete/Ask user                         │
└─────────────────────────────────────────────────────────────────┘
```

## 8. **What's Captured Automatically**

For EVERY verification:

1. **UI Screenshots** - If UI files changed (`.tsx`, `.jsx`, `.vue`, etc.)
2. **Coverage Maps** - Test coverage visualization
3. **Console Output** - Test results with formatting
4. **Visual Diffs** - Before/after comparisons (if patches provided)
5. **Error States** - Screenshots of failures

## 9. **Configuration (Optional)**

Visual capture works **without any config**, but can be customized:

```json
// gizzi.json (optional)
{
  "verification": {
    "visualCapture": {
      "enabled": true,  // Already default
      "enabledTypes": ["ui-state", "coverage-map"],
      "outputDir": "./.verification/visual"
    }
  }
}
```

## 10. **Key Insight**

**Visual capture is ALWAYS ON** in the Turn/AgentLoop system:

- ✅ Every Turn.execute() → visual capture
- ✅ Every verification mode → visual capture  
- ✅ Auto-detects files from git
- ✅ Auto-detects browser skills
- ✅ Includes in LLM prompt
- ✅ No user configuration needed

**To use it everywhere**: Ensure ShellUI and CLI use `AgentLoop` or `Turn`.
