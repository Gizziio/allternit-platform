/**
 * Video Generation Mode Service
 *
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
  resolution?: '768p' | '1080p';
  fps?: 24 | 30 | 60;
  aspectRatio?: '16:9' | '9:16' | '1:1' | '4:3';
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

  const response = await fetch('/api/v1/providers/video/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt, imageUrl, ...resolved }),
  });
  const payload = (await response.json().catch(() => ({}))) as VideoGenerationResult & { message?: string };
  if (!response.ok) throw new Error(payload.message || `Image-to-video generation failed (${response.status}).`);
  return payload;
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
