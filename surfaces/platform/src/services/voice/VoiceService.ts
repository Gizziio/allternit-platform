/**
 * Unified Voice Service - Backend Required
 *
 * Connects to Chatterbox TTS backend at localhost:8001
 * NO FALLBACK - Backend must be running
 *
 * To start backend:
 *   cd 4-services/ml-ai-services/voice-service && python3 launch.py
 *
 * Or with Docker:
 *   docker-compose up voice-service
 *
 * To disable voice service (suppress health check errors):
 *   Set VITE_ENABLE_VOICE_SERVICE=false in .env
 */

const DEFAULT_VOICE_SERVICE_URL = 'http://127.0.0.1:8001';
const HEALTH_CHECK_TIMEOUT_MS = 3000;
const HEALTH_FAILURE_LOG_THROTTLE_MS = 60000;
const MAX_HEALTH_BACKOFF_MS = 300000;

// Check if voice service is enabled via environment variable
const isVoiceServiceEnabled = () => {
  if (typeof window === 'undefined') return false;
  const envValue = (import.meta as any).env?.VITE_ENABLE_VOICE_SERVICE;
  // Default to true if not specified, false if explicitly set to 'false'
  return envValue !== 'false';
};

const resolveVoiceServiceUrl = (): string => {
  const envUrl = (import.meta as any).env?.VITE_VOICE_URL;
  const injectedUrl = typeof window !== 'undefined'
    ? (window as unknown as { __A2R_VOICE_URL__?: string }).__A2R_VOICE_URL__
    : undefined;

  const candidate = [envUrl, injectedUrl, DEFAULT_VOICE_SERVICE_URL]
    .find((value) => typeof value === 'string' && value.trim().length > 0) as string;

  return candidate.replace(/\/+$/, '');
};

const VOICE_SERVICE_URL = resolveVoiceServiceUrl();
console.log('[VoiceService] Using URL:', VOICE_SERVICE_URL);

// Types
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

// Event types
type PlaybackEventType = 'play' | 'end' | 'error' | 'pause';
interface PlaybackEvent {
  type: PlaybackEventType;
  url?: string;
  error?: string;
}

type VoiceServiceEvent = 
  | { type: 'playback'; event: PlaybackEvent }
  | { type: 'energy'; level: number }
  | { type: 'state'; state: Partial<VoiceState> }
  | { type: 'error'; error: string };

type EventCallback = (event: VoiceServiceEvent) => void;

/**
 * Voice Service - Backend Required
 */
class VoiceService {
  private baseUrl: string;
  private isServiceAvailable = false;
  private lastHealthCheck = 0;
  private healthCheckInterval = 30000; // 30 seconds
  private healthFailureCount = 0;
  private nextHealthRetryAt = 0;
  private lastFailureLogAt = 0;
  
  // Audio playback
  private audioElement: HTMLAudioElement | null = null;
  private playbackListeners: Set<(event: PlaybackEvent) => void> = new Set();
  private isPlayingRef = false;
  
  // Audio energy analysis for Persona
  private audioContext: AudioContext | null = null;
  private analyserNode: AnalyserNode | null = null;
  private mediaSource: MediaElementAudioSourceNode | null = null;
  private energyListeners: Set<(energy: number) => void> = new Set();
  private animationFrameId: number | null = null;
  
  // Event listeners
  private listeners: Set<EventCallback> = new Set();

  constructor() {
    this.baseUrl = VOICE_SERVICE_URL;

    // Skip initialization if voice service is disabled
    if (!isVoiceServiceEnabled()) {
      console.log('[VoiceService] Disabled via VITE_ENABLE_VOICE_SERVICE=false');
      this.isServiceAvailable = false;
      return;
    }

    // Auto-check health periodically (quiet by default to avoid console spam)
    setInterval(() => {
      if (this.shouldRetryHealthCheck()) {
        this.checkHealth({ quiet: true, force: true }).catch((error) => {
          console.warn('[VoiceService] Health check failed:', error);
          this.emit({ type: 'error', error: 'Health check failed' });
        });
      }
    }, this.healthCheckInterval);
  }

  // ============ Health & Status ============

  async checkHealth(options: { quiet?: boolean; force?: boolean } = {}): Promise<boolean> {
    const { quiet = false, force = false } = options;
    const now = Date.now();

    if (!isVoiceServiceEnabled()) {
      this.isServiceAvailable = false;
      this.emit({
        type: 'state',
        state: {
          serviceAvailable: false,
          error: null,
        },
      });
      return false;
    }

    if (!force && now < this.nextHealthRetryAt) {
      return this.isServiceAvailable;
    }

    this.lastHealthCheck = Date.now();

    const timeoutController = new AbortController();
    const timeoutId = setTimeout(() => timeoutController.abort(), HEALTH_CHECK_TIMEOUT_MS);

    try {
      const response = await fetch(`${this.baseUrl}/health`, {
        signal: timeoutController.signal,
      });
      clearTimeout(timeoutId);

      this.isServiceAvailable = response.ok;

      if (response.ok) {
        this.healthFailureCount = 0;
        this.nextHealthRetryAt = 0;
      } else {
        this.registerHealthFailure(`Voice service returned HTTP ${response.status}`, quiet);
      }

      this.emit({
        type: 'state',
        state: {
          serviceAvailable: this.isServiceAvailable,
          error: this.isServiceAvailable
            ? null
            : `Voice service unavailable at ${this.baseUrl}`,
        },
      });

      return response.ok;
    } catch (err) {
      clearTimeout(timeoutId);
      this.registerHealthFailure(
        err instanceof Error ? err.message : 'Voice service health check failed',
        quiet,
      );
      return false;
    }
  }

  shouldRetryHealthCheck(): boolean {
    const now = Date.now();
    return now >= this.nextHealthRetryAt && (now - this.lastHealthCheck) >= this.healthCheckInterval;
  }

  private registerHealthFailure(reason: string, quiet: boolean): void {
    this.isServiceAvailable = false;
    this.healthFailureCount += 1;

    const backoffMs = Math.min(
      MAX_HEALTH_BACKOFF_MS,
      this.healthCheckInterval * Math.pow(2, Math.max(0, this.healthFailureCount - 1)),
    );
    this.nextHealthRetryAt = Date.now() + backoffMs;

    const error = `Voice service unavailable at ${this.baseUrl}. Run: python3 launch.py in 4-services/ml-ai-services/voice-service`;
    this.emit({ type: 'state', state: { serviceAvailable: false, error } });
    this.emit({ type: 'error', error });

    if (quiet) {
      return;
    }

    const now = Date.now();
    if ((now - this.lastFailureLogAt) >= HEALTH_FAILURE_LOG_THROTTLE_MS) {
      console.warn(`[VoiceService] ${reason}. Next retry in ${Math.ceil(backoffMs / 1000)}s.`);
      this.lastFailureLogAt = now;
    }
  }

  getServiceStatus(): { available: boolean; lastCheck: number; error?: string } {
    return {
      available: this.isServiceAvailable,
      lastCheck: this.lastHealthCheck,
      error: this.isServiceAvailable ? undefined : 'Voice service not running',
    };
  }

  isAvailable(): boolean {
    return this.isServiceAvailable;
  }

  // ============ Voices ============

  async listVoices(): Promise<VoicePreset[]> {
    if (!isVoiceServiceEnabled()) {
      return [];
    }

    if (!this.isServiceAvailable) {
      const available = await this.checkHealth({ quiet: true, force: true });
      if (!available) {
        return [];
      }
    }

    const response = await fetch(`${this.baseUrl}/v1/voice/voices`);
    if (!response.ok) throw new Error('Failed to fetch voices');
    const data = await response.json();
    return data.voices || [];
  }

  async listModels(): Promise<VoiceModel[]> {
    if (!isVoiceServiceEnabled()) {
      return [];
    }

    if (!this.isServiceAvailable) {
      const available = await this.checkHealth({ quiet: true, force: true });
      if (!available) {
        return [];
      }
    }
    
    const response = await fetch(`${this.baseUrl}/v1/voice/models`);
    if (!response.ok) throw new Error('Failed to fetch models');
    const data = await response.json();
    return data.models || [];
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
      const error = 'Voice service not available. Start with: python3 launch.py';
      this.emit({ type: 'error', error });
      return { success: false, error };
    }

    try {
      const response = await fetch(`${this.baseUrl}/v1/voice/tts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text,
          voice,
          format: 'wav',
          use_paralinguistic: useParalinguistic,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || `TTS request failed with status ${response.status}`);
      }

      const data: TTSResponse = await response.json();
      const audioUrl = data.audio_url.startsWith('http') 
        ? data.audio_url 
        : `${this.baseUrl}${data.audio_url}`;

      if (autoPlay) {
        await this.playAudio(audioUrl);
      }

      return {
        success: true,
        audioUrl,
        duration: data.duration,
      };
    } catch (err) {
      const error = err instanceof Error ? err.message : 'TTS failed';
      this.emit({ type: 'error', error });
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
      const response = await fetch(`${this.baseUrl}/v1/voice/clone`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text,
          reference_audio_url: referenceAudioUrl,
          format: 'wav',
        }),
      });

      if (!response.ok) {
        throw new Error(`Voice clone request failed with status ${response.status}`);
      }

      const data: TTSResponse = await response.json();
      const audioUrl = data.audio_url.startsWith('http')
        ? data.audio_url
        : `${this.baseUrl}${data.audio_url}`;
      
      await this.playAudio(audioUrl);
      
      return {
        success: true,
        audioUrl,
        duration: data.duration,
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

      const response = await fetch(`${this.baseUrl}/v1/voice/upload`, {
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

  // ============ Audio Playback & Energy Analysis ============

  async playAudio(url: string): Promise<void> {
    // Stop any current playback
    this.stopAudio();
    this.teardownAudioAnalysis();

    return new Promise((resolve, reject) => {
      this.audioElement = new Audio(url);
      
      this.isPlayingRef = true;
      this.playbackListeners.forEach(cb => cb({ type: 'play', url }));
      this.emit({ type: 'playback', event: { type: 'play', url } });
      this.emit({ type: 'state', state: { isPlaying: true } });

      // Setup energy analysis when audio can play
      this.audioElement.addEventListener('canplaythrough', () => {
        this.startEnergyAnalysis();
      }, { once: true });

      this.audioElement.onended = () => {
        this.teardownAudioAnalysis();
        this.isPlayingRef = false;
        this.playbackListeners.forEach(cb => cb({ type: 'end' }));
        this.emit({ type: 'playback', event: { type: 'end' } });
        this.emit({ type: 'state', state: { isPlaying: false } });
        resolve();
      };

      this.audioElement.onerror = (e) => {
        this.teardownAudioAnalysis();
        this.isPlayingRef = false;
        const error = 'Audio playback failed';
        this.playbackListeners.forEach(cb => cb({ type: 'error', error }));
        this.emit({ type: 'playback', event: { type: 'error', error } });
        this.emit({ type: 'state', state: { isPlaying: false } });
        reject(new Error(error));
      };

      this.audioElement.play().catch((err) => {
        this.teardownAudioAnalysis();
        this.isPlayingRef = false;
        this.playbackListeners.forEach(cb => cb({ type: 'error', error: err.message }));
        this.emit({ type: 'playback', event: { type: 'error', error: err.message } });
        this.emit({ type: 'state', state: { isPlaying: false } });
        reject(err);
      });
    });
  }

  stopAudio(): void {
    this.teardownAudioAnalysis();
    
    if (this.audioElement) {
      this.audioElement.pause();
      this.audioElement = null;
    }
    
    if (this.isPlayingRef) {
      this.isPlayingRef = false;
      this.playbackListeners.forEach(cb => cb({ type: 'end' }));
      this.emit({ type: 'playback', event: { type: 'end' } });
      this.emit({ type: 'state', state: { isPlaying: false } });
    }
  }

  isCurrentlyPlaying(): boolean {
    return this.isPlayingRef;
  }

  // ============ Energy Analysis for Persona ============

  private startEnergyAnalysis(): void {
    if (this.animationFrameId !== null) return;

    if (!this.audioContext || this.audioContext.state === 'closed') {
      try {
        this.audioContext = new AudioContext();
      } catch {
        console.warn('[VoiceService] AudioContext not available');
        return;
      }
    }

    if (this.audioContext.state === 'suspended') {
      this.audioContext.resume().catch((error) => {
        console.warn('[VoiceService] AudioContext resume failed:', error);
        this.emit({ type: 'error', error: 'Failed to resume audio context' });
      });
    }

    if (!this.analyserNode) {
      this.analyserNode = this.audioContext.createAnalyser();
      this.analyserNode.fftSize = 256;
      this.analyserNode.smoothingTimeConstant = 0.8;
    }

    if (this.audioElement && !this.mediaSource) {
      try {
        this.mediaSource = this.audioContext.createMediaElementSource(this.audioElement);
        this.mediaSource.connect(this.analyserNode);
        this.analyserNode.connect(this.audioContext.destination);
      } catch {
        console.warn('[VoiceService] Could not create media source');
        return;
      }
    }

    const dataArray = new Float32Array(this.analyserNode.frequencyBinCount);
    
    const loop = () => {
      if (!this.audioElement || this.audioElement.paused || this.audioElement.ended) {
        this.stopEnergyAnalysis();
        return;
      }

      if (this.analyserNode) {
        this.analyserNode.getFloatTimeDomainData(dataArray);
        const energy = this.computeEnergy(dataArray);
        this.energyListeners.forEach(cb => cb(energy));
        this.emit({ type: 'energy', level: energy });
        this.emit({ type: 'state', state: { audioLevel: energy } });
      }

      this.animationFrameId = requestAnimationFrame(loop);
    };

    this.animationFrameId = requestAnimationFrame(loop);
  }

  private stopEnergyAnalysis(): void {
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
    this.energyListeners.forEach(cb => cb(0));
    this.emit({ type: 'energy', level: 0 });
    this.emit({ type: 'state', state: { audioLevel: 0 } });
  }

  private teardownAudioAnalysis(): void {
    this.stopEnergyAnalysis();
    
    if (this.mediaSource) {
      try { 
        this.mediaSource.disconnect(); 
      } catch (error) {
        console.debug('[VoiceService] MediaSource disconnect failed:', error);
      }
      this.mediaSource = null;
    }
    if (this.analyserNode) {
      try { 
        this.analyserNode.disconnect(); 
      } catch (error) {
        console.debug('[VoiceService] AnalyserNode disconnect failed:', error);
      }
      this.analyserNode = null;
    }
    if (this.audioContext) {
      try { 
        this.audioContext.close(); 
      } catch (error) {
        console.debug('[VoiceService] AudioContext close failed:', error);
      }
      this.audioContext = null;
    }
  }

  private computeEnergy(data: Float32Array): number {
    let sum = 0;
    for (let i = 0; i < data.length; i++) {
      sum += data[i] * data[i];
    }
    return Math.min(1, Math.sqrt(sum / data.length) * 4);
  }

  // ============ Event Subscription ============

  onPlayback(callback: (event: PlaybackEvent) => void): () => void {
    this.playbackListeners.add(callback);
    return () => this.playbackListeners.delete(callback);
  }

  onEnergy(callback: (energy: number) => void): () => void {
    this.energyListeners.add(callback);
    return () => this.energyListeners.delete(callback);
  }

  subscribe(callback: EventCallback): () => void {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  private emit(event: VoiceServiceEvent): void {
    this.listeners.forEach(cb => cb(event));
  }
}

// Export singleton
export const voiceService = new VoiceService();
export { VoiceService };
