# Semi-Formal Verification Module

Implementation of Meta's "Agentic Code Reasoning" (arXiv:2603.01896) for execution-free code verification.

## Quick Start

```typescript
import { quickVerify } from "@/runtime/loop/verification";

const result = await quickVerify(sessionId, "Verify auth fix", {
  mode: "adaptive",
  patches: [{ path: "src/auth.ts", content: "Added null check" }],
});

// result.passed, result.confidence, result.reason
```

## Verification Modes

- `adaptive` (default): Try semi-formal first, fallback to empirical
- `semi-formal`: Reasoning-based with structured certificates
- `empirical`: Test execution
- `both`: Run both methods

## CLI Usage

```bash
npx gizzi verification verify --mode semi-formal
npx gizzi verification history
npx gizzi verification stats
```

## Configuration (gizzi.json)

```json
{
  "verification": {
    "enabled": true,
    "mode": "adaptive",
    "minConfidence": "medium"
  }
}
```

## Tool Usage

```
<tool>verify</tool>
<parameter>mode</parameter>
<parameter>adaptive</parameter>
<parameter>description</parameter>
<parameter>Verify the fix</parameter>
```

## API Endpoints

- `POST /verification/verify` - General verification
- `POST /verification/quick` - Quick verify
- `POST /verification/patch-equivalence` - Compare patches
- `GET /verification/query` - Query history
- `GET /verification/stats` - Get statistics

## Certificate Structure

```typescript
{
  version: "1.0",
  task: { type, description },
  definitions: [],
  premises: [{ id, statement, evidence }],
  executionTraces: [{ scenario, codePath, outcome }],
  edgeCases: [],
  conclusion: { statement, answer, followsFrom },
  counterexample?: { testName, expected, actual }
}
```

## Files

- `verifiers/` - SemiFormal, Empirical, Orchestrator
- `storage/` - VerificationStore with querying
- `integration/` - Runtime hooks, CI/CD
- `cli/commands.ts` - CLI implementation
- `media/` - Screenshot/video capture with review workflow

## Media Capture

Capture screenshots/videos during verification with review workflow:

```typescript
const orchestrator = new VerificationOrchestrator("session_123", {
  mediaCapture: {
    enabled: true,
    screenshots: true,
    requireReview: true,
    autoCleanupAfter: 3600,
  },
});
```

See [media/README.md](./media/README.md) for details.

## Research

Based on "Agentic Code Reasoning" by Ugare & Chandra (Meta, 2026).
Accuracy: 78% → 88-93%
