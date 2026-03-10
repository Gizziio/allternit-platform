/**
 * Media Module for Verification
 * 
 * Provides screenshot, video, and GIF capture with review and cleanup workflows.
 * 
 * @example
 * ```typescript
 * import { MediaCaptureManager, MediaReviewWorkflow, captureVerificationMedia } from "./media";
 * 
 * const manager = new MediaCaptureManager("./captures");
 * const workflow = new MediaReviewWorkflow(manager);
 * 
 * // Start capture during verification
 * const { capture, stop } = await captureVerificationMedia(manager, {
 *   sessionId: "sess_123",
 *   verificationId: "ver_456",
 *   captureScreenshots: true,
 * });
 * 
 * // Run verification...
 * await stop();
 * 
 * // Review workflow
 * const result = await runCompleteWorkflow(workflow, capture.id, true);
 * // ... user reviews and approves/rejects ...
 * await result.approve("human@example.com", "Looks good!");
 * ```
 */

export {
  MediaCaptureManager,
  type MediaCaptureOptions,
  type CapturedMedia,
  type ScreenshotInfo,
  type VideoInfo,
  type GifInfo,
  type ReviewDecision,
  type VerificationWithMediaOptions,
  type VerificationResultWithMedia,
} from "./capture";

export {
  MediaReviewWorkflow,
  type ReviewPhase,
  type WorkflowState,
  type WorkflowCallback,
} from "./workflow";

export {
  captureVerificationMedia,
  runCompleteWorkflow,
  type CaptureDuringVerificationOptions,
  type CompleteWorkflowResult,
} from "./utils";
