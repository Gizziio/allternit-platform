/**
 * Multimodal Streaming Implementation
 *
 * Based on: spec/streaming/multimodal.md
 */

// ============================================================================
// Types
// ============================================================================

export type StreamingState = 'idle' | 'listening' | 'processing' | 'speaking' | 'interrupted' | 'error';

export interface StreamingSession {
  id: string;
  state: StreamingState;
  activeChannels: ('audio' | 'vision')[];
  interruptPending: boolean;
  backpressureLevel: number;
  createdAt: string;
}

export interface AudioChunk {
  data: Float32Array;
  sampleRate: number;
  timestamp: number;
}

export interface VideoFrame {
  data: ImageData;
  width: number;
  height: number;
  timestamp: number;
}

export interface StreamingConfig {
  audioEnabled: boolean;
  visionEnabled: boolean;
  interruptible: boolean;
  backpressureThreshold: number;
}

// ============================================================================
// OmniAgent Class
// ============================================================================

export class OmniAgent {
  private session: StreamingSession | null = null;
  private config: StreamingConfig;

  constructor(config: StreamingConfig = defaultConfig) {
    this.config = config;
  }

  async ingestVision(frame: VideoFrame): Promise<void> {
    if (!this.config.visionEnabled) return;
    
    this.ensureSession();
    console.log('[OmniAgent] Vision frame ingested:', frame.timestamp);
  }

  async ingestAudio(chunk: AudioChunk): Promise<void> {
    if (!this.config.audioEnabled) return;
    
    this.ensureSession();
    console.log('[OmniAgent] Audio chunk ingested:', chunk.timestamp);
  }

  async *streamTTS(text: string): AsyncIterable<AudioChunk> {
    this.updateState('speaking');
    
    // Simulate TTS streaming
    const sampleRate = 16000;
    const chunkSize = 1024;
    
    for (let i = 0; i < 10; i++) {
      if (this.session?.interruptPending) {
        console.log('[OmniAgent] TTS interrupted');
        this.updateState('interrupted');
        return;
      }
      
      yield {
        data: new Float32Array(chunkSize),
        sampleRate,
        timestamp: Date.now(),
      };
      
      await sleep(100);
    }
    
    this.updateState('idle');
  }

  async interrupt(): Promise<void> {
    if (this.session) {
      this.session.interruptPending = true;
      this.updateState('interrupted');
      console.log('[OmniAgent] Interrupted');
    }
  }

  getState(): StreamingState {
    return this.session?.state || 'idle';
  }

  private ensureSession(): void {
    if (!this.session) {
      this.session = {
        id: `session_${Date.now()}`,
        state: 'listening',
        activeChannels: [],
        interruptPending: false,
        backpressureLevel: 0,
        createdAt: new Date().toISOString(),
      };
      if (this.config.audioEnabled) this.session.activeChannels.push('audio');
      if (this.config.visionEnabled) this.session.activeChannels.push('vision');
    }
  }

  private updateState(state: StreamingState): void {
    if (this.session) {
      this.session.state = state;
    }
  }
}

const defaultConfig: StreamingConfig = {
  audioEnabled: true,
  visionEnabled: true,
  interruptible: true,
  backpressureThreshold: 0.8,
};

// ============================================================================
// Full-Duplex Controller
// ============================================================================

export class FullDuplexController {
  private audioChannel: AudioChannel;
  private visionChannel: VisionChannel;
  private priorityRouter: PriorityRouter;

  constructor() {
    this.audioChannel = new AudioChannel();
    this.visionChannel = new VisionChannel();
    this.priorityRouter = new PriorityRouter();
  }

  async processInput(input: { audio?: AudioChunk; vision?: VideoFrame }): Promise<void> {
    if (input.audio) {
      await this.audioChannel.decode(input.audio);
    }
    if (input.vision) {
      await this.visionChannel.decode(input.vision);
    }
  }

  async checkInterrupt(): Promise<boolean> {
    // Check for speech interruption
    return false;
  }
}

class AudioChannel {
  async decode(chunk: AudioChunk): Promise<void> {
    console.log('[AudioChannel] Decoding audio chunk');
  }
}

class VisionChannel {
  async decode(frame: VideoFrame): Promise<void> {
    console.log('[VisionChannel] Decoding video frame');
  }
}

class PriorityRouter {
  route(priority: 'high' | 'medium' | 'low'): void {
    console.log('[PriorityRouter] Routing priority:', priority);
  }
}

// ============================================================================
// Utilities
// ============================================================================

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ============================================================================
// Singleton
// ============================================================================

export const omniAgent = new OmniAgent();
export const fullDuplexController = new FullDuplexController();
