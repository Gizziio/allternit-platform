# Visual Verification Integration Example

Complete examples for integrating visual evidence capture with Allternit Autoland.

## Scenario 1: Development Setup (File-Based Mode)

```typescript
// src/server/initialization.ts

import { 
  VisualCaptureManager,
  setVisualManagerForAutoland,
  configureVisualAutoland,
  initializeVisualAutoland,
  onWihClosed,
} from "@/runtime/verification";

import { Bus } from "@/shared/bus";

export async function initializeServer() {
  // 1. Create visual capture manager
  const visualManager = new VisualCaptureManager({
    outputDir: "./.verification/visual",
    enabledTypes: ["ui-state", "coverage-map", "console-output"],
  });

  // 2. Configure for file-based mode (development)
  setVisualManagerForAutoland(visualManager);
  
  configureVisualAutoland({
    enabled: true,
    mode: "file",  // File-based for development
    minConfidence: 0.6,  // Lower threshold for dev
    requiredTypes: ["console-output", "coverage-map"],
    timeoutSeconds: 120,  // More time for dev server
  });

  // 3. Initialize
  await initializeVisualAutoland();

  // 4. Listen for WIH events from Rust substrate
  // This would be via some event bridge (file, socket, etc.)
  setupWihEventListeners();
}

function setupWihEventListeners() {
  // Listen for WIH closed events
  // In production, this would come from Rust via events
  Bus.subscribe("WIHClosedSigned", async (event) => {
    if (event.properties.final_status === "PASS") {
      await onWihClosed(
        event.properties.wih_id,
        "PASS",
        { changedFiles: event.properties.changed_files }
      );
    }
  });
}
```

## Scenario 2: Production Setup (gRPC Mode)

```typescript
// src/server/initialization.production.ts

import { 
  VisualCaptureManager,
  setVisualManagerForAutoland,
  configureVisualAutoland,
  initializeVisualAutoland,
} from "@/runtime/verification";

export async function initializeProductionServer() {
  const visualManager = new VisualCaptureManager({
    outputDir: "./.verification/visual",
    enabledTypes: ["ui-state", "coverage-map", "console-output", "visual-diff"],
  });

  // Production configuration
  setVisualManagerForAutoland(visualManager);
  
  configureVisualAutoland({
    enabled: true,
    mode: "grpc",  // gRPC for production
    minConfidence: 0.8,  // Higher threshold
    requiredTypes: [
      "ui-state",
      "coverage-map", 
      "console-output",
      "visual-diff"
    ],
    timeoutSeconds: 30,  // Faster timeout
  });

  await initializeVisualAutoland();
  
  // gRPC server is now running on port 50051
  console.log("Visual verification gRPC server ready");
}
```

## Scenario 3: Manual Visual Capture (For Testing)

```typescript
// scripts/capture-visual-evidence.ts

import { 
  VisualCaptureManager,
  captureForWih,
  setVisualManagerForAutoland,
  configureVisualAutoland,
  initializeVisualAutoland,
  formatEvidenceForDisplay,
} from "@/runtime/verification";

async function main() {
  const wihId = process.argv[2];
  
  if (!wihId) {
    console.error("Usage: ts-node capture-visual-evidence.ts <wih-id>");
    process.exit(1);
  }

  // Setup
  const manager = new VisualCaptureManager();
  setVisualManagerForAutoland(manager);
  configureVisualAutoland({ enabled: true, mode: "file" });
  await initializeVisualAutoland();

  // Capture
  console.log(`Capturing evidence for WIH: ${wihId}...`);
  const evidence = await captureForWih(wihId, {
    changedFiles: ["src/components/Button.tsx"],
  });

  if (evidence) {
    console.log("\n" + formatEvidenceForDisplay(evidence));
    
    if (evidence.passed) {
      console.log("\n✅ Visual verification PASSED");
      process.exit(0);
    } else {
      console.log("\n❌ Visual verification FAILED");
      process.exit(1);
    }
  } else {
    console.error("Failed to capture evidence");
    process.exit(1);
  }
}

main();
```

## Scenario 4: Rust Substrate Integration

The Rust side needs to call the TypeScript preLandHook. Here's how:

### Option A: File-Based (Simplest)

```rust
// 0-substrate/src/gate/visual_verification.rs

use std::path::PathBuf;
use serde::{Deserialize, Serialize};
use tokio::time::{timeout, Duration};

#[derive(Debug, Deserialize)]
pub struct VisualEvidence {
    pub version: String,
    pub wih_id: String,
    pub success: bool,
    pub overall_confidence: f64,
    pub artifacts: Vec<Artifact>,
    pub errors: Vec<String>,
}

#[derive(Debug, Deserialize)]
pub struct Artifact {
    pub artifact_type: String,
    pub confidence: f64,
    pub description: String,
}

pub struct VisualVerificationClient {
    evidence_dir: PathBuf,
    max_wait_seconds: u64,
}

impl VisualVerificationClient {
    pub fn new(evidence_dir: PathBuf, max_wait_seconds: u64) -> Self {
        Self { evidence_dir, max_wait_seconds }
    }

    pub async fn check_visual_evidence(&self, wih_id: &str) -> Result<VisualCheckResult, VerificationError> {
        let evidence_path = self.evidence_dir.join(format!("{}.json", wih_id));
        let ready_path = self.evidence_dir.join(format!("{}.ready", wih_id));

        // Wait for ready file
        let wait_result = timeout(
            Duration::from_secs(self.max_wait_seconds),
            self.wait_for_ready(&ready_path)
        ).await;

        match wait_result {
            Ok(Ok(())) => {},
            Ok(Err(e)) => return Err(e),
            Err(_) => return Err(VerificationError::Timeout),
        }

        // Read evidence
        let evidence_json = tokio::fs::read_to_string(&evidence_path).await
            .map_err(|_| VerificationError::FileNotFound)?;
        
        let evidence: VisualEvidence = serde_json::from_str(&evidence_json)
            .map_err(|_| VerificationError::InvalidFormat)?;

        // Get policy from governance
        let policy = self.load_policy().await?;

        // Check requirements
        let passed = evidence.success 
            && evidence.overall_confidence >= policy.min_confidence
            && policy.required_types.iter().all(|req| {
                evidence.artifacts.iter().any(|a| &a.artifact_type == req)
            });

        Ok(VisualCheckResult {
            passed,
            confidence: evidence.overall_confidence,
            artifact_count: evidence.artifacts.len(),
            errors: if evidence.errors.is_empty() { None } else { Some(evidence.errors) },
        })
    }

    async fn wait_for_ready(&self, ready_path: &PathBuf) -> Result<(), VerificationError> {
        let poll_interval = Duration::from_millis(500);
        
        loop {
            if ready_path.exists() {
                // Small delay to ensure file write is complete
                tokio::time::sleep(Duration::from_millis(100)).await;
                return Ok(());
            }
            tokio::time::sleep(poll_interval).await;
        }
    }
}

// Usage in gate.rs:
pub async fn autoland_wih(&self, wih_id: &str, dry_run: bool, git_commit: bool) -> Result<AutolandResult> {
    // ... existing checks ...

    // NEW: Check visual verification
    let visual_client = VisualVerificationClient::new(
        self.root_dir.join(".allternit/evidence"),
        60,  // 60 second timeout
    );

    let visual_result = visual_client.check_visual_evidence(wih_id).await
        .map_err(|e| anyhow!("Visual verification check failed: {:?}", e))?;

    if !visual_result.passed {
        return Err(anyhow!(
            "Visual verification failed: {:.1}% confidence",
            visual_result.confidence * 100.0
        ));
    }

    tracing::info!(
        "Visual verification passed: {:.1}% confidence, {} artifacts",
        visual_result.confidence * 100.0,
        visual_result.artifact_count
    );

    // ... proceed with landing ...
}
```

### Option B: gRPC Client

```rust
// 0-substrate/src/verification/grpc_client.rs

use tonic::{transport::Channel, Request};

pub mod verification {
    tonic::include_proto!("verification");
}

use verification::{
    verification_provider_client::VerificationProviderClient,
    EvidenceRequest,
};

pub struct GrpcVisualClient {
    client: VerificationProviderClient<Channel>,
    timeout_seconds: u64,
}

impl GrpcVisualClient {
    pub async fn connect(endpoint: &str) -> Result<Self, Box<dyn std::error::Error>> {
        let client = VerificationProviderClient::connect(endpoint.to_string()).await?;
        
        Ok(Self {
            client,
            timeout_seconds: 30,
        })
    }

    pub async fn gather_evidence(&mut self, wih_id: &str) -> Result<VisualEvidence, VerificationError> {
        let request = Request::new(EvidenceRequest {
            wih_id: wih_id.to_string(),
            timeout_ms: self.timeout_seconds * 1000,
            ..Default::default()
        });

        let response = self.client
            .gather_evidence(request)
            .await
            .map_err(|e| VerificationError::GrpcError(e.to_string()))?;

        let evidence = response.into_inner();

        Ok(VisualEvidence {
            success: evidence.success,
            confidence: evidence.overall_confidence,
            artifacts: evidence.artifacts.len(),
        })
    }
}
```

## Scenario 5: SessionProcessor Integration

```typescript
// src/runtime/session/processor-visual.ts

import { 
  SessionProcessorVisualAdapter,
  VisualCaptureManager,
} from "@/runtime/verification";
import { SessionProcessor } from "@/runtime/session/processor";

export function createVisualEnabledProcessor(
  baseProcessor: SessionProcessor,
): SessionProcessor {
  const visualManager = new VisualCaptureManager();
  
  const visualAdapter = new SessionProcessorVisualAdapter({
    manager: visualManager,
    autoCapture: true,
    waitForDevServer: true,
    serverTimeout: 30000,
  });

  // Wrap the processor
  const originalProcess = baseProcessor.process.bind(baseProcessor);
  
  baseProcessor.process = async (input) => {
    // Capture before processing
    const patches = extractPatchesFromInput(input);
    
    if (visualAdapter.shouldCapture(patches)) {
      const visualContext = await visualAdapter.captureIfNeeded(
        input.sessionID,
        patches
      );
      
      // Enhance input with visual evidence
      input.visualEvidence = visualContext.evidence;
    }

    return originalProcess(input);
  };

  return baseProcessor;
}
```

## Scenario 6: Testing

```typescript
// tests/visual-autoland.test.ts

import {
  configureVisualAutoland,
  captureForWih,
  checkWihVisualStatus,
  preLandHook,
  setVisualManagerForAutoland,
  initializeVisualAutoland,
} from "@/runtime/verification";

describe("Visual Autoland Integration", () => {
  beforeAll(async () => {
    const manager = new VisualCaptureManager();
    setVisualManagerForAutoland(manager);
    
    configureVisualAutoland({
      enabled: true,
      mode: "file",
      minConfidence: 0.7,
    });
    
    await initializeVisualAutoland();
  });

  test("should capture evidence for WIH", async () => {
    const wihId = "test_wih_123";
    
    const evidence = await captureForWih(wihId, {
      changedFiles: ["test.tsx"],
    });

    expect(evidence).toBeDefined();
    expect(evidence?.wihId).toBe(wihId);
    expect(evidence?.confidence).toBeGreaterThanOrEqual(0);
  });

  test("should pass visual check when confidence is high", async () => {
    const wihId = "test_wih_high_confidence";
    
    // Mock high confidence evidence
    await captureForWih(wihId);
    
    const status = checkWihVisualStatus(wihId);
    
    expect(status.allowed).toBe(true);
    expect(status.evidence).toBeDefined();
  });

  test("preLandHook should allow landing when evidence passes", async () => {
    const wihId = "test_wih_land";
    
    await captureForWih(wihId);
    const result = await preLandHook(wihId);
    
    expect(result.allowed).toBe(true);
    expect(result.confidence).toBeGreaterThanOrEqual(0);
  });
});
```

## Configuration Reference

### File-Based Mode (Development)

```typescript
configureVisualAutoland({
  enabled: true,
  mode: "file",
  minConfidence: 0.6,
  requireForUIChanges: true,
  requiredTypes: ["console-output"],
  timeoutSeconds: 120,
});
```

**Characteristics:**
- Simple, no network dependencies
- Good for development/debugging
- Evidence files in `.allternit/evidence/`
- Slower (polling-based)

### gRPC Mode (Production)

```typescript
configureVisualAutoland({
  enabled: true,
  mode: "grpc",
  minConfidence: 0.8,
  requireForUIChanges: true,
  requiredTypes: ["ui-state", "coverage-map", "console-output", "visual-diff"],
  timeoutSeconds: 30,
});
```

**Characteristics:**
- Fast, synchronous calls
- Production-grade performance
- Requires gRPC server running
- Type-safe contracts

### Auto Mode (Adaptive)

```typescript
configureVisualAutoland({
  enabled: true,
  mode: "auto",  // Tries gRPC, falls back to file
  fallbackToFile: true,
});
```

**Characteristics:**
- Automatically selects best available mode
- Graceful degradation
- Good for mixed environments
