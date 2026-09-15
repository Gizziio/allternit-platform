/**
 * Video Generation Mode Service
 *
 * Handles text-to-video and image-to-video generation.
 *
 * Providers:
 * - `minimax` — legacy path proxied through the Gizzi media providers.
 * - `minimax-h3` — MiniMax H3 via the allternit-api media plane
 *   (POST /v2/video_generation → poll → download, keys server-side via V134 BYOK).
 * - `fal-seedance` — Seedance 2.0 via the fal queue API through the same
 *   media plane (submit → poll status/response → download MP4).
 */

import { previewVideoCost, type VideoProviderId } from './media-cost';

export interface VideoGenerationConfig {
  provider: 'minimax' | 'minimax-h3' | 'fal-seedance' | 'runway' | 'pika' | 'stable' | 'custom';
  model?: string;
  duration?: 6 | 10 | 15; // seconds
  resolution?: '768p' | '1080p' | '768P' | '2K' | '720p';
  fps?: 24 | 30 | 60;
  aspectRatio?: '16:9' | '9:16' | '1:1' | '4:3';
  /** fal Seedance tier: fast is cheaper, standard is higher quality. */
  falTier?: 'fast' | 'standard';
  /** First-frame image URL for image-to-video. */
  imageUrl?: string;
}

export interface GeneratedVideo {
  id: string;
  url: string;
  prompt: string;
  thumbnailUrl?: string;
  metadata: {
    provider: string;
    model: string;
    duration: number;
    resolution: string;
    fps: number;
    aspectRatio: string;
    createdAt: string;
  };
}

export interface VideoGenerationResult {
  videos: GeneratedVideo[];
  prompt: string;
  config: VideoGenerationConfig;
  usage?: {
    cost?: number;
    credits?: number;
  };
}

/**
 * Generate video from text prompt
 * 
 * How MiniMax does it:
 * - video-01 model: 720p, 6s clips
 * - T2V-01: Text-to-video
 * - T2V-01-Director: Camera control
 * - Cost: $0.43 per 6s clip
 * 
 * How GenSpark does it:
 * - Multiple providers (Kling, PixVerse, Luma)
 * - Auto-contextual generation
 * - Timeline editing
 */
export async function generateVideo(
  prompt: string,
  config: Partial<VideoGenerationConfig> = {},
): Promise<VideoGenerationResult> {
  const defaultConfig: VideoGenerationConfig = {
    provider: 'minimax',
    model: 'MiniMax-Hailuo-2.3',
    duration: 6,
    resolution: '1080p',
    fps: 24,
    aspectRatio: '16:9',
    ...config,
  };

  // Surface the cost preview before any metered generate (Register 1, no guarantees).
  if (defaultConfig.provider === 'minimax-h3' || defaultConfig.provider === 'fal-seedance') {
    const preview = previewVideoCost(defaultConfig.provider as VideoProviderId, defaultConfig.duration ?? 6, {
      resolution: defaultConfig.resolution,
      falTier: defaultConfig.falTier,
    });
    console.info(`[video] Cost preview: ${preview.summary}`);
  }

  switch (defaultConfig.provider) {
    case 'minimax': {
      const response = await fetch('/api/v1/providers/video/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, ...defaultConfig }),
      });
      const payload = await response.json().catch(() => ({})) as VideoGenerationResult & { message?: string };
      if (!response.ok) throw new Error(payload.message || `Video generation failed (${response.status}).`);
      return payload;
    }
    case 'minimax-h3':
    case 'fal-seedance':
      return generateVideoViaMediaPlane(prompt, defaultConfig);
    case 'runway': {
      const key = typeof process !== 'undefined' ? process.env.RUNWAY_API_KEY : undefined;
      if (!key) {
        throw new Error('Video generation requires a Runway API key. Add RUNWAY_API_KEY to your environment or provide it in settings.');
      }
      throw new Error('Runway integration is not yet implemented. Use MiniMax instead.');
    }
    default:
      throw new Error(`Video provider '${defaultConfig.provider}' is not yet integrated.`);
  }
}

/**
 * Generate video from image (Image-to-Video)
 * 
 * MiniMax models:
 * - I2V-01: Image to video
 * - I2V-01-Director: Image + camera control
 * - S2V-01: Subject reference video (maintains subject consistency)
 * - I2V-01-live: Live video style
 */
export async function generateVideoFromImage(
  imageUrl: string,
  prompt: string,
  config: Partial<VideoGenerationConfig> = {}
): Promise<VideoGenerationResult> {
  const defaultConfig: VideoGenerationConfig = {
    provider: 'minimax',
    model: 'I2V-01',
    duration: 6,
    resolution: '1080p',
    fps: 24,
    aspectRatio: '16:9',
    ...config,
  };

  if (defaultConfig.provider === 'minimax-h3' || defaultConfig.provider === 'fal-seedance') {
    const preview = previewVideoCost(defaultConfig.provider as VideoProviderId, defaultConfig.duration ?? 6, {
      resolution: defaultConfig.resolution,
      falTier: defaultConfig.falTier,
    });
    console.info(`[video] Cost preview (image-to-video): ${preview.summary}`);
    return generateVideoViaMediaPlane(prompt, { ...defaultConfig, imageUrl });
  }

  throw new Error('Image-to-video generation requires a MiniMax API key with I2V model access. Add MINIMAX_API_KEY to your environment.');
}

// ─── Media plane backends (MiniMax H3 / fal Seedance) ───────────────────────
//
// The provider protocols run server-side in allternit-api (`media` module);
// API keys never reach the browser (V134 BYOK credential store, or the
// platform-funded env lane behind ALLTERNIT_MEDIA_PLATFORM_FUNDED). The client
// drives the job lifecycle: submit → poll → download.

const MEDIA_JOBS_URL = '/api/v1/media/video/jobs';
const POLL_INTERVAL_MS = 5000;
const POLL_TIMEOUT_MS = 8 * 60 * 1000; // provider queues can run several minutes

interface MediaJobResponse {
  job_id: string;
  provider: string;
  status: 'queued' | 'processing' | 'succeeded' | 'failed';
  video?: { artifact_url: string; content_type?: string };
  error?: string;
  estimated_cost_usd?: number;
}

async function postJson<T>(url: string, body: unknown): Promise<T> {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const payload = await response.json().catch(() => ({})) as T & { error?: string; message?: string };
  if (!response.ok) {
    throw new Error(payload.message || payload.error || `Media request failed (${response.status}).`);
  }
  return payload;
}

async function getJson<T>(url: string): Promise<T> {
  const response = await fetch(url);
  const payload = await response.json().catch(() => ({})) as T & { error?: string; message?: string };
  if (!response.ok) {
    throw new Error(payload.message || payload.error || `Media poll failed (${response.status}).`);
  }
  return payload;
}

export async function generateVideoViaMediaPlane(
  prompt: string,
  config: VideoGenerationConfig,
): Promise<VideoGenerationResult> {
  const provider = config.provider as VideoProviderId;
  const isMiniMax = provider === 'minimax-h3';
  const submit = await postJson<MediaJobResponse & { job_id: string }>(MEDIA_JOBS_URL, {
    provider,
    prompt,
    duration: config.duration ?? 6,
    resolution: config.resolution ?? (isMiniMax ? '768P' : '720p'),
    aspect_ratio: config.aspectRatio ?? '16:9',
    image_url: config.imageUrl,
    fast: config.falTier ? config.falTier === 'fast' : undefined,
  });

  const deadline = Date.now() + POLL_TIMEOUT_MS;
  let last: MediaJobResponse = submit;
  while (Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
    last = await getJson<MediaJobResponse>(`${MEDIA_JOBS_URL}/${submit.job_id}`);
    if (last.status === 'succeeded' || last.status === 'failed') break;
  }

  if (last.status !== 'succeeded' || !last.video?.artifact_url) {
    throw new Error(last.error || `Video generation did not complete (status: ${last.status}).`);
  }

  const createdAt = new Date().toISOString();
  return {
    videos: [{
      id: last.job_id,
      url: last.video.artifact_url,
      prompt,
      metadata: {
        provider,
        model: isMiniMax ? 'MiniMax-H3' : 'seedance-2.0',
        duration: config.duration ?? 6,
        resolution: config.resolution ?? (isMiniMax ? '768P' : '720p'),
        fps: config.fps ?? 24,
        aspectRatio: config.aspectRatio ?? '16:9',
        createdAt,
      },
    }],
    prompt,
    config,
    usage: { cost: last.estimated_cost_usd },
  };
}

/**
 * Extend video duration
 * 
 * Some providers allow extending videos beyond initial duration
 */
export async function extendVideo(
  videoId: string,
  additionalSeconds: number
): Promise<GeneratedVideo> {
  throw new Error(
    `Video extension is unavailable for video '${videoId}'. No validated provider integration exists for extending clips by ${additionalSeconds} seconds.`
  );
}

/**
 * Edit video (trim, merge, add effects)
 * 
 * Basic video editing capabilities
 */
interface VideoEditOperation {
  type: 'trim' | 'merge' | 'caption' | 'effect';
  params: Record<string, unknown>;
}

export async function editVideo(
  videoId: string,
  operations: VideoEditOperation[]
): Promise<GeneratedVideo> {
  throw new Error(
    `Video editing is unavailable for video '${videoId}'. No validated provider integration exists for ${operations.length} requested operation(s).`
  );
}

// API Providers Registry for Video Mode
export type VideoProviderApiKeys = {
  pollinations?: string;
  replicate?: string;
  fal?: string;
  huggingface?: string;
  minimax?: string;
  kling?: string;
  runway?: string;
  pika?: string;
  luma?: string;
  stability?: string;
  custom?: string;
  customBaseURL?: string;
};

export interface VideoProviderInfo {
  id?: string;
  name: string;
  description?: string;
  type?: string;
  url?: string;
  models?: unknown[];
  isAvailable?: (opts: { apiKeys: VideoProviderApiKeys }) => boolean;
}

export function getVideoProviders(_opts?: { apiKeys?: VideoProviderApiKeys }): Array<VideoProviderInfo & { id: string }> {
  return Object.entries(VIDEO_PROVIDERS).map(([id, p]) => ({
    id,
    ...p,
  }));
}

export const VIDEO_PROVIDERS: Record<string, VideoProviderInfo> = {
  pollinations: {
    id: 'pollinations',
    name: 'Pollinations',
    description: 'Free text-to-video',
    type: 'free',
    isAvailable: () => true,
  },
  replicate: {
    id: 'replicate',
    name: 'Replicate',
    description: 'Requires API token',
    type: 'api_key',
    isAvailable: ({ apiKeys }) => Boolean(apiKeys.replicate),
  },
  fal: {
    id: 'fal',
    name: 'fal.ai',
    description: 'Requires fal.ai key',
    type: 'api_key',
    isAvailable: ({ apiKeys }) => Boolean(apiKeys.fal),
  },
  'minimax-h3': {
    name: 'MiniMax H3',
    url: 'api.minimax.io',
    models: [
      { id: 'MiniMax-H3', type: 'text-to-video', costPerSecond: 0.08, resolution: '768P', duration: 6 },
      { id: 'MiniMax-H3', type: 'text-to-video', costPerSecond: 0.13, resolution: '2K', duration: 6, note: 'price corroborated, not on official paygo table' },
    ],
  },
  'fal-seedance': {
    name: 'Seedance 2.0 (fal)',
    url: 'fal.ai',
    models: [
      { id: 'seedance-2.0-fast', type: 'text-to-video', costPerSecond: 0.2419, resolution: '720p', duration: 6 },
      { id: 'seedance-2.0', type: 'text-to-video', costPerSecond: 0.3034, resolution: '720p', duration: 6 },
      { id: 'seedance-2.0', type: 'text-to-video', costPerSecond: 0.682, resolution: '1080p', duration: 6 },
    ],
  },
  minimax: {
    name: 'MiniMax',
    url: 'api.minimax.chat',
    models: [
      { id: 'T2V-01', type: 'text-to-video', cost: 0.43, duration: 6 },
      { id: 'T2V-01-Director', type: 'text-to-video', cost: 0.43, duration: 6, features: ['camera-control'] },
      { id: 'I2V-01', type: 'image-to-video', cost: 0.43, duration: 6 },
      { id: 'I2V-01-Director', type: 'image-to-video', cost: 0.43, duration: 6, features: ['camera-control'] },
      { id: 'S2V-01', type: 'subject-reference', cost: 0.65, duration: 6 },
      { id: 'I2V-01-live', type: 'live-style', cost: 0.43, duration: 6 },
    ],
  },
  runway: {
    name: 'Runway',
    url: 'runwayml.com',
    models: [
      { id: 'gen-2', type: 'text-to-video', cost: null, duration: 4 },
      { id: 'gen-3', type: 'text-to-video', cost: null, duration: 10 },
    ],
  },
  pika: {
    name: 'Pika Labs',
    url: 'pika.art',
    models: [
      { id: 'pika-1.0', type: 'text-to-video', cost: null, duration: 3 },
    ],
  },
  stability: {
    name: 'Stable Video',
    url: 'stability.ai',
    models: [
      { id: 'svd', type: 'image-to-video', cost: null, duration: 4 },
      { id: 'svd-xt', type: 'image-to-video', cost: null, duration: 25 },
    ],
  },
};

// Open Source Tools for Video
const VIDEO_TOOLS = {
  animatediff: {
    name: 'AnimateDiff',
    url: 'github.com/guoyww/AnimateDiff',
    type: 'local',
    features: ['image-animation', 'motion-loRA'],
  },
  modelscope: {
    name: 'ModelScope',
    url: 'github.com/modelscope/modelscope',
    type: 'local',
    features: ['text-to-video', 'video-editing'],
  },
  svd: {
    name: 'Stable Video Diffusion',
    url: 'github.com/Stability-AI/generative-models',
    type: 'local',
    features: ['image-to-video', 'consistency'],
  },
};
