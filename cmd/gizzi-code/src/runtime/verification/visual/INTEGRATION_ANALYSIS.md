# Visual Evidence + Allternit Autoland: Integration Analysis

## Executive Summary

**Current State:** Two systems exist but are NOT fully integrated. The visual evidence capture system (TypeScript/gizzi-code) and Allternit Autoland (Rust/0-substrate) operate independently.

**Gap:** The Rust autoland gate does NOT currently check visual verification before landing changes. The TypeScript adapter is ready but lacks a connection mechanism to the Rust substrate.

---

## System Architecture

### 1. Visual Evidence Capture System (TypeScript)

**Location:** `cmd/gizzi-code/src/runtime/verification/visual/`

**Components:**
```
VisualCaptureManager
├── BrowserAdapter (browser-use → agent-browser → Playwright)
├── CoverageMapProvider
├── ConsoleOutputProvider
├── UIStateProvider
├── VisualDiffProvider
└── ErrorStateProvider

Integration Points:
├── Turn/AgentLoop (via VerificationOrchestrator)
├── SessionProcessor (via SessionProcessorVisualAdapter)
└── Allternit Autoland (via autoland-adapter.ts) ← NOT CONNECTED
```

**Usage Patterns:**
1. **Automatic** - Turn.execute() always captures visual evidence
2. **On-Demand** - SessionProcessor can capture via adapter
3. **Pre-Land** - Ready for autoland integration (not connected)

### 2. Allternit Autoland System (Rust)

**Location:** `0-substrate/allternit-agent-system-rails/src/gate/gate.rs`

**Components:**
```
Gate
├── autoland_wih(wih_id, dry_run, git_commit)
│   ├── Check WIH has PASS status
│   ├── Calculate file impact (modified/added/deleted)
│   ├── Backup files to .allternit/backups/
│   ├── Copy files from .allternit/runner/{wih_id}/ to root
│   ├── Emit GateAutolanded event
│   └── Optional: git commit
│
└── wih_close(wih_id, status, evidence_refs)
    ├── Emit WIHCloseRequested
    ├── Emit WIHClosedSigned { final_status: status }
    ├── Emit DagNodeStatusChanged
    └── If status == PASS && autoland_on_pass:
        └── Call autoland_wih() ← NO VISUAL CHECK
```

**Current Landing Gate (Rust):**
```rust
pub async fn autoland_wih(&self, wih_id: &str, dry_run: bool, git_commit: bool) -> Result<AutolandResult> {
    // 1. Check policy scope
    // 2. Check WIH has PASS status ← ONLY VALIDATION
    // 3. Calculate impact
    // 4. Copy files
    // 5. Emit events
}
```

---

## Integration Status: GAP ANALYSIS

### ❌ CRITICAL GAP 1: No Visual Pre-Check in Rust Gate

**Problem:** The Rust `autoland_wih` function does not check visual evidence before landing.

**Current Flow:**
```
WIHClosedSigned { status: "PASS" }
         ↓
autoland_on_pass == true
         ↓
autoland_wih() ← NO VISUAL CHECK
         ↓
Files copied to root
```

**Required Flow:**
```
WIHClosedSigned { status: "PASS" }
         ↓
Visual Evidence Capture ← MISSING
         ↓
Confidence >= threshold ← MISSING
         ↓
autoland_wih()
         ↓
Files copied to root
```

### ❌ CRITICAL GAP 2: No IPC/Bridge Between Rust ↔ TypeScript

**Problem:** The TypeScript `preLandHook()` is ready but Rust cannot call it.

**TypeScript Side (Ready):**
```typescript
// autoland-adapter.ts
export async function preLandHook(wihId: string): Promise<{ allowed: boolean; reason?: string }> {
  const evidence = wihEvidence.get(wihId);
  if (!evidence?.passed) {
    return { allowed: false, reason: "Visual verification failed" };
  }
  return { allowed: true };
}
```

**Rust Side (Not Connected):**
```rust
// gate.rs
pub async fn autoland_wih(&self, wih_id: &str, ...) -> Result<AutolandResult> {
    // TODO: Call TypeScript preLandHook
    // No mechanism exists to do this
}
```

### ⚠️ GAP 3: Different Event Systems

**Rust Events:** Emitted to Ledger (internal event store)
**TypeScript Events:** BusEvents (in-memory pub/sub)

**No Event Bridge:** TypeScript cannot reliably listen to Rust events in real-time.

### ⚠️ GAP 4: Timing Issues

**Current Autoland Flow (Rust):**
```rust
// wih_close()
if status == "PASS" && autoland_on_pass {
    // Triggers immediately
    self.autoland_wih(wih_id, false, false).await?;
}
```

**Problem:** Visual capture takes time (5-30 seconds). The autonomous loop triggers autoland immediately after WIH close, leaving no time for visual capture.

---

## Determinism Analysis

### Visual Evidence Capture: NOT Fully Deterministic

**Deterministic Elements:**
- Same code changes → Same files detected
- Same browser skill → Same rendering engine
- Same viewport → Same screenshot dimensions

**Non-Deterministic Elements:**
- Dev server state (may be starting/stopping)
- Browser rendering timing (fonts, animations)
- Network state (console logs may vary)
- Screenshot pixel differences (antialiasing)

**Result:** Two runs with identical code may produce slightly different confidence scores.

### Allternit Autoland: Deterministic

**Deterministic Elements:**
- PASS/FAIL check is binary
- File copy operations are deterministic
- Backup creation is deterministic

**Result:** Same WIH state → Same landing outcome.

### Combined System: Non-Deterministic

**Issue:** Visual capture non-determinism could cause:
- Flaky autoland blocking (confidence 69% vs 70%)
- Inconsistent landing decisions
- Agent confusion ("why did my change not land?")

**Mitigation:**
- Use confidence threshold with hysteresis (e.g., require 75% instead of 70%)
- Allow retries for visual capture failures
- Cache visual evidence to avoid re-capturing

---

## Usage Patterns Comparison

### Visual Capture System

| Path | Trigger | Configurable | Result |
|------|---------|--------------|--------|
| Turn.execute() | Always | visualCapture.enabled | Attached to TurnResult |
| SessionProcessor | Optional | autoCapture | Injected into LLM context |
| Autoland (ready) | On WIH PASS | minConfidence | Blocking gate (not connected) |

### Allternit Autoland System

| Path | Trigger | Configurable | Result |
|------|---------|--------------|--------|
| Manual CLI | `a2 autoland land <wih>` | dry_run, git_commit | Files landed |
| Autonomous | `autoland_on_pass: true` | git_commit | Files landed |

**Problem:** Visual capture is NOT triggered by autoland paths.

---

## Recommended Integration Architecture

### Option 1: Event-Driven Integration (Recommended)

**Changes Needed:**

1. **Rust Side:** Emit `VisualVerificationRequested` event before autoland
```rust
// In gate.rs wih_close()
if status == "PASS" && autoland_on_pass {
    // Emit event for TypeScript to capture
    self.emit(AllternitEvent {
        r#type: "VisualVerificationRequested",
        payload: json!({ "wih_id": wih_id, "timeout_ms": 30000 }),
    }).await?;
    
    // Wait for TypeScript to emit VisualVerificationCompleted
    // Then proceed with autoland
}
```

2. **TypeScript Side:** Listen and respond
```typescript
Bus.subscribe("VisualVerificationRequested", async (event) => {
  const evidence = await captureForWih(event.wih_id);
  
  // Write result to file that Rust polls
  await fs.writeJson(`.allternit/visual-results/${event.wih_id}.json`, {
    passed: evidence.passed,
    confidence: evidence.confidence,
  });
});
```

3. **Rust Side:** Poll for result
```rust
// Wait for visual result file
let visual_result = wait_for_visual_result(wih_id, timeout).await?;
if !visual_result.passed {
    return Err(anyhow!("Visual verification failed"));
}
```

**Pros:**
- No direct Rust↔TypeScript coupling
- Uses existing event system
- Can be made deterministic with retries

**Cons:**
- Adds latency to autoland
- Requires file-based coordination

### Option 2: Direct IPC Integration

**Changes Needed:**

1. **Rust Side:** Call TypeScript via gRPC/HTTP
```rust
// In gate.rs
let visual_check = http_client
    .post("http://localhost:PORT/visual/preland")
    .json(json!({ "wihId": wih_id }))
    .send()
    .await?;

if !visual_check.json().allowed {
    return Err(anyhow!("Visual verification failed"));
}
```

2. **TypeScript Side:** HTTP server endpoint
```typescript
app.post("/visual/preland", async (req, res) => {
  const result = await preLandHook(req.body.wihId);
  res.json(result);
});
```

**Pros:**
- Direct, synchronous check
- Fast response

**Cons:**
- Requires running TypeScript server
- Tight coupling
- More complex error handling

### Option 3: File-Based Coordination (Simplest)

**Changes Needed:**

1. **TypeScript Side:** Listen for WIHClosedSigned
```typescript
Bus.subscribe("WIHClosedSigned", async (event) => {
  if (event.properties.final_status === "PASS") {
    const evidence = await captureForWih(event.properties.wih_id);
    
    // Write visual gate file
    await fs.writeJson(
      `.allternit/visual-gates/${event.properties.wih_id}.json`,
      {
        wih_id: event.properties.wih_id,
        passed: evidence.passed,
        confidence: evidence.confidence,
        timestamp: Date.now(),
      }
    );
  }
});
```

2. **Rust Side:** Check file before autoland
```rust
pub async fn autoland_wih(&self, wih_id: &str, ...) -> Result<AutolandResult> {
    // Check for visual gate file
    let gate_path = self.root_dir
        .join(".allternit")
        .join("visual-gates")
        .join(format!("{}.json", wih_id));
    
    if gate_path.exists() {
        let gate: VisualGate = serde_json::from_str(
            &fs::read_to_string(&gate_path)?
        )?;
        
        if !gate.passed {
            return Err(anyhow!(
                "Visual verification failed: {}% confidence",
                gate.confidence * 100.0
            ));
        }
    } else if config.visual_required {
        return Err(anyhow!("Visual verification not found for WIH"));
    }
    
    // Continue with landing...
}
```

**Pros:**
- Simple file-based coordination
- No network dependencies
- Easy to debug

**Cons:**
- File polling needed
- Race conditions possible

---

## Implementation Priority

### P0 (Critical) - Blocking
1. **Add visual check to Rust autoland gate** - Without this, visual capture doesn't gate landing
2. **Define Rust↔TypeScript bridge** - File-based or event-based

### P1 (High) - Required for Production
3. **Add retry logic for visual capture** - Handle dev server startup time
4. **Cache visual evidence** - Avoid re-capturing for same WIH
5. **Add metrics/logging** - Track visual verification success rates

### P2 (Medium) - Nice to Have
6. **Make visual capture deterministic** - Fixed viewport, stable dev server
7. **Parallel capture** - Capture multiple artifact types concurrently
8. **UI for visual results** - Show visual verification in ShellUI

---

## Current State Summary

| Component | Status | Connected to Autoland |
|-----------|--------|----------------------|
| Visual Capture System | ✅ Ready | ❌ No |
| Autoland Adapter | ✅ Ready | ❌ No |
| Rust Gate | ✅ Ready | ❌ No visual check |
| Event Bridge | ❌ Missing | - |
| File Bridge | ❌ Missing | - |
| IPC Bridge | ❌ Missing | - |

**Bottom Line:** Both systems are built but NOT connected. The Rust autoland gate needs to be modified to check visual evidence, and a bridge mechanism (events, files, or IPC) needs to be implemented.
