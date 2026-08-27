/**
 * Image Plugin
 * 
 * Local-first image generation via the packaged Bonsai companion.
 * Similar to: DALL-E, Midjourney, Stable Diffusion
 */

import type { 
  ModePlugin, 
  PluginConfig, 
  PluginInput, 
  PluginOutput, 
  PluginCapability,
  PluginEvent,
  PluginEventHandler 
} from '../types';
import {
  checkBonsaiLocal,
  generateImages,
  IMAGE_PROVIDERS,
  type ImageGenerationConfig,
  type ImageGenerationResult,
  type ImageProviderApiKeys,
} from '@/lib/agents/modes/image-generation';
import {
  BONSAI_WEBGPU_CONSENT,
  BONSAI_WEBGPU_PROVIDER_PREFERENCE,
  bonsaiWebGpuProvider,
} from '@/lib/local-models/providers/bonsai-webgpu';

const IMAGE_PROVIDER_PREFERENCE = 'allternit_image_provider_preference';
const IMAGE_API_KEYS = 'allternit_image_api_keys';

type ImageProviderId = ImageGenerationConfig['provider'];

export interface ImageConfig extends PluginConfig {
  defaultProvider?: ImageProviderId;
  defaultSize?: string;
  defaultN?: number;
}

class ImagePlugin implements ModePlugin {
  readonly id = 'image';
  readonly name = 'Image';
  readonly version = '1.0.0';
  readonly capabilities: PluginCapability[] = [
    'text-to-image',
    'image-variations',
    'style-transfer',
    'upscale',
    'inpainting',
    'outpainting',
  ];

  isInitialized = false;
  isExecuting = false;
  config: ImageConfig = {
    defaultProvider: 'pollinations',
    defaultSize: '1024x1024',
    defaultN: 4,
  };

  private eventHandlers: Map<string, Set<PluginEventHandler>> = new Map();
  private abortController: AbortController | null = null;

  on(event: string, handler: PluginEventHandler): void {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, new Set());
    }
    this.eventHandlers.get(event)!.add(handler);
  }

  off(event: string, handler: PluginEventHandler): void {
    this.eventHandlers.get(event)?.delete(handler);
  }

  private emit(event: PluginEvent): void {
    this.eventHandlers.get(event.type)?.forEach(handler => {
      try {
        handler(event);
      } catch (err) {
        console.error(`[ImagePlugin] Event handler error:`, err);
      }
    });
  }

  async initialize(config?: ImageConfig): Promise<void> {
    if (config) {
      this.config = { ...this.config, ...config };
    }
    
    this.isInitialized = true;
    this.emit({ type: 'initialized', timestamp: Date.now() });
    console.debug('[ImagePlugin] Initialized with local Bonsai');
  }

  async destroy(): Promise<void> {
    if (this.abortController) {
      this.abortController.abort();
    }
    this.isInitialized = false;
    this.eventHandlers.clear();
    this.emit({ type: 'destroyed', timestamp: Date.now() });
  }

  async execute(input: PluginInput): Promise<PluginOutput> {
    if (!this.isInitialized) {
      throw new Error('Plugin not initialized');
    }

    this.isExecuting = true;
    this.abortController = new AbortController();
    
    this.emit({ type: 'started', timestamp: Date.now() });

    try {
      const mode = input.options?.mode as string || 'generate';

      switch (mode) {
        case 'generate':
          return await this.generateImages(input.prompt, input.options);
        case 'variations':
          return await this.generateVariations(
            input.options?.imageId as string,
            input.prompt
          );
        case 'upscale':
          return await this.upscaleImage(input.options?.imageId as string);
        default:
          return await this.generateImages(input.prompt, input.options);
      }

    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      
      const output: PluginOutput = {
        success: false,
        error: {
          message: error.message,
          code: 'IMAGE_ERROR',
          recoverable: false,
        },
      };

      this.emit({ type: 'error', payload: error, timestamp: Date.now() });
      return output;

    } finally {
      this.isExecuting = false;
      this.abortController = null;
    }
  }

  async cancel(): Promise<void> {
    if (this.abortController) {
      this.abortController.abort();
    }
  }

  hasCapability(capability: PluginCapability): boolean {
    return this.capabilities.includes(capability);
  }

  async health(): Promise<{ healthy: boolean; message?: string }> {
    const provider = this.selectedProvider();
    const apiKeys = this.readApiKeys();
    const entry = IMAGE_PROVIDERS[provider];

    if (provider === 'pollinations') {
      return { healthy: true, message: 'Pollinations.ai image generation is available.' };
    }

    if (provider === 'bonsai-webgpu') {
      const status = await bonsaiWebGpuProvider.connect();
      return { healthy: status.connected, message: status.error ?? 'Bonsai WebGPU is available.' };
    }

    if (provider === 'bonsai-local') {
      const healthy = await checkBonsaiLocal();
      return {
        healthy,
        message: healthy ? 'Local Bonsai companion is ready.' : 'Local Bonsai companion is not running or its model is unavailable.',
      };
    }

    const available = entry?.isAvailable({ preferredProvider: provider, apiKeys }) ?? false;
    return {
      healthy: available,
      message: available
        ? `${entry?.name ?? provider} is configured.`
        : `${entry?.name ?? provider} was selected but no API key is configured.`,
    };
  }

  private async generateImages(prompt: string, inputOptions?: Record<string, unknown>): Promise<PluginOutput> {
    const provider = this.selectedProvider(inputOptions?.provider as ImageProviderId | undefined);
    this.emit({
      type: 'progress',
      payload: { step: 'generating', message: this.progressMessage(provider) },
      timestamp: Date.now()
    });

    const requestedSize = (inputOptions?.size as string) || this.config.defaultSize || '1024x1024';
    const requestedStyle = (inputOptions?.style as string) || undefined;
    const requestedN = typeof inputOptions?.n === 'number' ? inputOptions.n : (this.config.defaultN ?? 1);

    const promptWithStyle = requestedStyle ? `${requestedStyle} image style. ${prompt}` : prompt;

    const result = await generateImages(
      promptWithStyle,
      {
        provider,
        n: requestedN,
        size: requestedSize as '1024x1024' | '1024x1792' | '1792x1024' | string,
        style: requestedStyle as any,
      },
      { preferredProvider: provider, apiKeys: this.readApiKeys() }
    );

    return {
      success: true,
      content: this.formatImageOutput(result),
      artifacts: result.images.map(img => ({
        type: 'image',
        url: img.url,
        name: `generated-${img.id}.png`,
        metadata: { 
          provider: img.metadata.provider,
          prompt: img.prompt,
          seed: img.metadata.seed,
        },
      })),
    };
  }

  private async generateVariations(imageId: string, prompt: string): Promise<PluginOutput> {
    this.emit({
      type: 'progress',
      payload: { step: 'generating', message: 'Creating variations...' },
      timestamp: Date.now()
    });

    const provider = this.selectedProvider();
    const result = await generateImages(
      prompt,
      { provider, n: this.config.defaultN ?? 4 },
      { preferredProvider: provider, apiKeys: this.readApiKeys() },
    );
    return {
      success: true,
      content: this.formatImageOutput(result),
      artifacts: result.images.map((img) => ({
        type: 'image' as const,
        url: img.url,
        name: `variation-${img.id}.png`,
        metadata: {
          prompt: result.prompt,
          provider: img.metadata.provider,
        },
      })),
    };
  }

  private selectedProvider(requestedProvider?: ImageProviderId): ImageProviderId {
    if (requestedProvider && requestedProvider in IMAGE_PROVIDERS) {
      return requestedProvider;
    }
    if (typeof window !== 'undefined') {
      const preference = localStorage.getItem(IMAGE_PROVIDER_PREFERENCE) ?? sessionStorage.getItem(BONSAI_WEBGPU_PROVIDER_PREFERENCE);
      if (preference) {
        if (preference === 'bonsai-webgpu') {
          const consent = sessionStorage.getItem(BONSAI_WEBGPU_CONSENT);
          if (consent === 'accepted') return 'bonsai-webgpu';
        } else {
          return preference as ImageProviderId;
        }
      }
    }
    return this.config.defaultProvider ?? 'pollinations';
  }

  private readApiKeys(): ImageProviderApiKeys {
    if (typeof window === 'undefined') return {};
    try {
      return JSON.parse(localStorage.getItem(IMAGE_API_KEYS) || '{}') as ImageProviderApiKeys;
    } catch {
      return {};
    }
  }

  private progressMessage(provider: ImageProviderId): string {
    const name = IMAGE_PROVIDERS[provider]?.name ?? provider;
    if (provider === 'bonsai-local') return 'Generating locally with Bonsai Image 4B…';
    if (provider === 'bonsai-webgpu') return 'Generating locally with fast Bonsai WebGPU…';
    return `Generating with ${name}…`;
  }

  private async upscaleImage(imageId: string): Promise<PluginOutput> {
    // Upscaling requires a dedicated service (e.g. Real-ESRGAN via Replicate).
    // No free API is wired up yet — return an honest error rather than false success.
    return {
      success: false,
      error: {
        message: `Upscaling is not yet available. Image ID: ${imageId}. A Replicate or Real-ESRGAN integration is needed.`,
        code: 'NOT_IMPLEMENTED',
        recoverable: false,
      },
    };
  }

  private formatImageOutput(result: ImageGenerationResult): string {
    return [
      `# Image Generation`,
      '',
      `**Prompt:** ${result.prompt}`,
      `**Provider:** ${result.config.provider ?? 'unknown'}`,
      `**Images:** ${result.images.length}`,
      '',
      'Images generated successfully!',
    ].join('\n');
  }
}

export function createImagePlugin(): ModePlugin {
  return new ImagePlugin();
}

export default createImagePlugin();
