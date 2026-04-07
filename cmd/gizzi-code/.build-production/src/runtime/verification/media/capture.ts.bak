/**
 * Media Capture for Verification
 * 
 * Captures screenshots, videos, and GIFs during verification workflows.
 */

import * as fs from "fs/promises";
import * as path from "path";
import { execSync, spawn } from "child_process";

// Simple logger for media capture
const log = {
  info: (msg: string, meta?: Record<string, unknown>) => console.log(`[media] ${msg}`, meta || ""),
  error: (msg: string, meta?: Record<string, unknown>) => console.error(`[media] ${msg}`, meta || ""),
  warn: (msg: string, meta?: Record<string, unknown>) => console.warn(`[media] ${msg}`, meta || ""),
  debug: (msg: string, meta?: Record<string, unknown>) => console.debug(`[media] ${msg}`, meta || ""),
};

export interface MediaCaptureOptions {
  sessionId: string;
  verificationId: string;
  outputDir?: string;
  screenshots?: boolean;
  video?: boolean;
  gif?: boolean;
  screenshotInterval?: number;
  videoQuality?: "low" | "medium" | "high";
  maxDuration?: number;
}

export interface CapturedMedia {
  id: string;
  sessionId: string;
  verificationId: string;
  timestamp: string;
  screenshots: ScreenshotInfo[];
  video?: VideoInfo;
  gif?: GifInfo;
  status: "capturing" | "completed" | "failed" | "reviewed" | "cleaned";
  metadata: {
    duration?: number;
    fileSize?: number;
    resolution?: string;
    frameCount?: number;
  };
}

export interface ScreenshotInfo {
  id: string;
  path: string;
  timestamp: string;
  label?: string;
  width: number;
  height: number;
}

export interface VideoInfo {
  path: string;
  format: "webm" | "mp4";
  duration: number;
  width: number;
  height: number;
  fps: number;
}

export interface GifInfo {
  path: string;
  duration: number;
  width: number;
  height: number;
  frameCount: number;
}

export interface ReviewDecision {
  approved: boolean;
  notes?: string;
  reviewer?: string;
  timestamp: string;
}

export class MediaCaptureManager {
  private captures = new Map<string, CapturedMedia>();
  private activeCaptures = new Map<string, AbortController>();
  
  constructor(private baseDir: string) {}
  
  async startCapture(options: MediaCaptureOptions): Promise<CapturedMedia> {
    const captureId = `cap_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const outputDir = options.outputDir || path.join(
      this.baseDir, options.sessionId, options.verificationId
    );
    
    await fs.mkdir(outputDir, { recursive: true });
    
    const capture: CapturedMedia = {
      id: captureId,
      sessionId: options.sessionId,
      verificationId: options.verificationId,
      timestamp: new Date().toISOString(),
      screenshots: [],
      status: "capturing",
      metadata: {},
    };
    
    this.captures.set(captureId, capture);
    
    const abortController = new AbortController();
    this.activeCaptures.set(captureId, abortController);
    
    log.info("Starting media capture", { captureId });
    
    const promises: Promise<void>[] = [];
    if (options.screenshots) {
      promises.push(this.captureScreenshots(captureId, outputDir, options));
    }
    if (options.video) {
      promises.push(this.captureVideo(captureId, outputDir, options));
    }
    
    const maxDuration = options.maxDuration || 300;
    const timeoutPromise = new Promise<void>((_, reject) => {
      setTimeout(() => reject(new Error("Capture timeout")), maxDuration * 1000);
    });
    
    Promise.race([Promise.all(promises), timeoutPromise])
      .then(() => {
        capture.status = "completed";
        if (options.gif && capture.video) {
          this.generateGif(captureId, outputDir).catch(err => {
            log.error("GIF generation failed", { error: err });
          });
        }
        log.info("Media capture completed", { captureId });
      })
      .catch(error => {
        capture.status = "failed";
        log.error("Media capture failed", { captureId, error });
      });
    
    return capture;
  }
  
  async stopCapture(captureId: string): Promise<CapturedMedia | null> {
    const controller = this.activeCaptures.get(captureId);
    if (controller) {
      controller.abort();
      this.activeCaptures.delete(captureId);
    }
    const capture = this.captures.get(captureId);
    if (capture && capture.status === "capturing") {
      capture.status = "completed";
    }
    return capture || null;
  }
  
  private async captureScreenshots(captureId: string, outputDir: string, options: MediaCaptureOptions): Promise<void> {
    const capture = this.captures.get(captureId);
    if (!capture) return;
    
    const interval = options.screenshotInterval || 1000;
    let count = 0;
    
    while (this.activeCaptures.has(captureId) && !this.activeCaptures.get(captureId)?.signal.aborted) {
      try {
        const screenshotId = `screenshot_${Date.now()}_${count}`;
        const screenshotPath = path.join(outputDir, `${screenshotId}.png`);
        await this.captureSystemScreenshot(screenshotPath);
        
        capture.screenshots.push({
          id: screenshotId,
          path: screenshotPath,
          timestamp: new Date().toISOString(),
          label: `Step ${count + 1}`,
          width: 1920,
          height: 1080,
        });
        
        count++;
        await new Promise(r => setTimeout(r, interval));
      } catch (error) {
        log.error("Screenshot capture failed", { captureId, error });
        break;
      }
    }
    capture.metadata.frameCount = count;
  }
  
  private async captureVideo(captureId: string, outputDir: string, options: MediaCaptureOptions): Promise<void> {
    const capture = this.captures.get(captureId);
    if (!capture) return;

    const videoPath = path.join(outputDir, `capture_${captureId}.webm`);
    const duration = options.maxDuration || 300;
    const bitrate = options.videoQuality === "low" ? "500k" : options.videoQuality === "high" ? "3M" : "1M";
    const platform = process.platform;

    let ffmpegArgs: string[];
    if (platform === "darwin") {
      ffmpegArgs = [
        "-f", "avfoundation", "-framerate", "30", "-i", "1:none",
        "-t", String(duration), "-vcodec", "libvpx", "-b:v", bitrate, "-an",
        videoPath,
      ];
    } else if (platform === "linux") {
      const display = process.env.DISPLAY || ":0.0";
      ffmpegArgs = [
        "-f", "x11grab", "-framerate", "30", "-video_size", "1920x1080", "-i", display,
        "-t", String(duration), "-vcodec", "libvpx", "-b:v", bitrate, "-an",
        videoPath,
      ];
    } else {
      log.warn("Video capture not supported on this platform", { platform });
      return;
    }

    const startTime = Date.now();
    const proc = spawn("ffmpeg", ["-y", ...ffmpegArgs]);

    const controller = this.activeCaptures.get(captureId);
    if (controller) {
      controller.signal.addEventListener("abort", () => proc.kill("SIGTERM"));
    }

    await new Promise<void>((resolve, reject) => {
      proc.on("exit", (code) => (code === 0 || code === null ? resolve() : reject(new Error(`ffmpeg exited ${code}`))));
      proc.on("error", reject);
    });

    capture.video = {
      path: videoPath,
      format: "webm",
      duration: (Date.now() - startTime) / 1000,
      width: 1920,
      height: 1080,
      fps: 30,
    };
  }

  private async generateGif(captureId: string, outputDir: string): Promise<void> {
    const capture = this.captures.get(captureId);
    if (!capture) return;

    const gifPath = path.join(outputDir, `capture_${captureId}.gif`);
    const filterGraph = "fps=10,scale=480:-1:flags=lanczos";

    const spawnFfmpeg = (args: string[]) =>
      new Promise<void>((resolve, reject) => {
        const proc = spawn("ffmpeg", ["-y", ...args]);
        proc.on("exit", (code) => (code === 0 || code === null ? resolve() : reject(new Error(`ffmpeg exited ${code}`))));
        proc.on("error", reject);
      });

    if (capture.screenshots.length > 0) {
      // Build gif from captured screenshot frames
      const framePattern = path.join(outputDir, "screenshot_*.png");
      await spawnFfmpeg([
        "-framerate", "10", "-pattern_type", "glob", "-i", framePattern,
        "-vf", filterGraph, gifPath,
      ]);
      capture.gif = {
        path: gifPath,
        duration: capture.screenshots.length / 10,
        width: 480,
        height: 270,
        frameCount: capture.screenshots.length,
      };
    } else if (capture.video) {
      // Two-pass palette gif from video
      const palettePath = path.join(outputDir, `palette_${captureId}.png`);
      await spawnFfmpeg(["-i", capture.video.path, "-vf", `${filterGraph},palettegen`, palettePath]);
      await spawnFfmpeg([
        "-i", capture.video.path, "-i", palettePath,
        "-lavfi", `${filterGraph} [x]; [x][1:v] paletteuse`, gifPath,
      ]);
      await fs.unlink(palettePath).catch(() => {});
      capture.gif = {
        path: gifPath,
        duration: capture.video.duration,
        width: 480,
        height: 270,
        frameCount: Math.floor(capture.video.duration * 10),
      };
    }
  }
  
  async reviewCapture(captureId: string, decision: ReviewDecision): Promise<CapturedMedia | null> {
    const capture = this.captures.get(captureId);
    if (!capture) return null;
    
    capture.status = decision.approved ? "reviewed" : "failed";
    log.info("Capture reviewed", { captureId, approved: decision.approved });
    return capture;
  }
  
  async cleanup(captureId: string, options?: { keepScreenshots?: boolean; keepVideo?: boolean; keepGif?: boolean }): Promise<void> {
    const capture = this.captures.get(captureId);
    if (!capture) return;
    
    const filesToDelete: string[] = [];
    if (!options?.keepScreenshots) {
      filesToDelete.push(...capture.screenshots.map(s => s.path));
      capture.screenshots = [];
    }
    if (!options?.keepVideo && capture.video) {
      filesToDelete.push(capture.video.path);
      capture.video = undefined;
    }
    if (!options?.keepGif && capture.gif) {
      filesToDelete.push(capture.gif.path);
      capture.gif = undefined;
    }
    
    for (const file of filesToDelete) {
      try { await fs.unlink(file); } catch {}
    }
    
    capture.status = "cleaned";
    log.info("Media cleanup completed", { captureId, filesDeleted: filesToDelete.length });
  }
  
  getCapture(captureId: string): CapturedMedia | undefined {
    return this.captures.get(captureId);
  }
  
  private async captureSystemScreenshot(screenshotPath: string): Promise<void> {
    const platform = process.platform;
    if (platform === "darwin") {
      execSync(`screencapture "${screenshotPath}"`);
    } else if (platform === "linux") {
      execSync(`gnome-screenshot -f "${screenshotPath}"`);
    }
  }
}

export interface VerificationWithMediaOptions {
  captureMedia?: boolean;
  mediaOptions?: Omit<MediaCaptureOptions, "sessionId" | "verificationId">;
  requireReview?: boolean;
  autoCleanupAfter?: number;
}

export interface VerificationResultWithMedia {
  verification: { passed: boolean; confidence: string; reason: string };
  media?: CapturedMedia;
  review?: ReviewDecision;
  cleanupScheduled?: Date;
}
