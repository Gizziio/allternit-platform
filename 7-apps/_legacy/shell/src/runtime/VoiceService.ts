/**
 * VoiceService - Integration with Chatterbox TTS Backend
 *
 * Connects to the voice-service at localhost:8001 for:
 * - Text-to-speech with paralinguistic tags ([laugh], [sigh], etc.)
 * - Voice cloning from reference audio
 * - 23 language support
 */

const VOICE_SERVICE_URL = 'http://localhost:8001';

interface TTSResponse {
  audio_url: string;
  duration: number;
  filename: string;
}

interface VoiceServiceHealth {
  status: string;
  service: string;
  model_loaded: boolean;
}

class VoiceServiceClient {
  private baseUrl: string;
  private audioElement: HTMLAudioElement | null = null;
  private isServiceAvailable: boolean | null = null;
  private lastHealthCheck: number = 0;
  private healthCheckInterval: number = 30000; // Retry health check every 30 seconds

  // Playback listeners for avatar (non-invasive subscription)
  private playbackListeners: Set<(event: { type: 'play' | 'end' | 'error'; url?: string }) => void> = new Set();
  private isPlayingRef: boolean = false;

  // Audio energy analysis for real speaking animation
  private audioContext: AudioContext | null = null;
  private analyserNode: AnalyserNode | null = null;
  private mediaSource: MediaElementAudioSourceNode | null = null;
  private energyListeners: Set<(energy: number) => void> = new Set();
  private animationFrameId: number | null = null;

  constructor(baseUrl: string = VOICE_SERVICE_URL) {
    this.baseUrl = baseUrl;
  }

  /**
   * Get service availability status for UI feedback
   */
  getServiceStatus(): { available: boolean | null; lastCheck: number } {
    return {
      available: this.isServiceAvailable,
      lastCheck: this.lastHealthCheck,
    };
  }

  /**
   * Force a new health check (useful after user starts the service)
   */
  async recheckHealth(): Promise<boolean> {
    this.isServiceAvailable = null;
    this.lastHealthCheck = 0;
    const health = await this.checkHealth();
    return health?.status === 'ok';
  }

  /**
   * Check if the voice service is running
   */
  async checkHealth(): Promise<VoiceServiceHealth | null> {
    this.lastHealthCheck = Date.now();
    try {
      const response = await fetch(`${this.baseUrl}/health`, {
        method: 'GET',
        signal: AbortSignal.timeout(3000), // 3 second timeout
      });

      if (response.ok) {
        const health = await response.json();
        this.isServiceAvailable = health.status === 'ok';
        console.log('Chatterbox TTS service connected:', health);
        return health;
      }
      this.isServiceAvailable = false;
      return null;
    } catch (err) {
      console.warn('Voice service health check failed (using browser fallback):', err);
      this.isServiceAvailable = false;
      return null;
    }
  }

  /**
   * Check if we should retry the health check
   */
  private shouldRetryHealthCheck(): boolean {
    if (this.isServiceAvailable === true) return false; // Already working
    if (this.isServiceAvailable === null) return true; // Never checked
    // Retry if last check was more than healthCheckInterval ago
    return Date.now() - this.lastHealthCheck > this.healthCheckInterval;
  }

  /**
   * Convert text to speech using Chatterbox TTS
   *
   * Supports paralinguistic tags:
   * - [laugh], [chuckle] - Laughter
   * - [sigh] - Sighing
   * - [cough] - Coughing
   * - [groan] - Groaning
   * - [shush] - Shushing
   *
   * @param text - Text to convert (can include paralinguistic tags)
   * @param options - TTS options
   */
  async speak(
    text: string,
    options: {
      voice?: string;
      useParalinguistic?: boolean;
      autoPlay?: boolean;
    } = {}
  ): Promise<{ success: boolean; audioUrl?: string; duration?: number; error?: string; usedFallback?: boolean }> {
    const { voice = 'default', useParalinguistic = true, autoPlay = true } = options;

    // Check service availability (with periodic retry)
    if (this.shouldRetryHealthCheck()) {
      await this.checkHealth();
    }

    if (!this.isServiceAvailable) {
      // Fall back to browser speech synthesis
      const result = await this.fallbackSpeak(text);
      return { ...result, usedFallback: true };
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
      const audioUrl = `${this.baseUrl}${data.audio_url}`;

      if (autoPlay) {
        await this.playAudio(audioUrl);
      }

      return {
        success: true,
        audioUrl,
        duration: data.duration,
      };
    } catch (err) {
      console.error('Chatterbox TTS failed:', err);
      // Fall back to browser speech synthesis
      return this.fallbackSpeak(text);
    }
  }

  /**
   * Clone voice from reference audio and generate speech
   */
  async speakWithVoice(
    text: string,
    referenceAudioUrl: string,
    autoPlay: boolean = true
  ): Promise<{ success: boolean; audioUrl?: string; duration?: number; error?: string }> {
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
      const audioUrl = `${this.baseUrl}${data.audio_url}`;

      if (autoPlay) {
        await this.playAudio(audioUrl);
      }

      return {
        success: true,
        audioUrl,
        duration: data.duration,
      };
    } catch (err) {
      console.error('Voice clone failed:', err);
      return {
        success: false,
        error: err instanceof Error ? err.message : 'Voice clone failed',
      };
    }
  }

  /**
   * Upload reference audio for voice cloning
   */
  async uploadReferenceAudio(file: File): Promise<{ success: boolean; audioUrl?: string; error?: string }> {
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
      return {
        success: true,
        audioUrl: data.audio_url,
      };
    } catch (err) {
      console.error('Audio upload failed:', err);
      return {
        success: false,
        error: err instanceof Error ? err.message : 'Upload failed',
      };
    }
  }

  /**
   * Subscribe to playback events for avatar lip-sync
   * @param callback - Called on play, end, or error events
   * @returns unsubscribe function
   */
  onPlayback(callback: (event: { type: 'play' | 'end' | 'error'; url?: string }) => void): () => void {
    this.playbackListeners.add(callback);
    return () => {
      this.playbackListeners.delete(callback);
    };
  }

  /**
   * Check if audio is currently playing (for avatar animation)
   */
  isCurrentlyPlaying(): boolean {
    return this.isPlayingRef;
  }

  /**
   * Subscribe to audio energy events for real speaking animation
   * @param callback - Called with energy level (0-1) approximately 60fps while playing
   * @returns unsubscribe function
   */
  onEnergy(callback: (energy: number) => void): () => void {
    this.energyListeners.add(callback);
    return () => {
      this.energyListeners.delete(callback);
    };
  }

  /**
   * Compute RMS energy from audio data (0-1 range)
   */
  private computeEnergy(data: Float32Array): number {
    let sum = 0;
    for (let i = 0; i < data.length; i++) {
      sum += data[i] * data[i];
    }
    return Math.sqrt(sum / data.length);
  }

  /**
   * Start audio energy analysis loop
   */
  private startEnergyAnalysis(): void {
    if (this.animationFrameId !== null) {
      return; // Already running
    }

    // Create audio context if needed (lazy creation)
    if (!this.audioContext || this.audioContext.state === 'closed') {
      try {
        this.audioContext = new AudioContext();
      } catch {
        console.warn('[VoiceService] AudioContext not available');
        return;
      }
    }

    // Resume if suspended (autoplay policy)
    if (this.audioContext.state === 'suspended') {
      this.audioContext.resume().catch(() => {
        // If resume fails, skip energy analysis
      });
    }

    // Create analyser if needed
    if (!this.analyserNode) {
      this.analyserNode = this.audioContext.createAnalyser();
      this.analyserNode.fftSize = 256;
      this.analyserNode.smoothingTimeConstant = 0.8;
    }

    // Create media source if needed
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

    // Start RAF loop
    const dataArray = new Float32Array(this.analyserNode.fftSize);
    
    const loop = () => {
      if (!this.audioElement || this.audioElement.paused || this.audioElement.ended) {
        this.stopEnergyAnalysis();
        return;
      }

      if (this.analyserNode && this.energyListeners.size > 0) {
        this.analyserNode.getFloatTimeDomainData(dataArray);
        const energy = this.computeEnergy(dataArray);
        // Emit to all listeners
        this.energyListeners.forEach(cb => cb(energy));
      }

      this.animationFrameId = requestAnimationFrame(loop);
    };

    this.animationFrameId = requestAnimationFrame(loop);
  }

  /**
   * Stop audio energy analysis loop
   */
  private stopEnergyAnalysis(): void {
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
    // Emit final energy=0 to all listeners
    this.energyListeners.forEach(cb => cb(0));
  }

  /**
   * Teardown audio analysis resources
   */
  private teardownAudioAnalysis(): void {
    this.stopEnergyAnalysis();
    if (this.mediaSource) {
      try {
        this.mediaSource.disconnect();
      } catch { /* ignore */ }
      this.mediaSource = null;
    }
    if (this.analyserNode) {
      try {
        this.analyserNode.disconnect();
      } catch { /* ignore */ }
      this.analyserNode = null;
    }
    if (this.audioContext) {
      try {
        this.audioContext.close();
      } catch { /* ignore */ }
      this.audioContext = null;
    }
  }

  /**
   * Play audio from URL - also emits playback events for subscribers
   */
  async playAudio(url: string): Promise<void> {
    return new Promise((resolve, reject) => {
      // Stop any currently playing audio and teardown analysis
      this.teardownAudioAnalysis();

      this.audioElement = new Audio(url);

      // Emit play event
      this.isPlayingRef = true;
      this.playbackListeners.forEach(cb => cb({ type: 'play', url }));

      // Start energy analysis (after audio loads enough data)
      const onCanPlayThrough = () => {
        this.audioElement?.removeEventListener('canplaythrough', onCanPlayThrough);
        this.startEnergyAnalysis();
      };
      this.audioElement.addEventListener('canplaythrough', onCanPlayThrough);

      this.audioElement.onended = () => {
        this.teardownAudioAnalysis();
        this.isPlayingRef = false;
        this.playbackListeners.forEach(cb => cb({ type: 'end' }));
        resolve();
      };

      this.audioElement.onerror = (e) => {
        this.teardownAudioAnalysis();
        this.isPlayingRef = false;
        this.playbackListeners.forEach(cb => cb({ type: 'error' }));
        reject(new Error('Audio playback failed'));
      };

      this.audioElement.play().catch((err) => {
        this.teardownAudioAnalysis();
        this.isPlayingRef = false;
        this.playbackListeners.forEach(cb => cb({ type: 'error' }));
        reject(err);
      });
    });
  }

  /**
   * Stop any currently playing audio - also emits end event
   */
  stopAudio(): void {
    // Teardown audio analysis first (emits energy=0)
    this.teardownAudioAnalysis();
    
    if (this.audioElement) {
      this.audioElement.pause();
      this.audioElement = null;
    }
    // Emit end event even if we didn't have an audio element
    if (this.isPlayingRef) {
      this.isPlayingRef = false;
      this.playbackListeners.forEach(cb => cb({ type: 'end' }));
    }
    // Also stop browser speech synthesis
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
  }

  /**
   * Fallback to browser speech synthesis when Chatterbox is unavailable
   */
  private fallbackSpeak(text: string): Promise<{ success: boolean; error?: string }> {
    return new Promise((resolve) => {
      if (!('speechSynthesis' in window)) {
        resolve({ success: false, error: 'Speech synthesis not supported' });
        return;
      }

      // Strip paralinguistic tags for browser fallback
      const cleanText = text.replace(/\[(laugh|chuckle|cough|sigh|groan|shush)\]/gi, '');

      const utterance = new SpeechSynthesisUtterance(cleanText);

      // Try to find a better quality voice
      const voices = window.speechSynthesis.getVoices();
      // Prefer voices in this order: Google, Microsoft, then any English voice
      const preferredVoice = voices.find(v =>
        v.name.includes('Google') && v.lang.startsWith('en')
      ) || voices.find(v =>
        v.name.includes('Microsoft') && v.lang.startsWith('en')
      ) || voices.find(v =>
        v.name.includes('Samantha') // macOS high-quality voice
      ) || voices.find(v =>
        v.lang.startsWith('en') && v.localService === false // Cloud voices
      ) || voices.find(v =>
        v.lang.startsWith('en')
      );

      if (preferredVoice) {
        utterance.voice = preferredVoice;
      }

      utterance.rate = 1.0;
      utterance.pitch = 1.0;
      utterance.volume = 1.0;

      utterance.onend = () => {
        resolve({ success: true });
      };

      utterance.onerror = (event) => {
        resolve({ success: false, error: event.error });
      };

      window.speechSynthesis.speak(utterance);
    });
  }

  /**
   * Get available browser voices for fallback
   */
  getAvailableVoices(): SpeechSynthesisVoice[] {
    if (!('speechSynthesis' in window)) return [];
    return window.speechSynthesis.getVoices();
  }
}

// Export singleton instance
export const voiceService = new VoiceServiceClient();

// Also export class for testing/custom instances
export { VoiceServiceClient };
