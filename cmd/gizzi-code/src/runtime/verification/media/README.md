# Media Capture for Verification

This module provides screenshot, video, and GIF capture capabilities during verification workflows, with a complete review and cleanup lifecycle.

## Overview

The media capture module follows a three-phase workflow:

```
┌─────────┐    ┌─────────┐    ┌─────────┐
│ CAPTURE │ → │ REVIEW  │ → │ CLEANUP │
└─────────┘    └─────────┘    └─────────┘
```

1. **Capture**: Screenshots/videos are captured during verification
2. **Review**: Human reviewer approves or rejects the captured media
3. **Cleanup**: Approved media is auto-cleaned after a delay; rejected media is cleaned immediately

## Features

- **Screenshot capture** at configurable intervals
- **Video capture** (platform-dependent)
- **GIF generation** from captured video
- **Review workflow** with approve/reject decisions
- **Auto-cleanup** with configurable delays
- **Manual cleanup** with selective preservation
- **State tracking** for audit trails

## Usage

### Basic Capture During Verification

```typescript
import { 
  VerificationOrchestrator,
  MediaCaptureManager,
  MediaReviewWorkflow 
} from "@/runtime/verification";

const orchestrator = new VerificationOrchestrator("session_123", {
  defaultMode: "adaptive",
  mediaCapture: {
    enabled: true,
    screenshots: true,
    video: false,
    screenshotInterval: 1000,
    requireReview: true,
    autoCleanupAfter: 3600, // 1 hour
  },
});

const result = await orchestrator.verify(plan, receipts, context);
// Media is automatically captured and enters review workflow
```

### Standalone Media Capture

```typescript
import {
  MediaCaptureManager,
  MediaReviewWorkflow,
  captureVerificationMedia,
  runCompleteWorkflow,
} from "@/runtime/verification/media";

const manager = new MediaCaptureManager("./captures");
const workflow = new MediaReviewWorkflow(manager);

// Start capture
const { capture, stop } = await captureVerificationMedia(manager, {
  sessionId: "sess_123",
  verificationId: "ver_456",
  captureScreenshots: true,
  screenshotInterval: 500,
  maxDuration: 30,
});

// ... run verification ...

// Stop capture
await stop();

// Start review workflow
const result = await runCompleteWorkflow(workflow, capture.id, true);

// Wait for human review
const finalState = await result.waitForDecision();

// Approve or reject
await result.approve("reviewer@example.com", "Looks good!");
// or
// await result.reject("reviewer@example.com", "Issues found");
```

### CLI Usage

```bash
# Run verification with screenshot capture
gizzi verify run --capture --mode semi-formal

# With review requirement
gizzi verify run --capture --review --cleanup-after 7200

# With video capture
gizzi verify run --capture-video --capture-output ./captures

# Review captured media
gizzi verify media review <captureId> --approve --by "user@example.com"

# Cleanup media
gizzi verify media cleanup <captureId> --keep-screenshots
```

## API Reference

### MediaCaptureManager

Manages capture sessions and file storage.

```typescript
class MediaCaptureManager {
  constructor(baseDir: string);
  
  startCapture(options: MediaCaptureOptions): Promise<CapturedMedia>;
  stopCapture(captureId: string): Promise<CapturedMedia | null>;
  reviewCapture(captureId: string, decision: ReviewDecision): Promise<CapturedMedia | null>;
  cleanup(captureId: string, options?: CleanupOptions): Promise<void>;
  getCapture(captureId: string): CapturedMedia | undefined;
}
```

### MediaReviewWorkflow

Manages the review lifecycle.

```typescript
class MediaReviewWorkflow {
  constructor(captureManager: MediaCaptureManager);
  
  start(captureId: string, options: WorkflowOptions): Promise<WorkflowState>;
  approve(captureId: string, decision: ReviewDecision): Promise<WorkflowState | null>;
  reject(captureId: string, decision: ReviewDecision): Promise<WorkflowState | null>;
  cleanup(captureId: string, options?: CleanupOptions): Promise<WorkflowState | null>;
  
  onStateChange(callback: WorkflowCallback): () => void;
  getState(captureId: string): WorkflowState | undefined;
  getAllStates(): WorkflowState[];
  destroy(): Promise<void>;
}
```

### Capture Options

```typescript
interface MediaCaptureOptions {
  sessionId: string;
  verificationId: string;
  outputDir?: string;
  screenshots?: boolean;
  video?: boolean;
  gif?: boolean;
  screenshotInterval?: number;  // ms
  videoQuality?: "low" | "medium" | "high";
  maxDuration?: number;  // seconds
}
```

### Workflow State

```typescript
interface WorkflowState {
  captureId: string;
  phase: "capture" | "review" | "decided" | "cleanup" | "complete";
  capture: CapturedMedia | null;
  reviewDecision?: ReviewDecision;
  cleanupScheduledAt?: Date;
  cleanupCompletedAt?: Date;
  error?: string;
}
```

## Workflow States

```
capture → review → decided → cleanup → complete
            ↓
          (reject)
            ↓
      immediate cleanup
```

| Phase | Description |
|-------|-------------|
| `capture` | Media is being captured |
| `review` | Awaiting human review |
| `decided` | Reviewer approved or rejected |
| `cleanup` | Cleaning up media files |
| `complete` | Workflow finished |

## Platform Support

| Platform | Screenshots | Video | Notes |
|----------|-------------|-------|-------|
| macOS | ✅ | ✅ | Uses `screencapture` |
| Linux | ✅ | ⚠️ | Uses `gnome-screenshot` |
| Windows | ⚠️ | ❌ | Requires additional tools |

## Integration with VerificationOrchestrator

When media capture is enabled in the orchestrator config:

1. Capture starts automatically when `verify()` is called
2. Capture stops when verification completes
3. Review workflow starts automatically
4. Result includes media metadata:

```typescript
const result = await orchestrator.verify(plan, receipts, context);

console.log(result.mediaCapture);
// {
//   captureId: "cap_...",
//   screenshotCount: 12,
//   hasVideo: false,
//   hasGif: false,
//   reviewRequired: true,
//   status: "review"
// }
```

### Post-Verification Review

```typescript
// Get workflow state
const state = orchestrator.getMediaWorkflowState();

// Approve from external system
await orchestrator.approveMedia("reviewer@example.com", "Verified correct");

// Or reject
await orchestrator.rejectMedia("reviewer@example.com", "Incorrect output");

// Force immediate cleanup
await orchestrator.cleanupMedia({ keepScreenshots: true });
```

## Configuration

```typescript
// gizzi.json
{
  "verification": {
    "enabled": true,
    "mode": "adaptive",
    "mediaCapture": {
      "enabled": true,
      "screenshots": true,
      "video": false,
      "screenshotInterval": 1000,
      "outputDir": "./verification-captures",
      "requireReview": true,
      "autoCleanupAfter": 3600
    }
  }
}
```

## Demo

Run the demo to see the complete workflow:

```bash
npx ts-node src/runtime/verification/media/demo.ts
```
