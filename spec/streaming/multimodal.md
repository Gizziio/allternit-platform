# Multimodal Streaming Specification

**Version:** 1.0.0  
**Status:** Draft  
**Related:** P4.9, MiniCPM-o integration

---

## 1. Overview

This specification defines full-duplex multimodal streaming for A2R agents, enabling:
- Concurrent audio/video ingestion
- Interruptible output generation
- Real-time reactive graph execution
- Local deployment viability (10-11GB VRAM quantized)

---

## 2. Architecture

### 2.1 OmniAgent Class

```typescript
interface OmniAgent {
  // Ingestion
  ingestVision(frame: VideoFrame): Promise<void>;
  ingestAudio(chunk: AudioChunk): Promise<void>;
  
  // Output
  streamTTS(text: string): AsyncIterable<AudioChunk>;
  streamVision(description: string): AsyncIterable<VideoFrame>;
  
  // State
  interrupt(): Promise<void>;
  getState(): AgentState;
}
```

### 2.2 Full-Duplex State Controller

```
┌─────────────────────────────────────────────────────────────┐
│                  Full-Duplex Controller                      │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │
│  │   Vision    │  │   Audio     │  │   Priority          │  │
│  │   Channel   │  │   Channel   │  │   Router            │  │
│  │   (decode)  │  │   (decode)  │  │                     │  │
│  └─────────────┘  └─────────────┘  └─────────────────────┘  │
│                                                              │
│  ┌─────────────────────────────────────────────────────────┐│
│  │              Interrupt Handler                          ││
│  │  - Speech interruption detection                        ││
│  │  - Vision update injection                              ││
│  │  - Backpressure management                              ││
│  └─────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────┘
```

---

## 3. Streaming Kernel Extension

### 3.1 Session State Machine Upgrade

```typescript
type StreamingState =
  | 'idle'
  | 'listening'
  | 'processing'
  | 'speaking'
  | 'interrupted'
  | 'error';

interface StreamingSession {
  state: StreamingState;
  activeChannels: ('audio' | 'vision')[];
  interruptPending: boolean;
  backpressureLevel: number;
}
```

### 3.2 Streaming Supervisor

```typescript
interface StreamingSupervisor {
  startSession(config: StreamingConfig): Promise<SessionId>;
  interruptSession(sessionId: SessionId): Promise<void>;
  getStream(sessionId: SessionId): AsyncIterable<StreamingEvent>;
}
```

---

## 4. Event Bus Integration

### 4.1 Separate Decode/Encode Pipelines

```
Input Pipeline:
  Audio/Vision → Decode → Transcribe → Context → LLM

Output Pipeline:
  LLM → Plan → Encode → TTS/Vision → Stream
```

### 4.2 Interruptible Output

```typescript
async function* generateInterruptibleOutput(
  llmStream: AsyncIterable<string>
): AsyncIterable<AudioChunk> {
  const ttsBuffer: string[] = [];
  let interrupted = false;

  // Consume LLM stream
  (async () => {
    for await (const token of llmStream) {
      if (interrupted) return;
      ttsBuffer.push(token);
      
      // Stream to TTS when we have enough tokens
      if (ttsBuffer.length >= 4) {
        const text = ttsBuffer.join('');
        ttsBuffer.length = 0;
        yield* tts.generate(text);
      }
    }
  })();

  // Check for interrupts
  while (!interrupted) {
    const interrupt = await checkInterrupt();
    if (interrupt) {
      interrupted = true;
      tts.cancel();
      return;
    }
    await sleep(100);
  }
}
```

---

## 5. Model Support

### 5.1 MiniCPM-o 4.5 Class

| Model | VRAM (quantized) | Capabilities |
|-------|------------------|--------------|
| MiniCPM-o 4.5 | 10-11GB | Vision + Audio + Text |
| LLaVA-NeXT | 8-10GB | Vision + Text |
| Whisper + LLM | 6-8GB | Audio + Text |

### 5.2 Local Deployment

```yaml
local_deployment:
  min_vram: 10GB
  recommended_vram: 16GB
  cpu_fallback: true
  quantization:
    - 4bit
    - 8bit
```

---

## 6. Related Documents

- [MiniCPM-o Integration](../integrations/minicpm-o.md)
- [Streaming Kernel](../kernel/streaming-kernel.md)
- [Event Bus Specification](../infrastructure/event-bus.md)
