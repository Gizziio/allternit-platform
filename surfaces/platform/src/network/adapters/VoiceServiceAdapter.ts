/**
 * Voice Service Adapter
 * 
 * Adapts the existing VoiceService to use ALLTERNIT_BASE_URL.
 * This allows incremental migration without breaking existing code.
 */

import { ALLTERNIT_BASE_URL, get, post, type AllternitResponse } from '../index';

// Re-export types from original service
export interface TTSRequest {
  text: string;
  voice?: string;
  format?: 'wav' | 'mp3';
  use_paralinguistic?: boolean;
}

export interface TTSResponse {
  audio_url: string;
  duration?: number;
  format: string;
}

export interface VoicePreset {
  id: string;
  label: string;
  engine: string;
  prompt?: string;
  speaker_wav?: string;
  language?: string;
}

export interface VoiceModel {
  id: string;
  name: string;
  description: string;
  language: string;
}

export interface VoiceState {
  isPlaying: boolean;
  isRecording: boolean;
  currentVoice: string;
  availableVoices: VoicePreset[];
  serviceAvailable: boolean;
  audioLevel: number;
  error: string | null;
}

/**
 * Voice Service using Allternit Gateway
 */
class VoiceServiceAdapter {
  private baseUrl: string;
  private isServiceAvailable = false;
  private lastHealthCheck = 0;
  private healthCheckInterval = 30000;

  constructor() {
    // Use ALLTERNIT_BASE_URL with /v1/voice prefix
    this.baseUrl = `${ALLTERNIT_BASE_URL}/v1/voice`;
    
    // Initial health check
    this.checkHealth({ quiet: true }).catch(() => {});
    
    // Periodic health checks
    setInterval(() => {
      this.checkHealth({ quiet: true }).catch(() => {});
    }, this.healthCheckInterval);
  }

  // ============ Health & Status ============

  async checkHealth(options: { quiet?: boolean } = {}): Promise<boolean> {
    const { quiet = false } = options;
    this.lastHealthCheck = Date.now();

    try {
      // Health check through gateway
      const response = await fetch(`${ALLTERNIT_BASE_URL}/health`, {
        signal: AbortSignal.timeout(3000),
      });
      
      this.isServiceAvailable = response.ok;
      return response.ok;
    } catch (err) {
      if (!quiet) {
        console.warn('[VoiceServiceAdapter] Health check failed:', err);
      }
      this.isServiceAvailable = false;
      return false;
    }
  }

  getServiceStatus(): { available: boolean; lastCheck: number; error?: string } {
    return {
      available: this.isServiceAvailable,
      lastCheck: this.lastHealthCheck,
      error: this.isServiceAvailable ? undefined : 'Voice service not available',
    };
  }

  isAvailable(): boolean {
    return this.isServiceAvailable;
  }

  // ============ Voices ============

  async listVoices(): Promise<VoicePreset[]> {
    try {
      const response = await get<{ voices: VoicePreset[] }>(`${this.baseUrl}/voices`);
      return response.data.voices || [];
    } catch (err) {
      console.error('[VoiceServiceAdapter] Failed to list voices:', err);
      return [];
    }
  }

  async listModels(): Promise<VoiceModel[]> {
    try {
      const response = await get<{ models: VoiceModel[] }>(`${this.baseUrl}/models`);
      return response.data.models || [];
    } catch (err) {
      console.error('[VoiceServiceAdapter] Failed to list models:', err);
      return [];
    }
  }

  // ============ Text-to-Speech ============

  async speak(
    text: string,
    options: {
      voice?: string;
      useParalinguistic?: boolean;
      autoPlay?: boolean;
    } = {}
  ): Promise<{ success: boolean; audioUrl?: string; duration?: number; error?: string }> {
    const { voice = 'default', useParalinguistic = true, autoPlay = true } = options;

    if (!this.isServiceAvailable) {
      const error = 'Voice service not available';
      return { success: false, error };
    }

    try {
      const response = await post<TTSResponse>(`${this.baseUrl}/tts`, {
        text,
        voice,
        format: 'wav',
        use_paralinguistic: useParalinguistic,
      });

      const audioUrl = response.data.audio_url.startsWith('http')
        ? response.data.audio_url
        : `${ALLTERNIT_BASE_URL}${response.data.audio_url}`;

      if (autoPlay) {
        await this.playAudio(audioUrl);
      }

      return {
        success: true,
        audioUrl,
        duration: response.data.duration,
      };
    } catch (err) {
      const error = err instanceof Error ? err.message : 'TTS failed';
      return { success: false, error };
    }
  }

  // ============ Voice Cloning ============

  async cloneVoice(
    text: string,
    referenceAudioUrl: string
  ): Promise<{ success: boolean; audioUrl?: string; duration?: number; error?: string }> {
    if (!this.isServiceAvailable) {
      return { success: false, error: 'Voice service not available' };
    }

    try {
      const response = await post<TTSResponse>(`${this.baseUrl}/clone`, {
        text,
        reference_audio_url: referenceAudioUrl,
        format: 'wav',
      });

      const audioUrl = response.data.audio_url.startsWith('http')
        ? response.data.audio_url
        : `${ALLTERNIT_BASE_URL}${response.data.audio_url}`;

      await this.playAudio(audioUrl);

      return {
        success: true,
        audioUrl,
        duration: response.data.duration,
      };
    } catch (err) {
      const error = err instanceof Error ? err.message : 'Voice clone failed';
      return { success: false, error };
    }
  }

  async uploadReferenceAudio(file: File): Promise<{ success: boolean; audioUrl?: string; error?: string }> {
    if (!this.isServiceAvailable) {
      return { success: false, error: 'Voice service not available' };
    }

    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch(`${this.baseUrl}/upload`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`Upload failed with status ${response.status}`);
      }

      const data = await response.json();
      return { success: true, audioUrl: data.audio_url };
    } catch (err) {
      const error = err instanceof Error ? err.message : 'Upload failed';
      return { success: false, error };
    }
  }

  // ============ Audio Playback ============

  async playAudio(url: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const audio = new Audio(url);
      
      audio.onended = () => resolve();
      audio.onerror = () => reject(new Error('Audio playback failed'));
      
      audio.play().catch(reject);
    });
  }

  isCurrentlyPlaying(): boolean {
    // Simplified - full implementation would track audio element
    return false;
  }
}

// Export singleton
export const voiceServiceAdapter = new VoiceServiceAdapter();
export { VoiceServiceAdapter };
