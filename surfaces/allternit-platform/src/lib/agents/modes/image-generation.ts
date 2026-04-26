/**
 * Image Generation Mode Service
 * 
 * FREE DEFAULT: Pollinations.ai (no API key, no signup)
 * PAID OPTIONS: DALL-E 3, Stability AI, Midjourney (user choice)
 * 
 * Strategy: Zero setup for non-technical users
 */

export interface ImageGenerationConfig {
  provider: 'pollinations' | 'openai' | 'stability' | 'midjourney';
  model?: string;
  size?: '1024x1024' | '1024x1792' | '1792x1024' | string;
  quality?: 'standard' | 'hd';
  style?: 'vivid' | 'natural' | 'photographic' | 'artistic';
  n?: number; // Number of images (1-4)
  seed?: number; // For reproducibility
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
 * 2. Fall back to Pollinations (FREE) if no preference
 * 3. Show setup UI if paid provider selected but no API key
 */
export async function generateImages(
  prompt: string,
  config: Partial<ImageGenerationConfig> = {},
  userSettings?: {
    preferredProvider?: 'pollinations' | 'openai' | 'stability' | 'midjourney';
    apiKeys?: {
      openai?: string;
      stability?: string;
    };
  }
): Promise<ImageGenerationResult> {
  // Determine which provider to use
  const provider = userSettings?.preferredProvider || config.provider || 'pollinations';

  switch (provider) {
    case 'openai':
      if (!userSettings?.apiKeys?.openai) {
        throw new Error('OpenAI API key not configured. Please add your API key in settings or use Pollinations (free).');
      }
      return generateImagesOpenAI(prompt, userSettings.apiKeys.openai, config as any);

    case 'stability':
      throw new Error('Stability AI not yet implemented');

    case 'midjourney':
      throw new Error('Midjourney integration requires Discord setup. Use Pollinations or OpenAI instead.');

    case 'pollinations':
    default:
      // FREE - works immediately, no setup
      return generateImagesPollinations(prompt, {
        width: parseSize(config.size || '1024x1024').width,
        height: parseSize(config.size || '1024x1024').height,
        n: config.n || 1,
        seed: config.seed,
      });
  }
}

/**
 * Generate variations of an image
 */
export async function generateVariations(
  imageId: string,
  prompt: string,
  n: number = 4,
  userSettings?: any
): Promise<ImageGenerationResult> {
  // For Pollinations, just generate new images with different seeds
  if (imageId.startsWith('pollinations_') || !userSettings?.preferredProvider) {
    return generateVariationsPollinations(imageId, prompt, n);
  }

  // For OpenAI, use their variations endpoint (DALL-E 2 only)
  // TODO: Implement OpenAI variations
  return generateVariationsPollinations(imageId, prompt, n);
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
export function getImageProviders(userSettings?: any) {
  return [
    {
      id: 'pollinations',
      name: 'Pollinations.ai',
      description: 'Free, no signup required',
      type: 'free',
      isAvailable: true,
      isDefault: !userSettings?.preferredProvider,
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
      description: 'Coming soon',
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
