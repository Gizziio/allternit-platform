/**
 * SpeechToText Service - Web Speech API integration
 * 
 * Provides speech recognition for voice input in chat interfaces.
 * Falls back gracefully when not supported.
 */

interface STTConfig {
  language?: string;
  continuous?: boolean;
  interimResults?: boolean;
  maxAlternatives?: number;
}

interface STTResult {
  transcript: string;
  confidence: number;
  isFinal: boolean;
  alternatives?: Array<{ transcript: string; confidence: number }>;
}

type STTEventType = 'start' | 'end' | 'result' | 'error' | 'no-match' | 'audio-start' | 'audio-end';

interface STTEvent {
  type: STTEventType;
  result?: STTResult;
  error?: string;
}

type STTCallback = (event: STTEvent) => void;

class SpeechToTextService {
  private recognition: SpeechRecognition | null = null;
  private isListening: boolean = false;
  private callbacks: Set<STTCallback> = new Set();
  private language: string = 'en-US';
  private lastTranscript: string = '';
  private finalTranscript: string = '';

  constructor() {
    if (typeof window !== 'undefined') {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechRecognition) {
        this.recognition = new SpeechRecognition();
        this.setupRecognition();
      }
    }
  }

  private setupRecognition() {
    if (!this.recognition) return;

    this.recognition.continuous = false;
    this.recognition.interimResults = true;
    this.recognition.maxAlternatives = 3;
    this.recognition.lang = this.language;

    this.recognition.onstart = () => {
      this.isListening = true;
      this.notify({ type: 'start' });
    };

    this.recognition.onend = () => {
      this.isListening = false;
      this.notify({ type: 'end' });
    };

    this.recognition.onresult = (event: SpeechRecognitionEvent) => {
      let interimTranscript = '';
      let finalTranscript = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        const transcript = result[0].transcript;
        const confidence = result[0].confidence;

        if (result.isFinal) {
          finalTranscript += transcript;
          this.notify({
            type: 'result',
            result: {
              transcript,
              confidence,
              isFinal: true,
              alternatives: Array.from({ length: Math.min(result.length, 3) }, (_, j) => ({
                transcript: result[j].transcript,
                confidence: result[j].confidence,
              })),
            },
          });
        } else {
          interimTranscript += transcript;
          this.notify({
            type: 'result',
            result: {
              transcript,
              confidence,
              isFinal: false,
            },
          });
        }
      }

      if (finalTranscript) {
        this.finalTranscript += finalTranscript;
        this.lastTranscript = finalTranscript;
      } else if (interimTranscript) {
        this.lastTranscript = interimTranscript;
      }
    };

    this.recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      this.isListening = false;
      this.notify({ type: 'error', error: event.error });
    };

    this.recognition.onnomatch = () => {
      this.notify({ type: 'no-match' });
    };
  }

  /**
   * Subscribe to speech recognition events
   */
  on(callback: STTCallback): () => void {
    this.callbacks.add(callback);
    return () => this.callbacks.delete(callback);
  }

  private notify(event: STTEvent) {
    this.callbacks.forEach(cb => cb(event));
  }

  /**
   * Check if speech recognition is supported
   */
  isSupported(): boolean {
    return this.recognition !== null;
  }

  /**
   * Get available languages
   */
  getAvailableLanguages(): string[] {
    // Return common languages - actual list varies by browser
    return [
      'en-US', 'en-GB', 'en-AU', 'en-CA', 'en-IE', 'en-NZ', 'en-ZA',
      'es-ES', 'es-MX', 'es-AR', 'es-CO', 'es-US',
      'fr-FR', 'fr-CA',
      'de-DE', 'de-AT', 'de-CH',
      'it-IT', 'it-CH',
      'pt-BR', 'pt-PT',
      'zh-CN', 'zh-TW', 'zh-HK',
      'ja-JP', 'ko-KR',
      'ru-RU', 'ru-UA',
    ];
  }

  /**
   * Set recognition language
   */
  setLanguage(lang: string) {
    this.language = lang;
    if (this.recognition) {
      this.recognition.lang = lang;
    }
  }

  /**
   * Start listening for speech
   */
  start(): boolean {
    if (!this.recognition || this.isListening) {
      return false;
    }

    this.lastTranscript = '';
    this.finalTranscript = '';

    try {
      this.recognition.start();
      return true;
    } catch (err) {
      console.error('Speech recognition start failed:', err);
      return false;
    }
  }

  /**
   * Stop listening
   */
  stop() {
    if (this.recognition && this.isListening) {
      this.recognition.stop();
    }
  }

  /**
   * Get the current transcript
   */
  getTranscript(): { interim: string; final: string } {
    return {
      interim: this.lastTranscript,
      final: this.finalTranscript,
    };
  }

  /**
   * Clear transcript
   */
  clearTranscript() {
    this.lastTranscript = '';
    this.finalTranscript = '';
  }

  /**
   * Check if currently listening
   */
  getIsListening(): boolean {
    return this.isListening;
  }
}

// Export singleton
export const speechToText = new SpeechToTextService();
export { SpeechToTextService };
export type { STTConfig, STTResult, STTEvent, STTEventType };
