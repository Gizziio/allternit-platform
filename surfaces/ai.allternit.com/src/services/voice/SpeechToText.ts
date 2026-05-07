/**
 * Speech-to-Text Service - Backend Required
 * 
 * Connects to voice service backend for STT
 * NO FALLBACK - Backend must be running
 */

const DEFAULT_VOICE_SERVICE_URL = 'http://127.0.0.1:8001';
const resolveVoiceServiceUrl = (): string => {
  const envUrl = (import.meta as any).env?.VITE_VOICE_URL;
  const injectedUrl = typeof window !== 'undefined'
    ? (window as unknown as { __ALLTERNIT_VOICE_URL__?: string }).__ALLTERNIT_VOICE_URL__
    : undefined;
  const candidate = [envUrl, injectedUrl, DEFAULT_VOICE_SERVICE_URL]
    .find((value) => typeof value === 'string' && value.trim().length > 0) as string;
  return candidate.replace(/\/+$/, '');
};

const VOICE_SERVICE_URL = resolveVoiceServiceUrl();

// Types
export interface STTResult {
  transcript: string;
  confidence: number;
  isFinal: boolean;
  alternatives?: Array<{ transcript: string; confidence: number }>;
}

export type STTEventType = 
  | 'start' 
  | 'end' 
  | 'result' 
  | 'error' 
  | 'no-match' 
  | 'audio-start' 
  | 'audio-end'
  | 'processing';

export interface STTEvent {
  type: STTEventType;
  result?: STTResult;
  error?: string;
  audioBlob?: Blob;
}

export type STTCallback = (event: STTEvent) => void;

export interface STTOptions {
  language?: string;
  continuous?: boolean;
  interimResults?: boolean;
  maxAlternatives?: number;
}

// Global SpeechRecognition types for browsers that support it
declare global {
  interface Window {
    SpeechRecognition: new () => SpeechRecognition;
    webkitSpeechRecognition: new () => SpeechRecognition;
  }
}

export interface SpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  maxAlternatives: number;
  start(): void;
  stop(): void;
  abort(): void;
  onstart: ((ev: Event) => void) | null;
  onend: ((ev: Event) => void) | null;
  onresult: ((ev: SpeechRecognitionEvent) => void) | null;
  onerror: ((ev: SpeechRecognitionErrorEvent) => void) | null;
  onnomatch: ((ev: Event) => void) | null;
}

export interface SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList;
  resultIndex: number;
}

export interface SpeechRecognitionResultList {
  readonly length: number;
  item(index: number): SpeechRecognitionResult;
  [index: number]: SpeechRecognitionResult;
}

export interface SpeechRecognitionResult {
  readonly length: number;
  isFinal: boolean;
  [index: number]: SpeechRecognitionAlternative;
}

export interface SpeechRecognitionAlternative {
  transcript: string;
  confidence: number;
}

export interface SpeechRecognitionErrorEvent extends Event {
  error: string;
  message: string;
}

/**
 * Speech-to-Text Service - Uses backend or native Web Speech API
 */
class SpeechToTextService {
  private callbacks: Set<STTCallback> = new Set();
  private options: STTOptions = {
    language: 'en-US',
    continuous: false,
    interimResults: true,
    maxAlternatives: 3,
  };

  // MediaRecorder for backend STT
  private mediaRecorder: MediaRecorder | null = null;
  private audioChunks: Blob[] = [];
  private stream: MediaStream | null = null;
  private audioContext: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private isRecording = false;

  // Native SpeechRecognition (disabled - using MediaRecorder + backend instead)
  private recognition: SpeechRecognition | null = null;
  private useNative = false; // Always use backend STT for reliability

  constructor() {
    this.initNativeRecognition();
  }

  private initNativeRecognition(): void {
    if (typeof window === 'undefined') return;
    
    // Force MediaRecorder + backend approach - native STT has network issues in Electron
    // const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    // if (SpeechRecognition) {
    //   this.recognition = new SpeechRecognition();
    //   this.useNative = true;
    //   this.setupNativeRecognition();
    // }
    console.log('[SpeechToText] Using MediaRecorder + backend STT (native disabled for Electron reliability)');
  }

  private setupNativeRecognition(): void {
    if (!this.recognition) return;

    this.recognition.continuous = this.options.continuous ?? false;
    this.recognition.interimResults = this.options.interimResults ?? true;
    // @ts-ignore - maxAlternatives may not be in all browser implementations
    this.recognition.maxAlternatives = this.options.maxAlternatives ?? 3;
    this.recognition.lang = this.options.language ?? 'en-US';

    this.recognition.onstart = () => {
      console.log('[SpeechToText] Native recognition started');
      this.isRecording = true;
      this.notify({ type: 'start' });
    };

    this.recognition.onend = () => {
      console.log('[SpeechToText] Native recognition ended');
      this.isRecording = false;
      this.notify({ type: 'end' });
    };

    this.recognition.onresult = (event: SpeechRecognitionEvent) => {
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        const transcript = result[0].transcript;
        const confidence = result[0].confidence;

        this.notify({
          type: 'result',
          result: {
            transcript,
            confidence,
            isFinal: result.isFinal,
            alternatives: Array.from({ length: Math.min(result.length, 3) }, (_, j) => ({
              transcript: result[j].transcript,
              confidence: result[j].confidence,
            })),
          },
        });
      }
    };

    this.recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      console.error('[SpeechToText] Recognition error:', event.error);
      this.isRecording = false;
      this.notify({ type: 'error', error: event.error });
    };

    this.recognition.onnomatch = () => {
      this.notify({ type: 'no-match' });
    };
  }

  // ============ Public API ============

  isSupported(): boolean {
    // Support native or MediaRecorder for backend
    return this.useNative || this.isMediaRecorderSupported();
  }

  isNativeSupported(): boolean {
    return this.useNative;
  }

  on(callback: STTCallback): () => void {
    this.callbacks.add(callback);
    return () => this.callbacks.delete(callback);
  }

  private notify(event: STTEvent): void {
    this.callbacks.forEach(cb => cb(event));
  }

  setOptions(options: Partial<STTOptions>): void {
    this.options = { ...this.options, ...options };
    if (this.recognition) {
      this.setupNativeRecognition();
    }
  }

  setLanguage(lang: string): void {
    this.options.language = lang;
    if (this.recognition) {
      this.recognition.lang = lang;
    }
  }

  getAvailableLanguages(): string[] {
    return [
      'en-US', 'en-GB', 'en-AU', 'en-CA', 'en-IE', 'en-NZ', 'en-ZA',
      'es-ES', 'es-MX', 'es-AR', 'es-CO', 'es-US',
      'fr-FR', 'fr-CA', 'fr-BE', 'fr-CH',
      'de-DE', 'de-AT', 'de-CH',
      'it-IT', 'it-CH',
      'pt-BR', 'pt-PT',
      'zh-CN', 'zh-TW', 'zh-HK',
      'ja-JP', 'ko-KR',
      'ru-RU', 'ru-UA',
      'nl-NL', 'pl-PL', 'tr-TR', 'ar-SA', 'hi-IN',
    ];
  }

  async start(): Promise<boolean> {
    console.log('[SpeechToText] Starting recording...');
    console.log('[SpeechToText] isRecording:', this.isRecording);
    console.log('[SpeechToText] useNative:', this.useNative);
    console.log('[SpeechToText] recognition:', this.recognition);
    console.log('[SpeechToText] MediaRecorder supported:', this.isMediaRecorderSupported());
    
    if (this.isRecording) {
      console.log('[SpeechToText] Already recording');
      return false;
    }

    // Prefer native recognition
    if (this.useNative && this.recognition) {
      console.log('[SpeechToText] Using native speech recognition');
      try {
        this.recognition.start();
        console.log('[SpeechToText] Native recognition.start() called');
        return true;
      } catch (err) {
        console.warn('[SpeechToText] Native speech recognition failed:', err);
      }
    }

    // Fallback to MediaRecorder + backend
    console.log('[SpeechToText] Trying MediaRecorder fallback...');
    if (this.isMediaRecorderSupported()) {
      try {
        const result = await this.startMediaRecorder();
        console.log('[SpeechToText] MediaRecorder result:', result);
        return result;
      } catch (err) {
        console.error('[SpeechToText] MediaRecorder failed:', err);
        this.notify({ type: 'error', error: 'Microphone access denied or not available' });
        return false;
      }
    }

    console.error('[SpeechToText] Speech recognition not supported');
    this.notify({ type: 'error', error: 'Speech recognition not supported' });
    return false;
  }

  stop(): void {
    if (this.recognition && this.isRecording) {
      this.recognition.stop();
    }
    
    if (this.mediaRecorder && this.mediaRecorder.state === 'recording') {
      this.mediaRecorder.stop();
    }
  }

  abort(): void {
    if (this.recognition) {
      // @ts-ignore - abort() may not be in all browser implementations
      this.recognition.abort?.() || this.recognition.stop?.();
    }
    
    if (this.mediaRecorder && this.mediaRecorder.state === 'recording') {
      this.mediaRecorder.stop();
      this.cleanupMediaRecorder();
    }
    
    this.isRecording = false;
  }

  isActive(): boolean {
    return this.isRecording;
  }

  // ============ MediaRecorder Backend STT ============
  private streamingInterval: NodeJS.Timeout | null = null;
  private lastTranscript = '';

  private isMediaRecorderSupported(): boolean {
    return typeof window !== 'undefined' && 
           'MediaRecorder' in window && 
           'mediaDevices' in navigator;
  }

  private async startMediaRecorder(): Promise<boolean> {
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 16000,
        }
      });

      this.setupAudioAnalysis();

      this.mediaRecorder = new MediaRecorder(this.stream, {
        mimeType: this.getSupportedMimeType(),
      });

      this.audioChunks = [];
      this.lastTranscript = '';

      this.mediaRecorder.ondataavailable = (event: BlobEvent) => {
        if (event.data.size > 0) {
          this.audioChunks.push(event.data);
        }
      };

      this.mediaRecorder.onstop = async () => {
        // Clear streaming interval
        if (this.streamingInterval) {
          clearInterval(this.streamingInterval);
          this.streamingInterval = null;
        }
        
        this.cleanupMediaRecorder();
        
        const audioBlob = new Blob(this.audioChunks, { type: 'audio/webm' });
        
        if (audioBlob.size > 0) {
          this.notify({ type: 'processing' });
          
          // Send to backend for transcription
          try {
            const transcript = await this.transcribeWithBackend(audioBlob);
            if (transcript && transcript !== this.lastTranscript) {
              this.notify({
                type: 'result',
                result: {
                  transcript,
                  confidence: 1.0,
                  isFinal: true,
                },
              });
            } else if (!transcript) {
              this.notify({ type: 'no-match' });
            }
          } catch (err) {
            this.notify({ type: 'error', error: 'Transcription failed' });
          }
        }
        
        this.isRecording = false;
        this.notify({ type: 'end' });
      };

      this.mediaRecorder.onerror = () => {
        if (this.streamingInterval) {
          clearInterval(this.streamingInterval);
          this.streamingInterval = null;
        }
        this.cleanupMediaRecorder();
        this.isRecording = false;
        this.notify({ type: 'error', error: 'Recording failed' });
      };

      this.mediaRecorder.start(100);
      this.isRecording = true;
      this.notify({ type: 'start' });

      // Start streaming transcription every 1.5 seconds
      this.streamingInterval = setInterval(() => {
        this.streamChunkForTranscription();
      }, 1500);

      return true;
    } catch (err) {
      console.error('MediaRecorder failed:', err);
      this.notify({ type: 'error', error: 'Microphone access denied' });
      return false;
    }
  }

  private async streamChunkForTranscription(): Promise<void> {
    if (this.audioChunks.length === 0) return;
    
    // Create blob from accumulated chunks
    const audioBlob = new Blob(this.audioChunks, { type: 'audio/webm' });
    
    // Only transcribe if we have meaningful audio (at least 0.5 seconds worth)
    if (audioBlob.size < 1000) return;
    
    try {
      const transcript = await this.transcribeWithBackend(audioBlob);
      if (transcript && transcript !== this.lastTranscript) {
        this.lastTranscript = transcript;
        this.notify({
          type: 'result',
          result: {
            transcript,
            confidence: 0.8,
            isFinal: false, // Streaming result
          },
        });
      }
    } catch (err) {
      // Silent fail for streaming - we'll try again on next interval
    }
  }

  private async transcribeWithBackend(audioBlob: Blob): Promise<string | null> {
    try {
      const formData = new FormData();
      formData.append('audio', audioBlob, 'recording.webm');
      formData.append('language', this.options.language || 'en-US');

      const response = await fetch(`${VOICE_SERVICE_URL}/v1/stt/transcribe`, {
        method: 'POST',
        body: formData,
      });

      if (response.ok) {
        const data = await response.json();
        return data.transcript || null;
      }
      
      return null;
    } catch {
      return null;
    }
  }

  private setupAudioAnalysis(): void {
    if (!this.stream) return;
    
    try {
      this.audioContext = new AudioContext();
      const source = this.audioContext.createMediaStreamSource(this.stream);
      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = 256;
      source.connect(this.analyser);
    } catch {
      // Audio analysis is optional
    }
  }

  private cleanupMediaRecorder(): void {
    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop());
      this.stream = null;
    }
    
    if (this.audioContext) {
      this.audioContext.close().catch(() => {});
      this.audioContext = null;
    }
    
    this.analyser = null;
    this.mediaRecorder = null;
  }

  private getSupportedMimeType(): string {
    const types = [
      'audio/webm;codecs=opus',
      'audio/webm',
      'audio/mp4',
      'audio/ogg;codecs=opus',
    ];
    
    for (const type of types) {
      if (MediaRecorder.isTypeSupported(type)) {
        return type;
      }
    }
    
    return 'audio/webm';
  }

  getAudioLevel(): number {
    if (!this.analyser || !this.isRecording) return 0;
    
    const dataArray = new Uint8Array(this.analyser.frequencyBinCount);
    this.analyser.getByteFrequencyData(dataArray);
    const average = dataArray.reduce((a, b) => a + b, 0) / dataArray.length;
    return average / 255;
  }
}

// Export singleton
export const speechToText = new SpeechToTextService();
export { SpeechToTextService };
