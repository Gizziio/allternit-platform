# Voice & WebVM Integration Architecture

## Overview

This document describes the architecture of two integrated services in Allternit:
- **Voice Service**: Text-to-speech and voice cloning powered by Chatterbox
- **WebVM Service**: Browser-based Linux virtualization powered by WebVM/CheerpX

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                     Allternit CLI                        │
│  ┌──────────────┐  ┌──────────────┐                    │
│  │ voice       │  │ webvm        │                    │
│  │ commands    │  │ commands     │                    │
│  └──────┬───────┘  └──────┬───────┘                    │
│         │                  │          │                            │
└─────────┼──────────────────┼────────────────────────────────────┘
          │                  │          │
          ▼                  ▼          │
┌──────────────────────────┬─────────────────┬─────────────────┐
│   Voice Service        │   WebVM Service│                  │
│  ┌────────────────┐   │  ┌───────────┐ │                 │
│  │ FastAPI       │   │  │ Axum      │ │                 │
│  │ Python        │   │  │ Rust       │ │                 │
│  │ Chatterbox    │   │  │ SessionManager ││                 │
│  │ TTS/VC        │   │  │ Session    │ │                 │
│  └────────────────┘   │  │ Manager    │ │                 │
│  ┌────────────────┐   │  └────────────┘ │                 │
│  │ HTTP Client    │   │                 │                 │
│  └────────────────┘   │                 │                 │
└──────────────────────────┴─────────────────┴─────────────────┘
          │                                    │
          └───────────────┬──────────────────────────┘
                         │
                         ▼
              ┌──────────────────────────┐
              │   Kernel Service      │
              │  ┌────────────────┐  │
              │  │ ToolExecutor    │  │
              │  └────┬───────┘  │
              │       │  Tools     │  │
              │       │  - voice.tts│  │
              │       │  - voice.clone│  │
              │       │  - webvm.session│  │
              │       └────────────┘  │
              │                     │
              └───────────────────────┘
                                    │
                                    ▼
                         ┌─────────────────────┐
                         │  Session DB (SQLite) │
                         └─────────────────────┘
```

## Voice Service

### Components

1. **FastAPI Service** (`services/ai/voice-service/api/main.py`)
   - Python-based HTTP service
   - Wraps Chatterbox TTS/VC models
   - Exposes REST API endpoints

2. **Rust Client Library** (`services/ai/voice-service/src/`)
   - Type-safe HTTP client for Rust applications
   - Provides `VoiceClient` with async methods

### API Endpoints

```
POST /v1/voice/tts
  Request: { text, voice?, format?, use_paralinguistic? }
  Response: { audio_url, duration, filename }

POST /v1/voice/clone
  Request: { text, reference_audio_url, format? }
  Response: { audio_url, duration, filename }

POST /v1/voice/upload
  Upload reference audio for voice cloning
  Response: { status, audio_url, filename }

GET  /v1/voice/audio/{filename}
  Serve generated audio files

GET  /health
  Service health check
```

### Usage

```rust
use voice_service::{VoiceClient, TTSRequest};

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    let client = VoiceClient::default();

    let request = TTSRequest {
        text: "Hello, world!".to_string(),
        voice: "default".to_string(),
        format: "wav".to_string(),
        use_paralinguistic: true,
    };

    let response = client.text_to_speech(request).await?;
    println!("Generated audio: {}", response.audio_url);

    Ok(())
}
```

## WebVM Service

### Components

1. **Axum HTTP Service** (`services/webvm-service/src/main.rs`)
   - Rust-based HTTP service
   - Manages WebVM sessions with `SessionManager`
   - Serves static WebVM assets

2. **Session Management** (`services/webvm-service/src/session.rs`)
   - In-memory session storage
   - Session lifecycle: create, list, get, stop
   - Terminal I/O for WebVM instances

3. **Static Assets** (`services/webvm-service/static/`)
   - Built WebVM frontend (SvelteKit)
   - Copied from `services/compute/webvm/build/`

### API Endpoints

```
GET /webvm/
  Serve WebVM UI (browser-based Linux VM)

GET /health
  Health check endpoint

GET /api/v1/status
  Service status and metrics

POST /api/v1/sessions
  Create new WebVM session
  Request: { disk_image?, memory_mb?, cpu_cores? }
  Response: { session_id, status, url }

GET /api/v1/sessions
  List all active sessions
  Response: [SessionInfo, ...]

GET /api/v1/sessions/:session_id
  Get specific session info
  Response: SessionInfo

POST /api/v1/sessions/:session_id
  Terminal input to WebVM session
  Request: { input }
  Response: { status: ok }

DELETE /api/v1/sessions/:session_id
  Stop and remove session
  Response: { status: stopped }
```

### Usage

```rust
use webvm_service::{SessionManager, SessionCreateRequest};

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    let manager = SessionManager::new("http://localhost:8002".to_string());

    let request = SessionCreateRequest {
        disk_image: Some("debian_mini.ext2".to_string()),
        memory_mb: Some(512),
        cpu_cores: Some(2),
    };

    let response = manager.create_session(request).await?;
    println!("Session created: {}", response.url);

    Ok(())
}
```

## Kernel Integration

### Tool Registration

Both services are registered as tools in the kernel's `ToolExecutor`:

```rust
// Voice tools
tools.insert("voice.tts".to_string(), Box::new(VoiceTTSTool::new(voice_client.clone())));
tools.insert("voice.clone".to_string(), Box::new(VoiceCloneTool::new(voice_client)));

// WebVM tool
tools.insert("webvm.session".to_string(), Box::new(WebVMTool::new(session_manager)));
```

### Tool Definitions

**voice.tts**: Convert text to speech using Chatterbox TTS model
**voice.clone**: Clone voice from reference audio and generate speech
**webvm.session**: Create a new WebVM session for Linux execution

## CLI Commands

### Voice Commands

```bash
a2 voice tts "Hello, world!" --voice default --format wav --output audio.wav
a2 voice clone "Hello" --reference ref.wav --format wav --output cloned.wav
a2 voice list-models
a2 voice health
```

### WebVM Commands

```bash
a2 webvm start --host 0.0.0.0 --port 8002
a2 webvm stop --host 0.0.0.0 --port 8002
a2 webvm create --disk-image debian_mini.ext2 --memory-mb 512 --cpu-cores 2
a2 webvm list
a2 webvm stop <session-id>
```

## Docker Development

### Docker Compose

```yaml
services:
  voice-service:
    build: ./services/ai/voice-service
    ports: ["8001:8001"]
    volumes: ["./audio:/tmp/voice-service"]
    environment:
      PRELOAD_MODEL: "false"
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8001/health"]
      interval: 10s
      timeout: 3s
      retries: 5

  webvm-service:
    build: ./services/webvm-service
    ports: ["8002:8002"]
    volumes: ["./webvm-static:/app/static"]
    environment:
      WEBVM_BASE_URL: "http://localhost:8002"
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8002/health"]
      interval: 10s
      timeout: 3s
      retries: 5
```

### Starting Services

```bash
# Start all services
docker-compose up voice-service webvm-service kernel

# Start individual services
docker-compose up voice-service
docker-compose up webvm-service

# Run services in background
docker-compose up -d

# Stop services
docker-compose down
```

## Configuration

### Environment Variables

**Voice Service:**
- `PORT`: Port to listen on (default: 8001)
- `AUDIO_OUTPUT_DIR`: Directory for generated audio files (default: /tmp/voice-service)
- `PRELOAD_MODEL`: Preload Chatterbox model on startup (default: false)

**WebVM Service:**
- `WEBVM_BASE_URL`: Base URL for WebVM sessions (default: http://localhost:8002)

### Port Assignments

| Service | Default Port | Purpose |
|----------|--------------|---------|
| voice-service | 8001 | TTS/VC API |
| webvm-service | 8002 | WebVM sessions |
| kernel | 3000 | Core kernel API |

## Data Flow

### Voice Service Flow

```
User → CLI → VoiceClient → voice-service API → Chatterbox → Audio File
```

1. User calls `a2 voice tts` or `a2 voice clone`
2. CLI calls VoiceClient methods
3. VoiceClient makes HTTP request to voice-service
4. voice-service generates audio using Chatterbox models
5. Audio file saved to output directory
6. Response returned with audio URL

### WebVM Service Flow

```
User → CLI → webvm-service → SessionManager → WebVM Browser UI
```

1. User calls `a2 webvm create` or kernel tool `webvm.session`
2. SessionManager creates new session
3. webvm-service returns session URL
4. User accesses WebVM in browser
5. Terminal I/O managed through API

### Kernel Tool Flow

```
Agent/Script → Kernel → ToolExecutor → Tool Implementation → External Service
```

1. Agent calls tool: `voice.tts`, `voice.clone`, or `webvm.session`
2. ToolExecutor routes to appropriate tool implementation
3. Tool makes HTTP request to external service
4. Result returned to kernel
5. Kernel continues execution

## Testing

### Voice Service Tests

```bash
# Start voice service
docker-compose up voice-service

# Test health
curl http://localhost:8001/health

# Test TTS
curl -X POST http://localhost:8001/v1/voice/tts \
  -H "Content-Type: application/json" \
  -d '{"text":"Hello, world!","voice":"default","format":"wav"}'

# Test voice clone
a2 voice clone "Test" --reference ref.wav
```

### WebVM Service Tests

```bash
# Start WebVM service
docker-compose up webvm-service

# Test health
curl http://localhost:8002/health

# Create session
a2 webvm create --memory-mb 512

# List sessions
a2 webvm list

# Stop session
a2 webvm stop <session-id>
```

## Deployment Considerations

### Voice Service

1. **Model Size**: Chatterbox Turbo requires ~350MB for model weights
2. **GPU vs CPU**: Default to CPU for compatibility; GPU requires CUDA setup
3. **Audio Storage**: Generated files accumulate; implement cleanup strategy
4. **Latency**: TTS generation takes 1-3 seconds depending on text length

### WebVM Service

1. **Static Assets**: WebVM build includes 50-100MB of frontend assets
2. **Session Persistence**: Currently in-memory; consider SQLite for persistence
3. **Browser Requirements**: Modern browser with WebAssembly support
4. **Terminal I/O**: WebSocket recommended for real-time interaction

## Troubleshooting

### Voice Service Issues

**Issue**: voice-service fails to start
- Check Python dependencies: `pip install -r requirements.txt`
- Verify Chatterbox models can be downloaded
- Check port 8001 availability

**Issue**: TTS generation fails
- Check model loaded status: `GET /health`
- Verify text input is not empty
- Check available disk space

**Issue**: Voice clone produces poor quality
- Ensure reference audio is at least 10 seconds
- Use same audio format for reference and output
- Check paralinguistic tags are not interfering

### WebVM Service Issues

**Issue**: WebVM UI fails to load
- Verify static assets exist in `services/webvm-service/static/`
- Check webvm-service is running
- Clear browser cache

**Issue**: Session creation fails
- Verify SessionManager is initialized
- Check base URL configuration
- Check available memory for new sessions

**Issue**: Terminal input not working
- Verify session exists
- Check session input endpoint is accessible
- Review terminal output logs

## Future Enhancements

### Voice Service
- [ ] Add multilingual model support (Chatterbox-Multilingual)
- [ ] Implement audio file cleanup/retention policy
- [ ] Add batch processing for multiple TTS requests
- [ ] Support streaming audio generation
- [ ] Add model warmup to reduce first-request latency

### WebVM Service
- [ ] Implement persistent disk images per session
- [ ] Add WebSocket support for real-time terminal I/O
- [ ] Implement session state persistence (SQLite)
- [ ] Add CPU/memory isolation between sessions
- [ ] Support custom disk images from user uploads

## References

- [Chatterbox TTS](https://github.com/resemble-ai/chatterbox)
- [WebVM](https://github.com/leaningtech/webvm)
- [Axum Framework](https://github.com/tokio-rs/axum)
- [FastAPI](https://fastapi.tiangolo.com/)
