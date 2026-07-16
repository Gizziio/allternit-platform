/**
 * Image Generation Mode Service
 * 
 * LOCAL DEFAULT: the licensed Bonsai companion on loopback.
 * Hosted providers are explicit opt-in choices and are never silent fallbacks.
 */

import { bonsaiWebGpuProvider } from '@/lib/local-models/providers/bonsai-webgpu';

export interface ImageGenerationConfig {
  provider: 'bonsai-local' | 'bonsai-webgpu' | 'pollinations' | 'openai' | 'stability' | 'midjourney';
  model?: string;
  size?: '1024x1024' | '1024x1792' | '1792x1024' | string;
  quality?: 'standard' | 'hd';
  style?: 'vivid' | 'natural' | 'photographic' | 'artistic';
  n?: number; // Number of images (1-4)
  seed?: number; // For reproducibility
}

const BONSAI_LOCAL_URL = 'http://127.0.0.1:8000';

export async function checkBonsaiLocal(signal?: AbortSignal): Promise<boolean> {
  try {
    const response = await fetch(`${BONSAI_LOCAL_URL}/backends`, { signal });
    if (!response.ok) return false;
    const status = await response.json() as { healthy?: boolean };
    return status.healthy === true;
  } catch {
    return false;
  }
}

export async function generateImagesBonsaiLocal(
  prompt: string,
  options: { width?: number; height?: number; seed?: number; n?: number; signal?: AbortSignal } = {},
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

export async function generateImagesBonsaiWebGPU(
  prompt: string,
  options: { width?: number; height?: number; seed?: number; n?: number; signal?: AbortSignal } = {},
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

interface GeneratedImage {
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
export async function generateImagesPollinations(
  prompt: string,
  options: {
    width?: number;
    height?: number;
    seed?: number;
    n?: number;
  } = {}
): Promise<ImageGenerationResult> {
  const { 
    width = 1024, 
    height = 1024, 
    seed = Math.floor(Math.random() * 1000000),
    n = 1 
  } = options;

  const images: GeneratedImage[] = [];

  // Generate n images with different seeds
  for (let i = 0; i < n; i++) {
    const imageSeed = seed + i;
    const encodedPrompt = encodeURIComponent(prompt);
    
    // Pollinations URL format
    const imageUrl = `https://image.pollinations.ai/prompt/${encodedPrompt}?width=${width}&height=${height}&seed=${imageSeed}&nologo=true&enhance=true`;
    
    images.push({
      id: `pollinations_${Date.now()}_${i}`,
      url: imageUrl,
      prompt,
      metadata: {
        provider: 'pollinations',
        model: 'flux', // Pollinations uses FLUX by default
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
    config: {
      provider: 'pollinations',
      size: `${width}x${height}`,
      seed,
      n,
    },
    usage: {
      cost: 0, // FREE
      credits: 0,
    },
  };
}

/**
 * Generate variations using Pollinations
 * Each variation gets a different seed
 */
export async function generateVariationsPollinations(
  baseImageId: string,
  prompt: string,
  n: number = 4
): Promise<ImageGenerationResult> {
  // Generate with different random seeds
  return generateImagesPollinations(prompt, { n });
}

// ==========================================
// PAID PROVIDER: OpenAI DALL-E 3
// ==========================================

export async function generateImagesOpenAI(
  prompt: string,
  apiKey: string,
  options: {
    model?: 'dall-e-2' | 'dall-e-3';
    size?: '1024x1024' | '1792x1024' | '1024x1792';
    quality?: 'standard' | 'hd';
    style?: 'vivid' | 'natural';
    n?: number;
  } = {}
): Promise<ImageGenerationResult> {
  const {
    model = 'dall-e-3',
    size = '1024x1024',
    quality = 'standard',
    style = 'vivid',
    n = 1,
  } = options;

  const response = await fetch('https://api.openai.com/v1/images/generations', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      prompt,
      n,
      size,
      quality,
      style,
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message || 'Failed to generate images');
  }

  const data = await response.json();

  const images: GeneratedImage[] = data.data.map((img: any, index: number) => ({
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

  // Calculate approximate cost
  const costPerImage = model === 'dall-e-3' 
    ? (quality === 'hd' ? 0.08 : 0.04)
    : 0.02;

  return {
    images,
    prompt,
    config: {
      provider: 'openai',
      model,
      size,
      quality,
      style,
      n,
    },
    usage: {
      cost: costPerImage * n,
    },
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
  prompt: string,
  config: Partial<ImageGenerationConfig> = {},
  userSettings?: {
    preferredProvider?: ImageGenerationConfig['provider'];
    apiKeys?: {
      openai?: string;
      stability?: string;
    };
  }
): Promise<ImageGenerationResult> {
  // Determine which provider to use
  const provider = userSettings?.preferredProvider || config.provider || 'bonsai-local';

  switch (provider) {
    case 'bonsai-local': {
      const { width, height } = parseSize(config.size || '1024x1024');
      return generateImagesBonsaiLocal(prompt, { width, height, n: config.n || 1, seed: config.seed });
    }
    case 'bonsai-webgpu': {
      const { width, height } = parseSize(config.size || '1024x1024');
      return generateImagesBonsaiWebGPU(prompt, { width, height, n: config.n || 1, seed: config.seed });
    }
    case 'openai':
      if (!userSettings?.apiKeys?.openai) {
        throw new Error('OpenAI was selected but no API key is configured. Select Local Bonsai or add an API key.');
      }
      return generateImagesOpenAI(prompt, userSettings.apiKeys.openai, config as any);

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

    default:
      // Unknown provider values resolve to the local default, never to a hosted one.
      return generateImagesBonsaiLocal(prompt, {
        width: parseSize(config.size || '1024x1024').width,
        height: parseSize(config.size || '1024x1024').height,
        n: config.n || 1,
        seed: config.seed,
      });
  }
}

/**
 * Generate variations of an image
 *
 * LOCAL DEFAULT: variations run on the Bonsai companion. Pollinations is used
 * only when it was explicitly selected, or when the base image itself came
 * from an explicit Pollinations generation.
 */
export async function generateVariations(
  imageId: string,
  prompt: string,
  n: number = 4,
  userSettings?: {
    preferredProvider?: ImageGenerationConfig['provider'];
  }
): Promise<ImageGenerationResult> {
  const provider = userSettings?.preferredProvider || 'bonsai-local';

  if (provider === 'pollinations' || imageId.startsWith('pollinations_')) {
    return generateVariationsPollinations(imageId, prompt, n);
  }

  if (provider !== 'bonsai-local') {
    throw new Error(
      `Variations are not supported for provider "${provider}". Select Local Bonsai or explicitly choose Pollinations.`,
    );
  }

  // Local variations: same prompt, fresh random base seed so each run differs.
  return generateImagesBonsaiLocal(prompt, {
    n,
    seed: Math.floor(Math.random() * 1000000),
  });
}

// ==========================================
// UTILITIES
// ==========================================

function parseSize(size: string): { width: number; height: number } {
  const [width, height] = size.split('x').map(Number);
  return { width: width || 1024, height: height || 1024 };
}

/**
 * Get available providers with their setup status
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
      id: 'stability',
      name: 'Stability AI',
      description: 'Not yet integrated — use Local Bonsai or OpenAI',
      type: 'api_key',
      isAvailable: false,
      isDefault: false,
    },
    {
      id: 'midjourney',
      name: 'Midjourney',
      description: 'Requires Discord setup',
      type: 'subscription',
      isAvailable: false,
      isDefault: false,
    },
  ];
}

// ==========================================
// EXPORTS
// ==========================================

// Functions are exported at their definition above
