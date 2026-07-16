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
  type ImageGenerationResult,
} from '@/lib/agents/modes/image-generation';
import {
  BONSAI_WEBGPU_CONSENT,
  BONSAI_WEBGPU_PROVIDER_PREFERENCE,
  bonsaiWebGpuProvider,
} from '@/lib/local-models/providers/bonsai-webgpu';

type BonsaiImageProvider = 'bonsai-local' | 'bonsai-webgpu';

export interface ImageConfig extends PluginConfig {
  defaultProvider?: BonsaiImageProvider;
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
    defaultProvider: 'bonsai-local',
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
          return await this.generateImages(input.prompt);
        case 'variations':
          return await this.generateVariations(
            input.options?.imageId as string,
            input.prompt
          );
        case 'upscale':
          return await this.upscaleImage(input.options?.imageId as string);
        default:
          return await this.generateImages(input.prompt);
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
    if (this.selectedProvider() === 'bonsai-webgpu') {
      const status = await bonsaiWebGpuProvider.connect();
      return { healthy: status.connected, message: status.error ?? 'Bonsai WebGPU is available.' };
    }
    const healthy = await checkBonsaiLocal();
    return {
      healthy,
      message: healthy ? 'Local Bonsai companion is ready.' : 'Local Bonsai companion is not running or its model is unavailable.',
    };
  }

  private async generateImages(prompt: string): Promise<PluginOutput> {
    const provider = this.selectedProvider();
    this.emit({ 
      type: 'progress', 
      payload: { step: 'generating', message: provider === 'bonsai-webgpu' ? 'Generating locally with fast Bonsai WebGPU…' : 'Generating locally with Bonsai Image 4B...' },
      timestamp: Date.now() 
    });

    const result = await generateImages(
      prompt,
      {
        provider,
        n: this.config.defaultN,
        size: this.config.defaultSize as '1024x1024' | '1024x1792' | '1792x1024',
      },
      { preferredProvider: provider, apiKeys: {} }
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
      { preferredProvider: provider, apiKeys: {} },
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
        },
      })),
    };
  }

  private selectedProvider(): BonsaiImageProvider {
    if (typeof window !== 'undefined') {
      const preference = sessionStorage.getItem(BONSAI_WEBGPU_PROVIDER_PREFERENCE);
      const consent = sessionStorage.getItem(BONSAI_WEBGPU_CONSENT);
      if (preference === 'bonsai-webgpu' && consent === 'accepted') return 'bonsai-webgpu';
    }
    return this.config.defaultProvider === 'bonsai-webgpu' ? 'bonsai-webgpu' : 'bonsai-local';
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
      `**Provider:** ${(result as any).provider ?? 'unknown'}`,
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
