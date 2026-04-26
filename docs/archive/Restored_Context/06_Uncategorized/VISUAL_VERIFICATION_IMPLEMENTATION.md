# Visual Verification System - Implementation Summary

## Overview

A comprehensive visual verification system for the Allternit Autoland pipeline that
captures UI evidence, calculates confidence scores, and enforces quality gates
before code lands in production.

---

## Architecture

### Three-Layer Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│ LAYER 2: GOVERNANCE                                             │
│  • VisualVerificationPolicy (JSON-configurable)                 │
│  • Environment presets (dev/staging/prod)                       │
│  • Bypass approval workflow                                     │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ LAYER 0: SUBSTRATE (Rust)                                       │
│  • Provider trait: FileBased, Grpc                              │
│  • autoland_wih() calls verify_visual()                         │
│  • Events: GateVisualVerified, GateAutolanded                   │
│  • Metrics: latency, confidence, failures                       │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ LAYER 1: KERNEL (TypeScript)                                    │
│  • VerificationService (gRPC + file modes)                      │
│  • Capture providers (5 artifact types)                         │
│  • Parallel capture with retry logic                            │
│  • Confidence history tracking                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Evidence Flow

```
WIH Closed
    │
    ▼
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│ TypeScript   │────▶│   Evidence   │────▶│ Rust Gate    │
│ captureForWih│     │  (file/gRPC) │     │ verify_visual│
└──────────────┘     └──────────────┘     └──────────────┘
                                                  │
                    ┌─────────────────────────────┼─────────┐
                    │                             ▼         │
                    │                    ┌──────────────┐  │
                    │         Confidence < Threshold?   │  │
                    │                    └──────────────┘  │
                    │                           │          │
                    ▼                    YES    │    NO    ▼
           GateAutolandFailed                   │   GateVisualVerified
                                                │          │
                                                ▼          ▼
                                            autoland_wih() proceeds
```

---

## Components

### 1. Rust Substrate (Layer 0)

| File | Purpose |
|------|---------|
| `types.rs` | Core types: `VerificationProvider` trait, `Evidence`, `Artifact` |
| `providers/file.rs` | File-based provider (polling, dev mode) |
| `providers/grpc.rs` | gRPC provider (production, synchronous) |
| `gate.rs` | `autoland_wih()` integration with visual verification |
| `metrics.rs` | Prometheus metrics for observability |

### 2. TypeScript Kernel (Layer 1)

| File | Purpose |
|------|---------|
| `types.ts` | Shared TypeScript types |
| `verification-service.ts` | Dual-mode service (file writer + gRPC server) |
| `capture.ts` | Main capture orchestrator with 5 artifact types |
| `capture-*.ts` | Individual capture providers |
| `parallel-capture.ts` | Concurrent capture with batching |
| `retry.ts` | Exponential backoff retry logic |
| `confidence.ts` | Confidence calculation algorithms |
| `grpc-server.ts` | Production gRPC server |

### 3. Governance (Layer 2)

| File | Purpose |
|------|---------|
| `visual_verification.rs` | Policy definition with environment presets |
| `visual-verification-quickstart.md` | Team runbook |
| `incident-response-visual-verification.md` | Incident response playbook |

### 4. Protocol

| File | Purpose |
|------|---------|
| `verification.proto` | gRPC contract between Rust and TypeScript |

### 5. CI/CD

| File | Purpose |
|------|---------|
| `visual-verification.yml` | GitHub Actions workflow for PR verification |

---

## Artifact Types

| Type | Description | Capture Method | Confidence Factor |
|------|-------------|----------------|-------------------|
| `UiState` | Full page screenshot | Playwright | Layout completeness |
| `CoverageMap` | Code coverage visualization | Istanbul/nyc | Coverage % |
| `ConsoleOutput` | Browser console logs | CDP | Error/warning count |
| `VisualDiff` | Screenshot comparison | Pixelmatch | Diff % |
| `ErrorState` | Error boundaries, 404s | DOM query | Error presence |

---

## Provider Modes

### File-Based Mode (Development)
```
TypeScript ──write──▶ evidence/{wih_id}.json
                               ▲
Rust ────────poll────┘
```
- **Pros**: Simple, no dependencies, easy to debug
- **Cons**: Polling latency, eventual consistency
- **Use**: Local development, debugging

### gRPC Mode (Production)
```
Rust ───────call────▶ gRPC Server ──▶ TypeScript capture
       gather_evidence         (synchronous)
```
- **Pros**: Synchronous, low latency, type-safe
- **Cons**: Requires running server
- **Use**: Production, CI/CD

### Auto-Mode with Fallback
```
1. Try gRPC
2. If unavailable, fall back to file-based
3. Log fallback event
```

---

## Confidence Scoring

### Algorithm

```rust
overall_confidence = Σ(artifact.confidence × weight) / Σ(weights)
```

### Default Weights

| Artifact | Weight |
|----------|--------|
| UiState | 0.30 |
| CoverageMap | 0.25 |
| ConsoleOutput | 0.25 |
| VisualDiff | 0.15 |
| ErrorState | 0.05 |

### Thresholds by Environment

| Environment | Min Confidence | Required Artifacts |
|-------------|---------------|-------------------|
| Development | 0.60 | UiState, ConsoleOutput |
| Staging | 0.75 | All except VisualDiff |
| Production | 0.80 | All 5 types |

---

## Events & Metrics

### Events

| Event | When | Fields |
|-------|------|--------|
| `GateVisualVerified` | Verification passed | wih_id, confidence, artifacts |
| `GateAutolanded` | Successful autoland | wih_id, duration, evidence_id |
| `GateAutolandFailed` | Verification failed | wih_id, reason, confidence |
| `GateBypassApproved` | Emergency bypass | wih_id, approver, reason |

### Prometheus Metrics

```
visual_verification_latency_seconds{quantile="0.99"}
visual_verification_confidence
visual_verification_failures_total{reason="timeout|error|threshold"}
visual_verification_artifacts_captured_total{type="ui_state"}
```

---

## Retry Logic

```typescript
withRetry(captureArtifact, {
  maxAttempts: 3,
  baseDelay: 1000,      // 1 second
  maxDelay: 10000,      // 10 seconds
  backoffMultiplier: 2, // exponential
  jitter: true          // prevent thundering herd
})
```

### Retryable Errors
- Network timeouts
- Browser not available
- Temporary resource exhaustion

### Non-Retryable Errors
- Invalid WIH ID
- Policy violations
- Permission denied

---

## Performance

### Parallel Capture
- **Max concurrency**: 3 simultaneous captures
- **Batch processing**: Chunked to limit resource usage
- **Per-artifact timeout**: 10-15 seconds
- **Total timeout**: 60 seconds (configurable)

### Benchmarks (Target)

| Scenario | Target Latency |
|----------|---------------|
| Single artifact | < 5s |
| All 5 artifacts (parallel) | < 15s |
| With retries (worst case) | < 45s |

---

## Security

### Bypass Approval
```rust
// Requires authorized approver
can_bypass(&self, approver: &str) -> bool {
    self.allow_bypass_with_approval &&
    self.bypass_approvers.contains(approver)
}
```

### Audit Trail
All verification events are persisted to:
- Structured event log (JSONL)
- Prometheus metrics
- Optional: External SIEM

---

## Deployment

### Development Setup
```bash
# Start verification server
cd cmd/gizzi-code
npm run verify:server

# Configure for file mode
export VERIFICATION_MODE=file
```

### Production Setup
```bash
# Deploy gRPC server
kubectl apply -f k8s/verification-server.yaml

# Configure substrate
export VERIFICATION_MODE=grpc
export VERIFICATION_GRPC_HOST=verification-server
```

### Health Checks
```bash
# gRPC health
curl http://localhost:50052/health

# Substrate provider status
allternit provider-status verification
```

---

## Troubleshooting

### Low Confidence Diagnosis

```bash
# Check individual artifact scores
allternit verify-visual --wih-id <id> --diagnose

# Expected output:
# ✓ UI State: 0.95 confidence
# ✓ Coverage Map: 0.88 confidence
# ⚠ Console Output: 0.45 confidence (warnings: 3)
# ✗ Visual Diff: 0.30 confidence (diff: 45%)
```

### Common Issues

| Symptom | Cause | Fix |
|---------|-------|-----|
| All WIHs failing | gRPC server down | Restart server or switch to file mode |
| Timeouts | Slow browser init | Increase timeout, check resources |
| Low confidence | Console errors | Fix JS errors, increase threshold |
| Missing artifacts | Browser not found | Install Playwright: `npx playwright install` |

---

## Future Enhancements

1. **ML-Based Confidence**: Train model on historical pass/fail data
2. **Smart Baselines**: Auto-update screenshot baselines for intentional changes
3. **Visual Regression Dashboard**: Web UI for reviewing diffs
4. **Flaky Test Detection**: Track artifact-level consistency
5. **Cross-Browser Capture**: Chrome, Firefox, Safari evidence

---

## Files Created

### Rust (infrastructure)
```
allternit-agent-system-rails/src/verification/
├── types.rs                      # Core types and provider trait
├── lib.rs                        # Module exports
├── providers/
│   ├── mod.rs                    # Provider module
│   ├── file.rs                   # File-based provider
│   └── grpc.rs                   # gRPC provider
├── metrics.rs                    # Prometheus metrics
└── integration/
    └── gate_autoland.rs          # Gate integration tests
```

### TypeScript (cmd/gizzi-code)
```
src/runtime/verification/
├── types.ts                      # TypeScript types
├── verification-service.ts       # Dual-mode service
├── capture.ts                    # Main capture orchestrator
├── capture-ui-state.ts           # Screenshot capture
├── capture-coverage-map.ts       # Coverage visualization
├── capture-console-output.ts     # Console log capture
├── capture-visual-diff.ts        # Screenshot comparison
├── capture-error-state.ts        # Error boundary detection
├── parallel-capture.ts           # Concurrent capture
├── retry.ts                      # Retry logic
├── confidence.ts                 # Confidence calculation
├── grpc-server.ts                # Production gRPC server
├── file-writer.ts                # File-based evidence writer
├── policy.ts                     # Policy client
├── history/
│   └── store.ts                  # Confidence history
└── integration.test.ts           # Integration tests
```

### Governance (domains/governance)
```
src/policy/
└── visual_verification.rs        # Policy definition

docs/runbooks/
├── visual-verification-quickstart.md      # Quickstart guide
└── incident-response-visual-verification.md # Incident response
```

### Protocol
```
proto/
└── verification.proto            # gRPC contract
```

### CI/CD
```
.github/workflows/
└── visual-verification.yml       # GitHub Actions
```

### UI (surfaces)
```
shell-ui/src/components/visual/
├── VisualVerificationPanel.tsx   # Main panel
├── EvidenceCard.tsx              # Artifact display
├── ConfidenceMeter.tsx           # Score visualization
├── ArtifactViewer.tsx            # Modal viewer
└── TrendChart.tsx                # Historical trends
```

---

## Success Criteria

- ✅ Visual verification runs on every WIH before autoland
- ✅ Confidence score calculated from 5 artifact types
- ✅ Scores below threshold block autoland
- ✅ Bypass requires authorized approval
- ✅ Full audit trail of all verification events
- ✅ Prometheus metrics for observability
- ✅ GitHub Actions integration for PR checks
- ✅ Team runbooks for common scenarios
- ✅ Incident response playbooks

---

## Team Contacts

- **System Owner**: Platform Team
- **On-Call**: #allternit-oncall
- **Questions**: #allternit-visual-verification
- **Issues**: https://github.com/allternit/allternit/issues

---

*Last Updated: 2026-03-10*
*Version: 1.0.0*
