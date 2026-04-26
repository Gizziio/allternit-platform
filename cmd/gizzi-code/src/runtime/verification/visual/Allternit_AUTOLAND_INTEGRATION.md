# Visual Evidence + Allternit Autoland Integration

## Overview

This document describes how the **Visual Evidence Capture System** integrates with the existing **Allternit Autoland Protocol** (Rust-based gate system in `0-substrate`).

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                     EXISTING Allternit AUTOLAND SYSTEM                             │
│                         (0-substrate Rust)                                   │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  WIH (Work Identity Handle)                                                  │
│     │                                                                        │
│     ├── Phase 1: Planning (.allternit/runner/{wih_id}/)                           │
│     ├── Phase 2: Execution (agent works in sandbox)                         │
│     ├── Phase 3: Validation (WIHClosedSigned with PASS/FAIL)                │
│     ├── Phase 4: LANDING GATE ───────────────────────┐                      │
│     │            (autoland_wih in gate.rs)           │                      │
│     └── Phase 5: Rollback (if needed)                │                      │
│                                                      │                      │
└──────────────────────────────────────────────────────┼──────────────────────┘
                                                       │
                    NEW INTEGRATION LAYER              │
                  (gizzi-code TypeScript)              │
                                                       │
┌──────────────────────────────────────────────────────┼──────────────────────┐
│              VISUAL EVIDENCE PRE-GATE                │                      │
│         (autoland-adapter.ts)                        │                      │
│                                                      ▼                      │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  1. WIH completes with PASS status                                  │   │
│  │     │                                                               │   │
│  │     ▼                                                               │   │
│  │  2. Visual Evidence Capture (captureForWih)                         │   │
│  │     ├─ UI State Screenshot                                          │   │
│  │     ├─ Coverage Map                                                 │   │
│  │     ├─ Console Output (errors/warnings)                             │   │
│  │     └─ Visual Diff (if applicable)                                  │   │
│  │     │                                                               │   │
│  │     ▼                                                               │   │
│  │  3. Confidence Calculation                                          │   │
│  │     avgConfidence = mean(artifact.confidences)                      │   │
│  │     passed = success && confidence >= minConfidence                │   │
│  │     │                                                               │   │
│  │     ▼                                                               │   │
│  │  4. Pre-Land Hook (preLandHook)                                     │   │
│  │     ├─ Check visual evidence exists                                 │   │
│  │     ├─ Verify confidence threshold                                  │   │
│  │     └─ Return { allowed: boolean, reason? }                        │   │
│  │     │                                                               │   │
│  │     ▼                                                               │   │
│  │  5. Gate Decision                                                   │   │
│  │     ├─ If visual NOT passed → Block landing                        │   │
│  │     └─ If visual passed → Allow Rust gate to proceed               │   │
│  │                      │                                              │   │
│  └──────────────────────┼──────────────────────────────────────────────┘   │
│                         │                                                   │
│                         ▼                                                   │
│              Rust Autoland Gate (gate.rs)                                   │
│     ┌──────────────────────────────────────────────────┐                   │
│     │ 6. Has WIH PASS status?                          │                   │
│     │ 7. Backup files to .allternit/backups/                 │                   │
│     │ 8. Copy from .allternit/runner/{wih_id}/ to root      │                   │
│     │ 9. Optional: git commit                          │                   │
│     │ 10. Emit GateAutolanded event                    │                   │
│     └──────────────────────────────────────────────────┘                   │
│                         │                                                   │
│                         ▼                                                   │
│              Post-Land Hook (postLandHook)                                  │
│     ├─ Log success with visual evidence metadata                            │
│     └─ Archive/cleanup evidence                                             │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Integration Points

### 1. Pre-Land Hook (TypeScript → Rust)

The TypeScript adapter provides a `preLandHook` that the Rust gate should call before allowing landing:

```rust
// In gate.rs (existing code)
pub async fn autoland_wih(&self, wih_id: &str, dry_run: bool, git_commit: bool) -> Result<AutolandResult> {
    // ... existing checks (PASS status, etc.) ...
    
    // NEW: Call TypeScript pre-land hook for visual verification
    let visual_check = call_visual_pre_land_hook(wih_id).await?;
    if !visual_check.allowed {
        return Err(anyhow!("Visual verification failed: {}", visual_check.reason));
    }
    
    // ... proceed with landing ...
}
```

### 2. WIH Evidence Capture

When a WIH completes with PASS status:

```typescript
import { captureForWih } from "@/runtime/verification/visual/integration";

// After WIH closes with PASS
const evidence = await captureForWih(wihId, {
  sessionId: sessionId,
  changedFiles: ["src/components/Button.tsx"],
});

// evidence.passed determines if landing is allowed
// evidence.confidence shows the quality score
```

### 3. Configuration

```typescript
import { configureVisualAutoland, setVisualManagerForAutoland } from "@/runtime/verification/visual/integration";
import { VisualCaptureManager } from "@/runtime/verification/visual";

// Set up visual manager
const visualManager = new VisualCaptureManager();
setVisualManagerForAutoland(visualManager);

// Configure
configureVisualAutoland({
  enabled: true,
  minConfidence: 0.7,        // 70% confidence required
  requireForUIChanges: true, // Only require for UI files
  requiredTypes: ["console-output", "coverage-map", "ui-state"],
  autoCapture: true,         // Auto-capture on WIH completion
});
```

## Usage Flow

### Complete Example

```typescript
// 1. Initialize visual capture
import { VisualCaptureManager } from "@/runtime/verification/visual";
const visualManager = new VisualCaptureManager();

// 2. Configure autoland integration
import { 
  configureVisualAutoland, 
  setVisualManagerForAutoland,
  initializeVisualAutoland 
} from "@/runtime/verification/visual/integration";

setVisualManagerForAutoland(visualManager);
configureVisualAutoland({
  enabled: true,
  minConfidence: 0.8,
  autoCapture: true,
});
initializeVisualAutoland();

// 3. When WIH completes (this would be triggered by Rust substrate events)
import { captureForWih, checkWihVisualStatus } from "@/runtime/verification/visual/integration";

async function onWihCompleted(wihId: string) {
  // Capture visual evidence
  const evidence = await captureForWih(wihId, {
    changedFiles: detectChangedFiles(wihId),
  });
  
  if (!evidence?.passed) {
    console.error("Visual verification failed, blocking autoland");
    return;
  }
  
  // Now the Rust gate can proceed with landing
  // The preLandHook will return { allowed: true }
}

// 4. Rust gate calls preLandHook before landing
// This is called from the Rust side via some IPC/bridge
async function rustCallsPreLandHook(wihId: string) {
  const { preLandHook } = await import("@/runtime/verification/visual/integration");
  return await preLandHook(wihId);
  // Returns: { allowed: true } or { allowed: false, reason: "..." }
}
```

## API Reference

### `captureForWih(wihId, options)`

Captures visual evidence for a WIH before autoland.

```typescript
const evidence = await captureForWih(wihId, {
  sessionId?: string,      // Optional session ID
  changedFiles?: string[], // Files that changed
  timeout?: number,        // Capture timeout (ms)
});

// Returns: WihVisualEvidence | null
// {
//   wihId: string;
//   sessionId?: string;
//   capturedAt: number;
//   result: DeterministicCaptureResult;
//   passed: boolean;
//   confidence: number;
// }
```

### `checkWihVisualStatus(wihId)`

Checks if a WIH has passed visual verification.

```typescript
const status = checkWihVisualStatus(wihId);
// Returns: { allowed: boolean; reason?: string; evidence?: WihVisualEvidence }
```

### `preLandHook(wihId)`

Pre-land hook called by the autoland gate.

```typescript
const result = await preLandHook(wihId);
// Returns: { allowed: boolean; reason?: string }
```

### `postLandHook(wihId, result)`

Post-land hook called after successful landing.

```typescript
await postLandHook(wihId, { 
  success: true, 
  commitSha: "abc123" 
});
```

## Quality Gates

### Default Thresholds

| Metric | Threshold | Description |
|--------|-----------|-------------|
| Confidence | ≥ 70% | Average confidence across all artifacts |
| Console Errors | 0 | No critical errors in console output |
| Coverage | Present | Coverage map must be captured |

### Custom Gates

```typescript
configureVisualAutoland({
  minConfidence: 0.9,              // Require 90% confidence
  requiredTypes: [                 // Require specific capture types
    "ui-state",
    "coverage-map", 
    "console-output",
    "visual-diff"
  ],
});
```

## Event Flow

```
Rust Substrate (0-substrate)
│
├─ WIHCreated
├─ WIHPickedUp
├─ WIHOpenSigned
├─ ReceiptWritten (tool executions)
├─ WIHClosedSigned { final_status: "PASS" }
│   │
│   ▼
│   TypeScript Bridge (event listener)
│   ├─ captureForWih(wihId)
│   ├─ Calculate confidence
│   └─ Store evidence
│
├─ GateAutolandRequested ───────────┐
│                                    │
│   TypeScript preLandHook(wihId)    │
│   ├─ Check evidence                │
│   ├─ Verify confidence             │
│   └─ Return { allowed }            │
│                                    ▼
├─ GateAutolanded (if allowed)
│   ├─ Backup files
│   ├─ Copy to root
│   └─ Optional: git commit
│
│   TypeScript postLandHook(wihId, result)
│   └─ Log success
```

## Error Handling

### Visual Capture Fails

If visual capture fails (e.g., dev server not running):
- If `autoCapture: true`: Landing is blocked until capture succeeds
- If `autoCapture: false`: Landing proceeds without visual evidence

### Confidence Below Threshold

If confidence is below `minConfidence`:
- Landing is blocked
- Reason: "Visual verification failed: X% confidence below Y% threshold"
- Evidence is preserved for inspection

### Missing Required Types

If required capture types are missing:
- Landing is blocked
- Reason: "Missing required visual evidence: [types]"

## Integration with Rust

### Option 1: gRPC/IPC Bridge (Recommended)

The Rust substrate calls the TypeScript adapter via IPC:

```rust
// In gate.rs
async fn call_visual_pre_land_hook(wih_id: &str) -> Result<VisualCheckResult> {
    let response = ipc_client
        .call("visual_autoland", "preLandHook", json!({ "wihId": wih_id }))
        .await?;
    
    Ok(VisualCheckResult {
        allowed: response.allowed,
        reason: response.reason,
    })
}
```

### Option 2: File-Based

Rust writes a request file, TypeScript polls and responds:

```rust
// Rust writes
std::fs::write(
    ".allternit/visual-checks/{wih_id}.req",
    json!({ "action": "preLand", "wihId": wih_id })
)?;

// TypeScript responds by writing .res file
```

### Option 3: Event-Based

TypeScript listens to Rust events via the existing Bus system:

```typescript
// TypeScript listens for WIH events
Bus.subscribe("WIHClosedSigned", async (event) => {
  if (event.properties.final_status === "PASS") {
    await captureForWih(event.properties.wih_id);
  }
});
```

## Testing

```typescript
// Test visual pre-land hook
const result = await preLandHook("wih_test_123");
console.assert(result.allowed === true || result.reason !== undefined);

// Test evidence capture
const evidence = await captureForWih("wih_test_123", {
  changedFiles: ["test.tsx"],
});
console.assert(evidence !== null);
console.assert(evidence!.confidence >= 0);

// Test status check
const status = checkWihVisualStatus("wih_test_123");
console.assert(status.allowed === evidence!.passed);
```

## Summary

This integration adds **visual quality gates** to the existing Allternit Autoland protocol:

1. **Before Landing**: Visual evidence is captured and verified
2. **During Landing**: Rust gate checks TypeScript preLandHook
3. **After Landing**: Evidence is archived for audit

The existing Rust autoland system remains unchanged - this adapter provides an additional layer of verification that runs in the gizzi-code TypeScript runtime.
