/**
 * Opt-in video recording for browser sessions.
 *
 * Playwright `recordVideo` only applies to contexts Playwright itself
 * creates — an externally launched Chrome context (the CDP-attach path where
 * the profile's own tab is adopted) cannot be retrofitted with video. So a
 * "recorded session" is a fresh Playwright-created context, optionally over
 * an existing CDP connection (verified working on connectOverCDP with
 * playwright 1.58.2 — see video-recorder.smoke.test.ts).
 *
 * The video start epoch is captured when the context is created so callers
 * can convert wall-clock tool-call timestamps to video offsets:
 *   offsetMs = toolCallTimestampMs - startedAtEpoch
 *
 * Artifacts follow the recordings-root convention shared with the ACU
 * gateway (~/.allternit/recordings): the finalized .webm lands next to the
 * recording JSONL as <artifactName>.webm (Playwright's own staging dir is
 * removed after the copy).
 */

import { mkdir, rename, rm, stat } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';

export interface VideoRecordingStart {
  /** Epoch ms captured as the context (and thus the video) is created. */
  startedAtEpoch: number;
  /** Playwright staging dir holding the in-progress video. */
  stagingDir: string;
}

export interface FinalizedVideo {
  path: string;
  startedAtEpoch: number;
  sizeBytes: number;
}

export function defaultRecordingsRoot(): string {
  return join(homedir(), '.allternit', 'recordings');
}

export function recordingStagingDir(recordingsRoot: string, artifactName: string): string {
  return join(recordingsRoot, `.video-${artifactName}`);
}

export function recordingArtifactPath(recordingsRoot: string, artifactName: string): string {
  return join(recordingsRoot, `${artifactName}.webm`);
}

/**
 * Playwright recordVideo options for a new context. `dir` must exist before
 * the context is created.
 */
export async function prepareVideoRecording(
  recordingsRoot: string,
  artifactName: string,
): Promise<VideoRecordingStart> {
  const stagingDir = recordingStagingDir(recordingsRoot, artifactName);
  await rm(stagingDir, { recursive: true, force: true });
  await mkdir(stagingDir, { recursive: true });
  // The epoch is taken here so it precedes any frame the video can contain;
  // tool-call timestamps convert to non-negative video offsets.
  return { startedAtEpoch: Date.now(), stagingDir };
}

export function recordVideoOptions(start: VideoRecordingStart, size?: { width: number; height: number }) {
  return {
    recordVideo: {
      dir: start.stagingDir,
      ...(size ? { size } : {}),
    },
  };
}

/**
 * Move the finalized video from Playwright's staging dir to its artifact
 * path in the recordings root. The staging dir is removed either way.
 */
export async function finalizeVideoRecording(
  stagedPath: string,
  recordingsRoot: string,
  artifactName: string,
  startedAtEpoch: number,
): Promise<FinalizedVideo> {
  await mkdir(recordingsRoot, { recursive: true });
  const path = recordingArtifactPath(recordingsRoot, artifactName);
  await rm(path, { force: true });
  await rename(stagedPath, path);
  await rm(recordingStagingDir(recordingsRoot, artifactName), { recursive: true, force: true });
  const sizeBytes = (await stat(path)).size;
  return { path, startedAtEpoch, sizeBytes };
}
