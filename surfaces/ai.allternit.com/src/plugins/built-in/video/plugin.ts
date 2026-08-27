/**
 * Video Plugin
 * 
 * Video generation via MiniMax/Kling (BYOK).
 * Similar to: Runway, Pika, Stable Video Diffusion
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
  generateVideo,
  generateVideoFromImage,
  VIDEO_PROVIDERS,
  getVideoProviders,
  type VideoGenerationConfig,
  type VideoGenerationResult,
  type GeneratedVideo,
  type VideoProviderApiKeys,
} from '@/lib/agents/modes/video-generation';

const VIDEO_PROVIDER_PREFERENCE = 'allternit_video_provider_preference';
const VIDEO_API_KEYS = 'allternit_video_api_keys';

type VideoProviderId = VideoGenerationConfig['provider'];

export interface VideoConfig extends PluginConfig {
  provider?: VideoProviderId;
  model?: string;
  duration?: 6 | 10 | 15;
  resolution?: '768p' | '1080p';
}

class VideoPlugin implements ModePlugin {
  readonly id = 'video';
  readonly name = 'Video';
  readonly version = '1.0.0';
  readonly capabilities: PluginCapability[] = [
    'text-to-video',
    'image-to-video',
    'video-editing',
    'extend',
    'caption',
    'voiceover',
  ];

  isInitialized = false;
  isExecuting = false;
  config: VideoConfig = {
    provider: 'pollinations',
    model: 'pollinations-video',
    duration: 6,
    resolution: '1080p',
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
        console.error(`[VideoPlugin] Event handler error:`, err);
      }
    });
  }

  async initialize(config?: VideoConfig): Promise<void> {
    if (config) {
      this.config = { ...this.config, ...config };
    }
    
    this.isInitialized = true;
    this.emit({ type: 'initialized', timestamp: Date.now() });
    console.debug('[VideoPlugin] Initialized (BYOK)');
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
      const mode = input.options?.mode as string || 'text-to-video';

      switch (mode) {
        case 'text-to-video':
          return await this.generateFromText(input.prompt, input.options);
        case 'image-to-video':
          return await this.generateFromImage(
            input.options?.imageUrl as string,
            input.prompt
          );
        case 'extend':
          return await this.extendVideo(input.options?.videoId as string);
        default:
          return await this.generateFromText(input.prompt, input.options);
      }

    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      
      const output: PluginOutput = {
        success: false,
        error: {
          message: error.message,
          code: 'VIDEO_ERROR',
          recoverable: error.message.includes('timeout'),
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
    const providerInfo = getVideoProviders(this.readApiKeys()).find((p) => p.id === provider);
    return {
      healthy: providerInfo?.isAvailable ?? false,
      message: providerInfo?.isAvailable
        ? `${providerInfo.name} video generation is ready.`
        : `${providerInfo?.name ?? provider} video generation needs configuration.`,
    };
  }

  private resolveConfig(inputOptions?: Record<string, unknown>): {
    provider: VideoProviderId;
    model: string;
    duration: 6 | 10 | 15;
    resolution: '768p' | '1080p';
  } {
    const provider = (inputOptions?.provider as VideoProviderId) || this.selectedProvider();
    const providerInfo = VIDEO_PROVIDERS[provider];
    const duration = (inputOptions?.duration as 6 | 10 | 15) || this.config.duration || 6;
    const resolution = (inputOptions?.resolution as '768p' | '1080p') || this.config.resolution || '1080p';
    return {
      provider,
      model: (inputOptions?.model as string) || this.config.model || providerInfo?.models[0]?.id || 'MiniMax-Hailuo-2.3',
      duration,
      resolution,
    };
  }

  private async generateFromText(prompt: string, inputOptions?: Record<string, unknown>): Promise<PluginOutput> {
    const config = this.resolveConfig(inputOptions);
    const style = (inputOptions?.style as string) || undefined;
    const promptWithStyle = style ? `${style} style video. ${prompt}` : prompt;

    this.emit({
      type: 'progress',
      payload: { step: 'generating', message: `Generating ${config.duration}s video with ${VIDEO_PROVIDERS[config.provider].name}...` },
      timestamp: Date.now()
    });

    const result = await generateVideo(promptWithStyle, {
      ...config,
      apiKey: this.readApiKeys()[config.provider],
    });

    return {
      success: true,
      content: this.formatVideoOutput(result),
      artifacts: result.videos.map(v => ({
        type: 'video',
        url: v.url,
        name: `video-${v.id}.mp4`,
        metadata: {
          duration: v.metadata.duration,
          resolution: v.metadata.resolution,
          provider: v.metadata.provider,
        },
      })),
    };
  }

  private async generateFromImage(imageUrl: string, prompt: string, inputOptions?: Record<string, unknown>): Promise<PluginOutput> {
    this.emit({ 
      type: 'progress', 
      payload: { step: 'generating', message: 'Animating image...' },
      timestamp: Date.now() 
    });

    const config = this.resolveConfig(inputOptions);
    const result = await generateVideoFromImage(imageUrl, prompt, {
      ...config,
      apiKey: this.readApiKeys()[config.provider],
    });

    return {
      success: true,
      content: `Video generated from image`,
      artifacts: result.videos.map(v => ({
        type: 'video',
        url: v.url,
        name: `video-${v.id}.mp4`,
        metadata: { 
          duration: v.metadata.duration,
          resolution: v.metadata.resolution,
          provider: v.metadata.provider,
        },
      })),
    };
  }

  private async extendVideo(videoId: string): Promise<PluginOutput> {
    return {
      success: false,
      error: {
        message: `Video extension is not yet available. Video ID: ${videoId}`,
        code: 'NOT_IMPLEMENTED',
        recoverable: false,
      },
    };
  }

  private selectedProvider(): VideoProviderId {
    if (typeof window !== 'undefined') {
      const preference = localStorage.getItem(VIDEO_PROVIDER_PREFERENCE);
      if (preference && preference in VIDEO_PROVIDERS) {
        return preference as VideoProviderId;
      }
    }
    return this.config.provider ?? 'minimax';
  }

  private readApiKeys(): VideoProviderApiKeys {
    if (typeof window === 'undefined') return {};
    try {
      return JSON.parse(localStorage.getItem(VIDEO_API_KEYS) || '{}') as VideoProviderApiKeys;
    } catch {
      return {};
    }
  }

  private formatVideoOutput(result: VideoGenerationResult): string {
    const providerInfo = VIDEO_PROVIDERS[result.config.provider];
    return [
      `# Video Generated`,
      '',
      `**Prompt:** ${result.prompt}`,
      `**Provider:** ${providerInfo?.name || result.config.provider}`,
      `**Model:** ${result.config.model}`,
      `**Duration:** ${result.config.duration}s`,
      `**Resolution:** ${result.config.resolution}`,
      '',
      'Your video has been generated successfully!',
    ].join('\n');
  }
}

export function createVideoPlugin(): ModePlugin {
  return new VideoPlugin();
}

export default createVideoPlugin();
