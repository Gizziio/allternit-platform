/**
 * Image Generation Mode Service
 *
 * Provider registry for text-to-image generation.
 *
 * Defaults to Pollinations.ai (free, no signup, no local compute). Local
 * Bonsai paths remain explicit opt-ins so the plugin never fails because a
 * companion service is not running. API-key providers are opt-ins stored in
 * `allternit_image_api_keys`.
 */

import { bonsaiWebGpuProvider } from '@/lib/local-models/providers/bonsai-webgpu';
import { previewImageCost, type ImageProviderId } from './media-cost';

export type ImageProviderId =
  | 'pollinations'
  | 'cloudflare'
  | 'huggingface'
  | 'nvidia'
  | 'gemini-nano-banana'
  | 'seed-dance'
  | 'openai'
  | 'bonsai-local'
  | 'bonsai-webgpu';

export interface ImageGenerationConfig {
  provider: 'bonsai-local' | 'bonsai-webgpu' | 'pollinations' | 'openai' | 'gpt-image' | 'flux-fal' | 'stability' | 'midjourney';
  provider: ImageProviderId;
  model?: string;
  size?: '1024x1024' | '1024x1792' | '1792x1024' | '1024x1536' | '1536x1024' | string;
  quality?: 'standard' | 'hd' | 'low' | 'medium' | 'high';
  style?: 'vivid' | 'natural' | 'photographic' | 'artistic';
  n?: number; // Number of images (1-4)
  seed?: number; // For reproducibility
}
export interface ImageProviderApiKeys {
  openai?: string;
  cloudflareAccountId?: string;
  cloudflareToken?: string;
  huggingface?: string;
  nvidia?: string;
  google?: string;
  seedDance?: string;
}

export interface ImageProviderSettings {
  preferredProvider?: ImageProviderId;
  apiKeys?: ImageProviderApiKeys;
}

const BONSAI_LOCAL_URL = 'http://127.0.0.1:8000';

export async function checkBonsaiLocal(signal?: AbortSignal): Promise<boolean> {
  try {
    const response = await fetch(`${BONSAI_LOCAL_URL}/backends`, { signal });
    if (!response.ok) return false;
    const status = (await response.json()) as { healthy?: boolean };
    return status.healthy === true;
  } catch {
    return false;
  }
}

export interface GeneratedImage {
  id: string;
  url: string;
  prompt: string;
  revisedPrompt?: string;
  metadata: {
    provider: string;
    model: string;
    size: string;
    quality: string;
    seed?: number;
    createdAt: string;
  };
  variations?: string[];
}

export interface ImageGenerationResult {
  images: GeneratedImage[];
  prompt: string;
  config: ImageGenerationConfig;
  usage?: {
    cost?: number; // 0 for free providers
    credits?: number;
  };
}

export interface ImageProviderInfo {
  id: ImageProviderId;
  name: string;
  description: string;
  type: 'local' | 'local-unverified' | 'free' | 'api_key' | 'subscription';
  isAvailable: boolean;
  isDefault: boolean;
}

export interface ImageGenerateOptions {
  width?: number;
  height?: number;
  seed?: number;
  n?: number;
  signal?: AbortSignal;
  model?: string;
  quality?: ImageGenerationConfig['quality'];
  style?: ImageGenerationConfig['style'];
}

export interface ImageProviderEntry {
  id: ImageProviderId;
  name: string;
  description: string;
  type: ImageProviderInfo['type'];
  defaultModel: string;
  isAvailable: (settings: ImageProviderSettings) => boolean;
  generate: (
    prompt: string,
    options: ImageGenerateOptions,
    settings: ImageProviderSettings,
  ) => Promise<ImageGenerationResult>;
}

// ==========================================
// LOCAL PROVIDERS
// ==========================================

export async function generateImagesBonsaiLocal(
  prompt: string,
  options: ImageGenerateOptions = {},
): Promise<ImageGenerationResult> {
  const { width = 1024, height = 1024, seed = 42, n = 1, signal } = options;
  const images: GeneratedImage[] = [];

  for (let index = 0; index < n; index += 1) {
    let response: Response;
    try {
      response = await fetch(`${BONSAI_LOCAL_URL}/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt,
          seed: seed + index,
          steps: 4,
          guidance: 1,
          backend: 'bonsai-ternary-mlx',
          width,
          height,
        }),
        signal,
      });
    } catch (error) {
      throw new Error(
        `The local Bonsai service is unavailable at ${BONSAI_LOCAL_URL}. Start the packaged Allternit Bonsai companion and install its model before using Image mode.`,
        { cause: error },
      );
    }
    if (!response.ok) {
      const detail = await response.text().catch(() => '');
      throw new Error(`Local Bonsai generation failed (${response.status})${detail ? `: ${detail}` : ''}`);
    }
    const blob = await response.blob();
    if (blob.type && blob.type !== 'image/png') {
      throw new Error(`Local Bonsai returned ${blob.type}; expected image/png.`);
    }
    images.push({
      id: `bonsai_local_${seed + index}`,
      url: URL.createObjectURL(blob),
      prompt,
      metadata: {
        provider: 'bonsai-local',
        model: 'prism-ml/bonsai-image-ternary-4B-mlx-2bit',
        size: `${width}x${height}`,
        quality: 'local',
        seed: seed + index,
        createdAt: new Date().toISOString(),
      },
    });
  }

  return {
    images,
    prompt,
    config: { provider: 'bonsai-local', size: `${width}x${height}`, seed, n },
    usage: { cost: 0, credits: 0 },
  };
}

async function generateImagesBonsaiWebGPU(
  prompt: string,
  options: ImageGenerateOptions = {},
): Promise<ImageGenerationResult> {
  const { width = 1024, height = 1024, seed = 42, n = 1, signal } = options;
  const images: GeneratedImage[] = [];
  for (let index = 0; index < n; index += 1) {
    const imageSeed = seed + index;
    const { blob } = await bonsaiWebGpuProvider.generateImage(prompt, { width, height, seed: imageSeed, signal });
    images.push({
      id: `bonsai_webgpu_${imageSeed}`,
      url: URL.createObjectURL(blob),
      prompt,
      metadata: {
        provider: 'bonsai-webgpu',
        model: 'prism-ml/bonsai-image-ternary-4B-mlx-2bit',
        size: `${width}x${height}`,
        quality: 'local-webgpu',
        seed: imageSeed,
        createdAt: new Date().toISOString(),
      },
    });
  }
  return {
    images,
    prompt,
    config: { provider: 'bonsai-webgpu', size: `${width}x${height}`, seed, n },
    usage: { cost: 0, credits: 0 },
  };
}

// ==========================================
// FREE PROVIDER: Pollinations.ai
// ==========================================

/**
 * Pollinations.ai - Completely FREE image generation
 *
 * No API key required
 * No signup required
 * No rate limits for reasonable use
 * Private (prompts not stored)
 *
 * @see https://pollinations.ai
 */
async function generateImagesPollinations(
  prompt: string,
  options: ImageGenerateOptions = {},
): Promise<ImageGenerationResult> {
  const { width = 1024, height = 1024, seed = Math.floor(Math.random() * 1000000), n = 1 } = options;
  const images: GeneratedImage[] = [];

  for (let i = 0; i < n; i++) {
    const imageSeed = seed + i;
    const encodedPrompt = encodeURIComponent(prompt);
    const imageUrl = `https://image.pollinations.ai/prompt/${encodedPrompt}?width=${width}&height=${height}&seed=${imageSeed}&nologo=true&enhance=true`;
    images.push({
      id: `pollinations_${Date.now()}_${i}`,
      url: imageUrl,
      prompt,
      metadata: {
        provider: 'pollinations',
        model: 'flux',
        size: `${width}x${height}`,
        quality: 'standard',
        seed: imageSeed,
        createdAt: new Date().toISOString(),
      },
    });
  }

  return {
    images,
    prompt,
    config: { provider: 'pollinations', size: `${width}x${height}`, seed, n },
    usage: { cost: 0, credits: 0 },
  };
}

// ==========================================
// API-KEY PROVIDERS
// ==========================================

async function generateImagesOpenAI(
  prompt: string,
  apiKey: string,
  options: ImageGenerateOptions = {},
): Promise<ImageGenerationResult> {
  const model = options.model ?? 'dall-e-3';
  const size = options.width && options.height ? (`${options.width}x${options.height}` as const) : '1024x1024';
  const quality = options.quality ?? 'standard';
  const style = options.style ?? 'vivid';
  const n = options.n ?? 1;

  const response = await fetch('https://api.openai.com/v1/images/generations', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ model, prompt, n, size, quality, style }),
    signal: options.signal,
  });

  if (!response.ok) {
    const error = (await response.json().catch(() => ({}))) as { error?: { message?: string } };
    throw new Error(error.error?.message || 'Failed to generate images');
  }

  const data = (await response.json()) as { data: Array<{ url: string; revised_prompt?: string }> };
  const images: GeneratedImage[] = data.data.map((img, index) => ({
    id: `openai_${Date.now()}_${index}`,
    url: img.url,
    prompt,
    revisedPrompt: img.revised_prompt,
    metadata: {
      provider: 'openai',
      model,
      size,
      quality,
      createdAt: new Date().toISOString(),
    },
  }));

  const costPerImage = model === 'dall-e-3' ? (quality === 'hd' ? 0.08 : 0.04) : 0.02;

  return {
    images,
    prompt,
    config: { provider: 'openai', model, size, quality, style, n },
    usage: { cost: costPerImage * n },
  };
}

// ==========================================
// MEDIA PLANE PROVIDERS: gpt-image + FLUX-via-fal
// ==========================================
//
// Metered hosted providers run server-side through the allternit-api media
// plane (`POST /api/v1/media/image/generate`). Keys never reach the browser:
// the API resolves the caller's V134 BYOK credential (provider `openai` or
// `fal`) or the platform-funded env lane (flag-gated, ships disabled).

export interface MediaPlaneImage {
  artifact_url: string;
  width?: number;
  height?: number;
}

export interface MediaPlaneImageResult {
  images: MediaPlaneImage[];
  estimated_cost_usd?: number;
}

export async function generateImagesMediaPlane(
  prompt: string,
  config: Pick<ImageGenerationConfig, 'provider' | 'size' | 'quality' | 'n' | 'seed'>,
): Promise<ImageGenerationResult> {
  const provider = config.provider as 'gpt-image' | 'flux-fal';
  const n = Math.max(1, Math.min(4, config.n ?? 1));
  const size = config.size ?? '1024x1024';

  const response = await fetch('/api/v1/media/image/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      provider,
      prompt,
      size,
      quality: config.quality ?? (provider === 'gpt-image' ? 'medium' : undefined),
      n,
      seed: config.seed,
    }),
  });
  const payload = await response.json().catch(() => ({})) as MediaPlaneImageResult & { error?: string; message?: string };
  if (!response.ok) {
    throw new Error(payload.message || payload.error || `Image generation failed (${response.status}).`);
  }
  if (!payload.images?.length) {
    throw new Error('The image provider returned no images.');
  }

  const createdAt = new Date().toISOString();
  return {
    images: payload.images.map((img, index) => ({
      id: `${provider}_${Date.now()}_${index}`,
      url: img.artifact_url,
      prompt,
      metadata: {
        provider,
        model: provider === 'gpt-image' ? 'gpt-image-2' : 'fal-ai/flux/schnell',
        size: img.width && img.height ? `${img.width}x${img.height}` : size,
        quality: config.quality ?? 'medium',
        createdAt,
      },
    })),
    prompt,
    config: { provider, size, quality: config.quality, n },
    usage: { cost: payload.estimated_cost_usd },
  };
}

// ==========================================
// MAIN INTERFACE: Smart Provider Selection
// ==========================================

/**
 * Generate images with automatic provider selection
 * 
 * Priority:
 * 1. Use user's preferred provider if configured
 * 2. Default to the local Bonsai companion
 * 3. Never send a prompt to a hosted provider without explicit selection
 */
export async function generateImages(
async function generateImagesCloudflare(
  prompt: string,
  accountId: string,
  token: string,
  options: ImageGenerateOptions = {},
): Promise<ImageGenerationResult> {
  const { width = 1024, height = 1024, seed = 42, n = 1, signal, model = '@cf/black-forest-labs/flux-1-schnell' } = options;
  const images: GeneratedImage[] = [];

  for (let i = 0; i < n; i++) {
    const response = await fetch(`https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/${model}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ prompt, seed: seed + i }),
      signal,
    });

    if (!response.ok) {
      const detail = (await response.json().catch(() => ({}))) as { errors?: Array<{ message?: string }> };
      throw new Error(detail.errors?.[0]?.message || `Cloudflare image generation failed (${response.status})`);
    }
    case 'openai':
      if (!userSettings?.apiKeys?.openai) {
        throw new Error('OpenAI was selected but no API key is configured. Select Local Bonsai or add an API key.');
      }
      return generateImagesOpenAI(prompt, userSettings.apiKeys.openai, config as any);

    case 'gpt-image':
    case 'flux-fal': {
      // Cost preview before any metered generate (unit price × requested units).
      const preview = previewImageCost(provider as ImageProviderId, {
        quality: config.quality,
        size: config.size,
        n: config.n,
      });
      console.info(`[image] Cost preview: ${preview.summary}`);
      return generateImagesMediaPlane(prompt, {
        provider,
        size: config.size,
        quality: config.quality,
        n: config.n,
        seed: config.seed,
      });
    }

    case 'stability':
      throw new Error('Stability AI is not integrated. Select Local Bonsai or configure another explicit provider.');

    case 'midjourney':
      throw new Error('Midjourney integration requires Discord setup. Select Local Bonsai or OpenAI instead.');

    case 'pollinations':
      // Explicit opt-in: FREE hosted provider, no setup
      return generateImagesPollinations(prompt, {
        width: parseSize(config.size || '1024x1024').width,
        height: parseSize(config.size || '1024x1024').height,
        n: config.n || 1,
        seed: config.seed,
      });

    const blob = await response.blob();
    images.push({
      id: `cloudflare_${Date.now()}_${i}`,
      url: URL.createObjectURL(blob),
      prompt,
      metadata: {
        provider: 'cloudflare',
        model,
        size: `${width}x${height}`,
        quality: 'standard',
        seed: seed + i,
        createdAt: new Date().toISOString(),
      },
    });
  }

  return {
    images,
    prompt,
    config: { provider: 'cloudflare', model, size: `${width}x${height}`, seed, n },
    usage: { cost: 0, credits: 0 },
  };
}

async function generateImagesHuggingFace(
  prompt: string,
  token: string,
  options: ImageGenerateOptions = {},
): Promise<ImageGenerationResult> {
  const model = options.model ?? 'black-forest-labs/FLUX.1-schnell';
  const { width = 1024, height = 1024, seed = 42, n = 1, signal } = options;
  const images: GeneratedImage[] = [];

  for (let i = 0; i < n; i++) {
    const response = await fetch(`https://api-inference.huggingface.co/models/${model}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ inputs: prompt, seed: seed + i }),
      signal,
    });

    if (!response.ok) {
      const detail = (await response.json().catch(() => ({}))) as { error?: string };
      throw new Error(detail.error || `HuggingFace image generation failed (${response.status})`);
    }

    const blob = await response.blob();
    images.push({
      id: `huggingface_${Date.now()}_${i}`,
      url: URL.createObjectURL(blob),
      prompt,
      metadata: {
        provider: 'huggingface',
        model,
        size: `${width}x${height}`,
        quality: 'standard',
        seed: seed + i,
        createdAt: new Date().toISOString(),
      },
    });
  }

  return {
    images,
    prompt,
    config: { provider: 'huggingface', model, size: `${width}x${height}`, seed, n },
    usage: { cost: 0, credits: 0 },
  };
}

async function generateImagesNvidia(
  prompt: string,
  token: string,
  options: ImageGenerateOptions = {},
): Promise<ImageGenerationResult> {
  const model = options.model ?? 'black-forest-labs/flux-dev';
  const size = options.width && options.height ? (`${options.width}x${options.height}` as const) : '1024x1024';
  const n = options.n ?? 1;

  const response = await fetch('https://integrate.api.nvidia.com/v1/images/generations', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ model, prompt, n, size }),
    signal: options.signal,
  });

  if (!response.ok) {
    const error = (await response.json().catch(() => ({}))) as { error?: { message?: string } };
    throw new Error(error.error?.message || `NVIDIA image generation failed (${response.status})`);
  }

  const data = (await response.json()) as { data: Array<{ url: string; revised_prompt?: string }> };
  const images: GeneratedImage[] = data.data.map((img, index) => ({
    id: `nvidia_${Date.now()}_${index}`,
    url: img.url,
    prompt,
    revisedPrompt: img.revised_prompt,
    metadata: {
      provider: 'nvidia',
      model,
      size,
      quality: 'standard',
      createdAt: new Date().toISOString(),
    },
  }));

  return {
    images,
    prompt,
    config: { provider: 'nvidia', model, size, n },
    usage: { cost: 0 },
  };
}

async function generateImagesGemini(
  prompt: string,
  apiKey: string,
  options: ImageGenerateOptions = {},
): Promise<ImageGenerationResult> {
  const model = options.model ?? 'gemini-2.0-flash-exp-image-generation';
  const { width = 1024, height = 1024, seed = 42, n = 1, signal } = options;
  const images: GeneratedImage[] = [];

  for (let i = 0; i < n; i++) {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { responseModalities: ['Text', 'Image'] },
        }),
        signal,
      },
    );

    if (!response.ok) {
      const error = (await response.json().catch(() => ({}))) as { error?: { message?: string } };
      throw new Error(error.error?.message || `Gemini image generation failed (${response.status})`);
    }

    const payload = (await response.json()) as {
      candidates?: Array<{
        content?: {
          parts?: Array<{ inlineData?: { mimeType: string; data: string }; text?: string }>;
        };
      }>;
    };

    const parts = payload.candidates?.[0]?.content?.parts ?? [];
    const imagePart = parts.find((part) => part.inlineData);
    if (!imagePart?.inlineData) {
      throw new Error('Gemini returned no image data in the response');
    }

    const byteString = atob(imagePart.inlineData.data);
    const bytes = new Uint8Array(byteString.length);
    for (let k = 0; k < byteString.length; k++) bytes[k] = byteString.charCodeAt(k);
    const blob = new Blob([bytes], { type: imagePart.inlineData.mimeType || 'image/png' });

    images.push({
      id: `gemini_${Date.now()}_${i}`,
      url: URL.createObjectURL(blob),
      prompt,
      metadata: {
        provider: 'gemini-nano-banana',
        model,
        size: `${width}x${height}`,
        quality: 'standard',
        seed: seed + i,
        createdAt: new Date().toISOString(),
      },
    });
  }

  return {
    images,
    prompt,
    config: { provider: 'gemini-nano-banana', model, size: `${width}x${height}`, seed, n },
    usage: { cost: 0, credits: 0 },
  };
}

async function generateImagesSeedDance(): Promise<ImageGenerationResult> {
  throw new Error(
    'Seed.Dance / Seedance image generation requires a configured fal.ai or BytePlus ARK endpoint and API key. ' +
      'Add your endpoint to allternit_image_api_keys under seedDance and configure the runtime to route to it.',
  );
}

// ==========================================
// REGISTRY
// ==========================================

export const IMAGE_PROVIDERS: Record<ImageProviderId, ImageProviderEntry> = {
  pollinations: {
    id: 'pollinations',
    name: 'Pollinations.ai',
    description: 'Free FLUX-class images, no signup required',
    type: 'free',
    defaultModel: 'flux',
    isAvailable: () => true,
    generate: generateImagesPollinations,
  },
  cloudflare: {
    id: 'cloudflare',
    name: 'Cloudflare Workers AI',
    description: 'Free tier FLUX.1-schnell via Cloudflare account + token',
    type: 'api_key',
    defaultModel: '@cf/black-forest-labs/flux-1-schnell',
    isAvailable: (settings) => Boolean(settings.apiKeys?.cloudflareAccountId && settings.apiKeys?.cloudflareToken),
    generate: (prompt, options, settings) =>
      generateImagesCloudflare(prompt, settings.apiKeys!.cloudflareAccountId!, settings.apiKeys!.cloudflareToken!, options),
  },
  huggingface: {
    id: 'huggingface',
    name: 'HuggingFace Inference',
    description: 'Free read-token access to FLUX and other diffusion models',
    type: 'api_key',
    defaultModel: 'black-forest-labs/FLUX.1-schnell',
    isAvailable: (settings) => Boolean(settings.apiKeys?.huggingface),
    generate: (prompt, options, settings) => generateImagesHuggingFace(prompt, settings.apiKeys!.huggingface!, options),
  },
  nvidia: {
    id: 'nvidia',
    name: 'NVIDIA NIM',
    description: 'Free-trial OpenAI-compatible image generation API key',
    type: 'api_key',
    defaultModel: 'black-forest-labs/flux-dev',
    isAvailable: (settings) => Boolean(settings.apiKeys?.nvidia),
    generate: (prompt, options, settings) => generateImagesNvidia(prompt, settings.apiKeys!.nvidia!, options),
  },
  'gemini-nano-banana': {
    id: 'gemini-nano-banana',
    name: 'Gemini Nano Banana',
    description: 'Google Gemini image generation (free tier in AI Studio)',
    type: 'api_key',
    defaultModel: 'gemini-2.0-flash-exp-image-generation',
    isAvailable: (settings) => Boolean(settings.apiKeys?.google),
    generate: (prompt, options, settings) => generateImagesGemini(prompt, settings.apiKeys!.google!, options),
  },
  'seed-dance': {
    id: 'seed-dance',
    name: 'Seed.Dance / Seedance',
    description: 'Requires a configured fal.ai or BytePlus ARK endpoint and key',
    type: 'api_key',
    defaultModel: 'seedance',
    isAvailable: (settings) => Boolean(settings.apiKeys?.seedDance),
    generate: generateImagesSeedDance,
  },
  openai: {
    id: 'openai',
    name: 'DALL-E 3 (OpenAI)',
    description: 'High quality, requires API key',
    type: 'api_key',
    defaultModel: 'dall-e-3',
    isAvailable: (settings) => Boolean(settings.apiKeys?.openai),
    generate: (prompt, options, settings) => generateImagesOpenAI(prompt, settings.apiKeys!.openai!, options),
  },
  'bonsai-local': {
    id: 'bonsai-local',
    name: 'Bonsai Image 4B (Local)',
    description: 'Runs on this device through the Allternit loopback companion',
    type: 'local',
    defaultModel: 'prism-ml/bonsai-image-ternary-4B-mlx-2bit',
    isAvailable: () => true,
    generate: generateImagesBonsaiLocal,
  },
  'bonsai-webgpu': {
    id: 'bonsai-webgpu',
    name: 'Bonsai Image 4B (WebGPU)',
    description: 'Fast local GPU mode; downloads a pinned unaudited runtime after explicit consent',
    type: 'local-unverified',
    defaultModel: 'prism-ml/bonsai-image-ternary-4B-mlx-2bit',
    isAvailable: () => typeof navigator !== 'undefined' && 'gpu' in navigator,
    generate: generateImagesBonsaiWebGPU,
  },
};

// ==========================================
// MAIN INTERFACE
// ==========================================

function parseSize(size: string): { width: number; height: number } {
  const [width, height] = size.split('x').map(Number);
  return { width: width || 1024, height: height || 1024 };
}

function resolveProvider(
  config: Partial<ImageGenerationConfig>,
  settings: ImageProviderSettings = {},
): ImageProviderId {
  const requested = settings.preferredProvider || config.provider;
  if (requested) {
    if (requested in IMAGE_PROVIDERS) return requested;
    throw new Error(
      `Image provider "${requested}" is not recognized. Available: ${Object.keys(IMAGE_PROVIDERS).join(', ')}.`,
    );
  }
  return 'pollinations';
}

function assertAvailable(entry: ImageProviderEntry, settings: ImageProviderSettings): void {
  if (!entry.isAvailable(settings)) {
    throw new Error(
      `${entry.name} was selected but is not configured or available. ` +
        `Add the required API key in Settings or switch to Pollinations for free image generation.`,
    );
  }
}

/**
 * Generate images with automatic provider selection.
 *
 * Priority:
 * 1. User's preferred provider if configured and available.
 * 2. The explicit provider requested in `config.provider`.
 * 3. Pollinations.ai — free, no signup, no local compute.
 *
 * Local Bonsai and WebGPU remain explicit opt-ins so the plugin never fails
 * because a companion service is not running.
 */
function getImageProviders(userSettings?: any) {
  return [
    {
      id: 'bonsai-local',
      name: 'Bonsai Image 4B (Local)',
      description: 'Runs on this device through the Allternit loopback companion',
      type: 'local',
      isAvailable: true,
      isDefault: !userSettings?.preferredProvider || userSettings.preferredProvider === 'bonsai-local',
    },
    {
      id: 'bonsai-webgpu',
      name: 'Bonsai Image 4B (WebGPU)',
      description: 'Fast local GPU mode; downloads a pinned unaudited runtime after explicit consent',
      type: 'local-unverified',
      isAvailable: typeof navigator !== 'undefined' && 'gpu' in navigator,
      isDefault: userSettings?.preferredProvider === 'bonsai-webgpu',
    },
    {
      id: 'pollinations',
      name: 'Pollinations.ai',
      description: 'Free, no signup required',
      type: 'free',
      isAvailable: true,
      isDefault: userSettings?.preferredProvider === 'pollinations',
    },
    {
      id: 'openai',
      name: 'DALL-E 3 (OpenAI)',
      description: 'High quality, requires API key',
      type: 'api_key',
      isAvailable: !!userSettings?.apiKeys?.openai,
      isDefault: userSettings?.preferredProvider === 'openai',
    },
    {
      id: 'gpt-image',
      name: 'gpt-image (OpenAI)',
      description: 'Metered; runs through the Allternit media plane with your own OpenAI key (BYOK) or the operator-funded lane',
      type: 'api_key',
      isAvailable: true,
      isDefault: userSettings?.preferredProvider === 'gpt-image',
    },
    {
      id: 'flux-fal',
      name: 'FLUX schnell (fal)',
      description: 'Burst/draft images, metered per megapixel; runs through the Allternit media plane with your own fal key (BYOK) or the operator-funded lane',
      type: 'api_key',
      isAvailable: true,
      isDefault: userSettings?.preferredProvider === 'flux-fal',
    },
    {
      id: 'stability',
      name: 'Stability AI',
      description: 'Not yet integrated — use Local Bonsai or OpenAI',
      type: 'api_key',
      isAvailable: false,
      isDefault: false,
    },
export async function generateImages(
  prompt: string,
  config: Partial<ImageGenerationConfig> = {},
  userSettings: ImageProviderSettings = {},
): Promise<ImageGenerationResult> {
  const providerId = resolveProvider(config, userSettings);
  const entry = IMAGE_PROVIDERS[providerId];
  assertAvailable(entry, userSettings);

  const { width, height } = parseSize(config.size || '1024x1024');
  const n = config.n || 1;

  return entry.generate(
    prompt,
    {
      width,
      height,
      n,
      seed: config.seed,
      signal: undefined,
      model: config.model,
      quality: config.quality,
      style: config.style,
    },
    userSettings,
  );
}

/**
 * Generate variations of an image.
 *
 * Default uses the active provider. Pollinations is used when it was selected
 * or when the base image itself came from Pollinations.
 */
export async function generateVariations(
  imageId: string,
  prompt: string,
  n: number = 4,
  userSettings: ImageProviderSettings = {},
): Promise<ImageGenerationResult> {
  const providerId = userSettings.preferredProvider || (imageId.startsWith('pollinations_') ? 'pollinations' : undefined) || 'pollinations';
  const entry = IMAGE_PROVIDERS[providerId];
  assertAvailable(entry, userSettings);

  return entry.generate(
    prompt,
    { n, seed: Math.floor(Math.random() * 1000000) },
    userSettings,
  );
}

/**
 * Return available image providers with their setup status.
 */
export function getImageProviders(userSettings: ImageProviderSettings = {}): ImageProviderInfo[] {
  const preferred = userSettings.preferredProvider;
  return Object.values(IMAGE_PROVIDERS).map((entry) => ({
    id: entry.id,
    name: entry.name,
    description: entry.description,
    type: entry.type,
    isAvailable: entry.isAvailable(userSettings),
    isDefault: preferred ? preferred === entry.id : entry.id === 'pollinations',
  }));
}
