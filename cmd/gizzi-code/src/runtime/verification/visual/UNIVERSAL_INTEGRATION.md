# Universal Visual Evidence Integration

This document describes how visual evidence capture is integrated across ALL execution paths in the a2rchitech system.

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         VISUAL CAPTURE SYSTEM                                │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐              │
│  │   BrowserAdapter │  │ CaptureManager  │  │  Provider Chain │              │
│  │                 │  │                 │  │                 │              │
│  │ • browser-use   │  │ • Orchestrates  │  │ • Coverage      │              │
│  │ • agent-browser │  │ • Formats LLM   │  │ • Console       │              │
│  │ • Playwright    │  │   context       │  │ • UI State      │              │
│  └────────┬────────┘  └────────┬────────┘  │ • Visual Diff   │              │
│           │                    │           │ • Error State   │              │
│           └────────────────────┴───────────┴─────────────────┘              │
│                                 │                                            │
│                    ┌────────────┴────────────┐                               │
│                    │   INTEGRATION LAYER      │                               │
│                    └────────────┬────────────┘                               │
│                                 │                                            │
├─────────────────────────────────┼────────────────────────────────────────────┤
│           EXECUTION PATHS       │                                            │
│  ┌──────────────────────────────┼─────────────────────────────────────┐     │
│  │  1. TURN / AGENT LOOP        │                                      │     │
│  │     ┌──────────┐             │        ┌───────────────────────┐    │     │
│  │     │  Turn    │─────────────┴───────→│ VerificationOrchestrator│    │     │
│  │     └──────────┘                      │  • Auto-captures visual  │    │     │
│  │                                       │  • Attaches to result    │    │     │
│  │                                       └───────────────────────┘    │     │
│  └───────────────────────────────────────────────────────────────────┘     │
│                                                                            │
│  ┌──────────────────────────────┼─────────────────────────────────────┐     │
│  │  2. SESSION PROCESSOR        │                                      │     │
│  │     ┌──────────────┐         │        ┌────────────────────────┐   │     │
│  │     │ SessionProc  │─────────┴───────→│ SessionProcessorVisual │   │     │
│  │     │              │                  │        Adapter         │   │     │
│  │     │ • ShellUI    │                  │  • captureIfNeeded()   │   │     │
│  │     │ • LLM.stream │                  │  • enhanceMessages()   │   │     │
│  │     │              │                  │  • injectEvidence()    │   │     │
│  │     └──────────────┘                  └────────────────────────┘   │     │
│  └───────────────────────────────────────────────────────────────────┘     │
│                                                                            │
│  ┌──────────────────────────────┼─────────────────────────────────────┐     │
│  │  3. SERVER HOOKS (Universal) │                                      │     │
│  │                              │        ┌────────────────────────┐   │     │
│  │     All paths trigger:       └───────→│    Visual Capture      │   │     │
│  │     • onBeforeVerify()                │       Server Hooks     │   │     │
│  │     • onAfterVerify()                 │                        │   │     │
│  │     • onSessionEnd()                  │  • initializeVisual()  │   │     │
│  │                                       │  • executeHooks()      │   │     │
│  │                                       │  • withVisualCapture() │   │     │
│  │                                       └────────────────────────┘   │     │
│  └───────────────────────────────────────────────────────────────────┘     │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Integration Points

### 1. Turn / AgentLoop (Already Integrated)

**File**: `src/runtime/loop/turn.ts`

```typescript
// Visual capture is always enabled
const turn = new Turn(sessionId, budget, {
  visualCapture: { enabled: true }, // Always on
});
```

**File**: `src/runtime/loop/verification-orchestrator.ts`

```typescript
// Automatically captures visual evidence after verification
await this.captureVisualEvidence(plan, receipts, context, result);
```

### 2. SessionProcessor (ShellUI Path)

**File**: `src/runtime/session/processor.ts` (needs integration)

```typescript
import { 
  SessionProcessorVisualAdapter,
  VisualCaptureManager 
} from "../verification/visual";

// Initialize adapter
const visualAdapter = new SessionProcessorVisualAdapter({
  manager: new VisualCaptureManager(),
  autoCapture: true,
  waitForDevServer: true,
});

// In process() method:
async process(sessionId: string, patches: Patch[]) {
  // Capture visual evidence if needed
  const visualContext = await visualAdapter.captureIfNeeded(sessionId, patches);
  
  // Enhance messages with visual evidence
  const messages = visualAdapter.enhanceMessages(baseMessages, visualContext);
  
  // Send to LLM with visual context
  const response = await LLM.stream(messages);
}
```

### 3. Server Hooks (Universal Coverage)

**File**: Server initialization

```typescript
import { initializeVisualCapture, VisualCaptureManager } from "./verification/visual";

// Initialize once during server startup
const manager = new VisualCaptureManager();
await initializeVisualCapture({ manager });
```

**Usage in any handler**:

```typescript
import { executeHooks, withVisualCapture } from "./verification/visual";

// Option A: Manual hook execution
async function handleRequest(sessionId: string) {
  await executeHooks("onBeforeVerify", { sessionId });
  
  // ... do work ...
  
  await executeHooks("onAfterVerify", { sessionId });
}

// Option B: Wrapped execution
async function handleRequest(sessionId: string) {
  return withVisualCapture(sessionId, async () => {
    // ... do work ...
    return result;
  });
}
```

## Browser Skill Priority

The system automatically detects and uses available browser skills:

```
1. browser-use (Python agent)
   ~/browser-use/scripts/browser_controller.py
   
2. agent-browser (CDP-based)
   agent-browser CLI
   
3. Playwright (fallback)
   npx playwright
```

## Visual Evidence Flow

```
1. Code Change Detected
        ↓
2. Files Analyzed (git diff, patches)
        ↓
3. Dev Server Check (localhost:3000)
        ↓
4. Browser Skill Detection
   ├─→ browser-use skill
   ├─→ agent-browser CDP
   └─→ Playwright fallback
        ↓
5. Capture Execution
   ├─→ Coverage Map (nyc/c8 reports)
   ├─→ Console Output (logs/errors)
   ├─→ UI State (screenshot + accessibility)
   ├─→ Visual Diff (before/after comparison)
   └─→ Error State (stack traces)
        ↓
6. Artifact Processing
   ├─→ Format for LLM context
   ├─→ Generate annotations
   └─→ Calculate confidence scores
        ↓
7. Integration
   ├─→ Attach to verification result
   ├─→ Inject into LLM messages
   └─→ Cache for session
```

## Configuration

**Default configuration** (from `src/runtime/context/config/config.ts`):

```typescript
visualCapture: {
  enabled: true,  // Always on by default
  enabledTypes: [
    "console-output",
    "coverage-map", 
    "ui-state"
  ],
  outputDir: "./.verification/visual",
  viewport: { width: 1280, height: 720 },
}
```

## API Reference

### Core Types

```typescript
// Visual artifact produced by capture
interface VisualArtifact {
  id: string;
  type: VisualArtifactType;
  description: string;
  verificationClaim: string;
  confidence: number;
  image?: ImageData;
  data?: Record<string, unknown>;
  llmContext: string;
}

// Capture result
interface CaptureResult {
  sessionId: string;
  verificationId: string;
  artifacts: VisualArtifact[];
  byType: Record<VisualArtifactType, VisualArtifact[]>;
  evidence: VisualArtifact[];
  summary: {
    totalArtifacts: number;
    typesCaptured: VisualArtifactType[];
    hasVisualEvidence: boolean;
    highConfidenceArtifacts: number;
  };
}
```

### Integration Functions

```typescript
// Initialize server-side hooks
async function initializeVisualCapture(options: {
  manager: VisualCaptureManager;
  enabled?: boolean;
}): Promise<void>

// Capture for deterministic paths
async function captureVisualEvidenceDeterministic(
  manager: VisualCaptureManager,
  sessionId: string,
  options: DeterministicCaptureOptions
): Promise<DeterministicCaptureResult>

// Inject evidence into LLM messages
function injectVisualEvidence(
  messages: Array<{ role: string; content: string }>,
  visualEvidence: string
): Array<{ role: string; content: string }>

// Check if patches need visual verification
function requiresVisualVerification(patches: Patch[]): boolean
```

## Usage Examples

### Example 1: Basic Integration

```typescript
import { 
  VisualCaptureManager,
  captureVisualEvidenceDeterministic 
} from "./verification/visual";

const manager = new VisualCaptureManager();

// Capture visual evidence
const result = await captureVisualEvidenceDeterministic(
  manager,
  "session-123",
  {
    changedFiles: ["src/components/Button.tsx"],
    waitForServer: true,
  }
);

// Use in LLM context
console.log(result.llmContext);
```

### Example 2: SessionProcessor Integration

```typescript
import { SessionProcessorVisualAdapter } from "./verification/visual";

class SessionProcessor {
  private visualAdapter = new SessionProcessorVisualAdapter({
    manager: new VisualCaptureManager(),
    autoCapture: true,
    waitForDevServer: true,
    serverTimeout: 10000,
  });

  async process(sessionId: string, patches: Patch[]) {
    // Capture if UI-related files changed
    const visualContext = await this.visualAdapter.captureIfNeeded(
      sessionId, 
      patches
    );
    
    // Enhance system prompt
    const systemPrompt = this.visualAdapter.getSystemPrompt(
      baseSystemPrompt,
      visualContext
    );
    
    // Send to LLM
    const response = await this.llm.complete(systemPrompt, userMessage);
    
    // Clear cache
    this.visualAdapter.clearCache(sessionId);
    
    return response;
  }
}
```

### Example 3: Universal Server Hooks

```typescript
import { 
  initializeVisualCapture,
  executeHooks,
  withVisualCapture 
} from "./verification/visual";

// Initialize once
await initializeVisualCapture({
  manager: new VisualCaptureManager(),
});

// Use in any handler
app.post("/process", async (req, res) => {
  const { sessionId } = req.body;
  
  const result = await withVisualCapture(sessionId, async () => {
    // Your processing logic here
    return await processSession(sessionId);
  });
  
  res.json(result);
});
```

## Summary

This universal visual capture integration ensures that:

1. **Turn/AgentLoop** automatically captures visual evidence via `VerificationOrchestrator`
2. **SessionProcessor** (ShellUI) can capture via `SessionProcessorVisualAdapter`
3. **All execution paths** can use server hooks for consistent capture
4. **Browser skills** are automatically detected (browser-use → agent-browser → Playwright)
5. **Visual evidence** is formatted for LLM consumption and attached to verification results

The system is **always on by default** and gracefully degrades if browser tools aren't available.
