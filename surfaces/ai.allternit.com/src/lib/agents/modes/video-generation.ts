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
 * Provider registry for text-to-video and image-to-video generation.
 * MiniMax is no longer the default or only path. Providers include free
 * options (Pollinations), API-key aggregators (Replicate, fal.ai), direct
 * APIs (Kling, Runway, Pika, Luma, Stability), and a bring-your-own endpoint.
 */

export type VideoProviderId =
  | 'pollinations'
  | 'replicate'
  | 'fal'
  | 'huggingface'
  | 'minimax'
  | 'kling'
  | 'runway'
  | 'pika'
  | 'luma'
  | 'stability'
  | 'custom';

export interface VideoProviderApiKeys {
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
}

export interface VideoGenerationConfig {
  provider: VideoProviderId;
  model?: string;
  duration?: 6 | 10 | 15; // seconds
  resolution?: '768p' | '1080p' | '768P' | '2K' | '720p';
  fps?: 24 | 30 | 60;
  aspectRatio?: '16:9' | '9:16' | '1:1' | '4:3';
  /** fal Seedance tier: fast is cheaper, standard is higher quality. */
  falTier?: 'fast' | 'standard';
  /** First-frame image URL for image-to-video. */
  imageUrl?: string;
  apiKey?: string;
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

export interface VideoProviderInfo {
  id: VideoProviderId;
  name: string;
  type: 'free' | 'api_key' | 'subscription' | 'local';
  defaultModel: string;
  description: string;
  isAvailable: boolean;
  isDefault: boolean;
}

function defaultVideoConfig(config: Partial<VideoGenerationConfig> = {}): VideoGenerationConfig {
  const provider = config.provider ?? 'pollinations';
  const providerInfo = VIDEO_PROVIDERS[provider as keyof typeof VIDEO_PROVIDERS];
  return {
    provider,
    model: config.model ?? providerInfo?.models[0]?.id ?? 'default',
    duration: config.duration ?? 6,
    resolution: config.resolution ?? '1080p',
    fps: config.fps ?? 24,
    aspectRatio: config.aspectRatio ?? '16:9',
    apiKey: config.apiKey,
  };
}

/**
 * Generate video from a text prompt.
 *
 * The request is forwarded to `/api/v1/providers/video/generate`, which proxies
 * to the configured runtime. The provider ID and any configured API key are
 * included in the payload so the runtime can route to Pollinations, Replicate,
 * MiniMax, etc. as configured.
 */
export async function generateVideo(
  prompt: string,
  config: Partial<VideoGenerationConfig> = {},
): Promise<VideoGenerationResult> {
  const resolved = defaultVideoConfig(config);

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
  const response = await fetch('/api/v1/providers/video/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt, ...resolved }),
  });
  const payload = (await response.json().catch(() => ({}))) as VideoGenerationResult & { message?: string };
  if (!response.ok) throw new Error(payload.message || `Video generation failed (${response.status}).`);
  return payload;
}

/**
 * Generate video from an image (image-to-video).
 */
export async function generateVideoFromImage(
  imageUrl: string,
  prompt: string,
  config: Partial<VideoGenerationConfig> = {},
): Promise<VideoGenerationResult> {
  const resolved = defaultVideoConfig(config);

  if (defaultConfig.provider === 'minimax-h3' || defaultConfig.provider === 'fal-seedance') {
    const preview = previewVideoCost(defaultConfig.provider as VideoProviderId, defaultConfig.duration ?? 6, {
      resolution: defaultConfig.resolution,
      falTier: defaultConfig.falTier,
    });
    console.info(`[video] Cost preview (image-to-video): ${preview.summary}`);
    return generateVideoViaMediaPlane(prompt, { ...defaultConfig, imageUrl });
  }

  throw new Error('Image-to-video generation requires a MiniMax API key with I2V model access. Add MINIMAX_API_KEY to your environment.');
  const response = await fetch('/api/v1/providers/video/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt, imageUrl, ...resolved }),
  });
  const payload = (await response.json().catch(() => ({}))) as VideoGenerationResult & { message?: string };
  if (!response.ok) throw new Error(payload.message || `Image-to-video generation failed (${response.status}).`);
  return payload;
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
export async function extendVideo(videoId: string, additionalSeconds: number): Promise<GeneratedVideo> {
  throw new Error(
    `Video extension is unavailable for video '${videoId}'. No validated provider integration exists for extending clips by ${additionalSeconds} seconds.`,
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

export async function editVideo(videoId: string, operations: VideoEditOperation[]): Promise<GeneratedVideo> {
  throw new Error(
    `Video editing is unavailable for video '${videoId}'. No validated provider integration exists for ${operations.length} requested operation(s).`,
  );
}

function isVideoProviderAvailable(
  entry: (typeof VIDEO_PROVIDERS)[VideoProviderId],
  keys?: VideoProviderApiKeys,
): boolean {
  if (entry.type === 'free') return true;
  if (entry.type === 'local') return true;
  if (!keys) return false;
  switch (entry.id) {
    case 'pollinations':
      return true; // optional key
    case 'replicate':
      return Boolean(keys.replicate);
    case 'fal':
      return Boolean(keys.fal);
    case 'huggingface':
      return Boolean(keys.huggingface);
    case 'minimax':
      return Boolean(keys.minimax);
    case 'kling':
      return Boolean(keys.kling);
    case 'runway':
      return Boolean(keys.runway);
    case 'pika':
      return Boolean(keys.pika);
    case 'luma':
      return Boolean(keys.luma);
    case 'stability':
      return Boolean(keys.stability);
    case 'custom':
      return Boolean(keys.custom && keys.customBaseURL);
    default:
      return false;
  }
}

/**
 * Return the list of supported video providers.
 */
export function getVideoProviders(keys?: VideoProviderApiKeys): VideoProviderInfo[] {
  return Object.entries(VIDEO_PROVIDERS).map(([id, info]) => ({
    id: id as VideoProviderId,
    name: info.name,
    type: info.type,
    defaultModel: info.models[0]?.id ?? '',
    description: info.description,
    isAvailable: isVideoProviderAvailable(info, keys),
    isDefault: id === 'pollinations',
  }));
}

// API Providers Registry for Video Mode
export const VIDEO_PROVIDERS = {
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
export const VIDEO_PROVIDERS: Record<
  VideoProviderId,
  {
    id: VideoProviderId;
    name: string;
    url: string;
    type: VideoProviderInfo['type'];
    description: string;
    models: Array<{ id: string; type: string; cost: number | null; duration: number; features?: string[] }>;
  }
> = {
  pollinations: {
    id: 'pollinations',
    name: 'Pollinations',
    url: 'gen.pollinations.ai',
    type: 'free',
    description: 'Free text/image/video generation via Pollinations. Optional key for higher limits.',
    models: [
      { id: 'pollinations-video', type: 'text-to-video', cost: 0, duration: 6 },
      { id: 'pollinations-image-to-video', type: 'image-to-video', cost: 0, duration: 6 },
    ],
  },
  replicate: {
    id: 'replicate',
    name: 'Replicate',
    url: 'replicate.com',
    type: 'api_key',
    description: 'Model aggregator (Wan, CogVideoX, Mochi, etc.).',
    models: [
      { id: 'wan-2.1', type: 'text-to-video', cost: null, duration: 6 },
      { id: 'cogvideox-5b', type: 'text-to-video', cost: null, duration: 6 },
      { id: 'mochi-1', type: 'text-to-video', cost: null, duration: 6 },
    ],
  },
  fal: {
    id: 'fal',
    name: 'fal.ai',
    url: 'fal.ai',
    type: 'api_key',
    description: 'Fast video inference API hosting many models.',
    models: [
      { id: 'fal-luma', type: 'text-to-video', cost: null, duration: 5 },
      { id: 'fal-kling', type: 'text-to-video', cost: null, duration: 10 },
      { id: 'fal-runway', type: 'text-to-video', cost: null, duration: 10 },
    ],
  },
  huggingface: {
    id: 'huggingface',
    name: 'HuggingFace Inference',
    url: 'huggingface.co',
    type: 'api_key',
    description: 'Free read-token access to open video models like Zeroscope.',
    models: [
      { id: 'zeroscope', type: 'text-to-video', cost: null, duration: 4 },
      { id: 'stable-video-diffusion', type: 'image-to-video', cost: null, duration: 4 },
    ],
  },
  minimax: {
    id: 'minimax',
    name: 'MiniMax',
    url: 'api.minimax.chat',
    type: 'api_key',
    description: 'Hailuo video models with text-to-video and image-to-video support.',
    models: [
      { id: 'T2V-01', type: 'text-to-video', cost: 0.43, duration: 6 },
      { id: 'T2V-01-Director', type: 'text-to-video', cost: 0.43, duration: 6, features: ['camera-control'] },
      { id: 'I2V-01', type: 'image-to-video', cost: 0.43, duration: 6 },
      { id: 'I2V-01-Director', type: 'image-to-video', cost: 0.43, duration: 6, features: ['camera-control'] },
      { id: 'S2V-01', type: 'subject-reference', cost: 0.65, duration: 6 },
      { id: 'I2V-01-live', type: 'live-style', cost: 0.43, duration: 6 },
    ],
  },
  kling: {
    id: 'kling',
    name: 'Kling',
    url: 'klingai.com',
    type: 'api_key',
    description: 'High-quality cinematic video generation.',
    models: [
      { id: 'kling-1.5', type: 'text-to-video', cost: null, duration: 5 },
      { id: 'kling-1.5-pro', type: 'text-to-video', cost: null, duration: 10 },
    ],
  },
  runway: {
    id: 'runway',
    name: 'Runway',
    url: 'runwayml.com',
    type: 'api_key',
    description: 'Gen-2/Gen-3 video generation and motion controls.',
    models: [
      { id: 'gen-2', type: 'text-to-video', cost: null, duration: 4 },
      { id: 'gen-3', type: 'text-to-video', cost: null, duration: 10 },
    ],
  },
  pika: {
    id: 'pika',
    name: 'Pika Labs',
    url: 'pika.art',
    type: 'api_key',
    description: 'Short-form stylized video clips.',
    models: [{ id: 'pika-1.0', type: 'text-to-video', cost: null, duration: 3 }],
  },
  luma: {
    id: 'luma',
    name: 'Luma Dream Machine',
    url: 'lumalabs.ai',
    type: 'api_key',
    description: 'Fast, high-fidelity video generation.',
    models: [{ id: 'dream-machine-1', type: 'text-to-video', cost: null, duration: 5 }],
  },
  stability: {
    id: 'stability',
    name: 'Stability AI',
    url: 'stability.ai',
    type: 'api_key',
    description: 'Stable Video Diffusion image-to-video.',
    models: [
      { id: 'svd', type: 'image-to-video', cost: null, duration: 4 },
      { id: 'svd-xt', type: 'image-to-video', cost: null, duration: 25 },
    ],
  },
  custom: {
    id: 'custom',
    name: 'Custom',
    url: '',
    type: 'api_key',
    description: 'Bring your own OpenAI-compatible video endpoint.',
    models: [{ id: 'custom', type: 'text-to-video', cost: null, duration: 6 }],
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
