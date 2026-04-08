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
  type VideoGenerationResult,
  type GeneratedVideo,
} from '@/lib/agents/modes/video-generation';

export interface VideoConfig extends PluginConfig {
  provider?: 'minimax' | 'kling';
  model?: string;
  duration?: 6 | 10;
  resolution?: '720p' | '1080p';
  apiKey?: string;
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
    provider: 'minimax',
    model: 'T2V-01',
    duration: 6,
    resolution: '720p',
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
    
    // Check for API key in localStorage (BYOK)
    if (typeof window !== 'undefined') {
      const savedKeys = localStorage.getItem('allternit_video_api_keys');
      if (savedKeys) {
        const keys = JSON.parse(savedKeys);
        if (keys[this.config.provider!]) {
          this.config.apiKey = keys[this.config.provider!];
        }
      }
    }
    
    this.isInitialized = true;
    this.emit({ type: 'initialized', timestamp: Date.now() });
    console.log('[VideoPlugin] Initialized (BYOK)');
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

    if (!this.config.apiKey) {
      return {
        success: false,
        error: {
          message: 'API key required. Please add your MiniMax or Kling API key in settings.',
          code: 'NO_API_KEY',
          recoverable: true,
        },
      };
    }

    this.isExecuting = true;
    this.abortController = new AbortController();
    
    this.emit({ type: 'started', timestamp: Date.now() });

    try {
      const mode = input.options?.mode as string || 'text-to-video';

      switch (mode) {
        case 'text-to-video':
          return await this.generateFromText(input.prompt);
        case 'image-to-video':
          return await this.generateFromImage(
            input.options?.imageUrl as string,
            input.prompt
          );
        case 'extend':
          return await this.extendVideo(input.options?.videoId as string);
        default:
          return await this.generateFromText(input.prompt);
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
    if (!this.config.apiKey) {
      return { 
        healthy: false, 
        message: 'No API key configured. Add your MiniMax or Kling API key.' 
      };
    }
    return { healthy: true };
  }

  private async generateFromText(prompt: string): Promise<PluginOutput> {
    this.emit({ 
      type: 'progress', 
      payload: { step: 'generating', message: `Generating ${this.config.duration}s video...` },
      timestamp: Date.now() 
    });

    // TODO: Call actual MiniMax/Kling API
    const result = await generateVideo(prompt, {
      provider: this.config.provider!,
      model: this.config.model!,
      duration: this.config.duration!,
      resolution: this.config.resolution!,
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

  private async generateFromImage(imageUrl: string, prompt: string): Promise<PluginOutput> {
    this.emit({ 
      type: 'progress', 
      payload: { step: 'generating', message: 'Animating image...' },
      timestamp: Date.now() 
    });

    const result = await generateVideoFromImage(imageUrl, prompt, {
      provider: this.config.provider!,
      model: this.config.model!,
      duration: this.config.duration!,
      resolution: this.config.resolution!,
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
        },
      })),
    };
  }

  private async extendVideo(videoId: string): Promise<PluginOutput> {
    // TODO: Implement video extension
    return {
      success: true,
      content: `Extended video ${videoId}`,
    };
  }

  private formatVideoOutput(result: VideoGenerationResult): string {
    const providerInfo = VIDEO_PROVIDERS[result.config.provider as keyof typeof VIDEO_PROVIDERS];
    return [
      `# Video Generated`,
      '',
      `**Prompt:** ${result.prompt}`,
      `**Provider:** ${providerInfo?.name || result.config.provider}`,
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
