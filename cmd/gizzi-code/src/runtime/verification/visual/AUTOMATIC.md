# Automatic Visual Capture

Visual evidence capture is **automatic and always on** - no user configuration required.

## How It Works

### 1. **Enabled by Default**

```typescript
// In config.ts - visual capture defaults to true
visualCapture: z.object({
  enabled: z.boolean().default(true),  // ← DEFAULT: true
  outputDir: z.string().default("./.verification/visual"),
  enabledTypes: z.array(...).default(["ui-state", "coverage-map", "console-output"]),
})

// In orchestrator - auto-initializes even without config
const visualCaptureConfig = this.config.visualCapture ?? { enabled: true };
if (visualCaptureConfig.enabled !== false) {
  this.visualManager = new VisualCaptureManager(visualCaptureConfig);
}
```

### 2. **Auto-Detects Changed Files**

If no files are explicitly provided, the system automatically detects them:

```typescript
// Auto-detect files if not provided
const files = context?.patches?.map(p => p.path) || 
              this.detectChangedFiles() ||  // ← Git auto-detection
              [];

private detectChangedFiles(): string[] | null {
  try {
    const output = execSync("git diff --name-only HEAD");
    return output.split("\n").filter(Boolean);
  } catch {
    return null;
  }
}
```

### 3. **Works Without Configuration**

**No gizzi.json needed** - visual capture works out of the box:

```typescript
// Turn.execute() automatically enables visual capture
const orchestrator = new VerificationOrchestrator(this.sessionId, {
  defaultMode: strategy.mode,
  visualCapture: this.options.visualCapture ?? { enabled: true },  // ← Always on
});
```

### 4. **Triggered Automatically**

Every time verification runs, visual capture happens automatically:

```
Turn.execute()
  → orchestrator.verify()
    → captureVisualEvidence()  // ← Auto-called
      → VisualCaptureManager.capture()
        → Providers (ui-state, coverage-map, etc.)
          → Browser Skills (browser-use / agent-browser)
            → Screenshots / Coverage maps / Console output
```

## Usage Scenarios

### Scenario 1: No Configuration At All
```bash
# Just run the agent - visual capture happens automatically
gizzi
```
✅ Visual evidence captured automatically

### Scenario 2: With gizzi.json (Optional)
```json
{
  "verification": {
    "visualCapture": {
      "enabled": true  // Optional - already default
    }
  }
}
```
✅ Works the same as without config

### Scenario 3: Disable if Needed
```json
{
  "verification": {
    "visualCapture": {
      "enabled": false  // Only way to disable
    }
  }
}
```
❌ Visual capture disabled

## What Gets Captured

By default, every verification automatically captures:

1. **UI State** - Screenshots of changed components
2. **Coverage Map** - Test coverage visualizations  
3. **Console Output** - Test results with formatting

## Browser Detection (Automatic)

The system automatically finds and uses available browser automation:

```
1. Check for browser-use skill
   └─> ~/browser-use/scripts/browser_controller.py
   
2. Check for agent-browser (CDP)
   └─> agent-browser command
   
3. Fallback to Playwright
   └─> Direct Playwright integration
   
4. None available
   └─> Skip visual capture silently
```

## Result Storage

Visual evidence is automatically attached to:

```typescript
// 1. Verification result
const result = await orchestrator.verify(plan, receipts);
result.visualEvidence = {
  artifacts: [...],        // Screenshots, coverage maps
  summary: {...},
  llmContext: "...",       // Formatted for LLM
};

// 2. Certificate
result.certificate.visualEvidence = [...];

// 3. Can be accessed later
orchestrator.getVisualEvidenceForLLM();
```

## Summary

| Aspect | Behavior |
|--------|----------|
| **Default State** | ✅ Always enabled |
| **Configuration Required** | ❌ None - works out of box |
| **File Detection** | ✅ Auto-detects from git |
| **Browser Selection** | ✅ Auto-detects available skills |
| **Trigger** | ✅ Every verification automatically |
| **Disable** | Only via explicit `enabled: false` |

## Example Flow

```bash
# User runs agent
$ gizzi

# Agent makes code changes
> Modified: src/Button.tsx
> Modified: src/Button.test.tsx

# Turn.execute() runs verification automatically
> Verification starting...

# Visual capture triggers automatically (no config needed)
> Capturing visual evidence...
>   - UI State: Button component screenshot
>   - Coverage Map: Button.test.tsx coverage
>   - Console Output: Test results

# LLM prompt includes visual context automatically
> LLM sees: "Button renders with red background ✓"
> LLM sees: "87% coverage, lines 45-52 uncovered"

# Result includes visual evidence
> Verification passed with visual evidence
```

**Zero configuration. Zero explicit calls. Always works.**
