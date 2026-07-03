# Voice Service

HTTP API service for voice synthesis and recognition. The Rust implementation
in this crate provides a lightweight, simulated voice API that mirrors the
contract of the full Python/Chatterbox voice wrapper in `api/main.py`.

## Scope

- **Text-to-Speech (TTS)** — generate simulated speech metadata.
- **Speech-to-Text (STT)** — accept audio uploads and return simulated
  transcriptions.
- **Session management** — create and track TTS/STT sessions.
- **Model introspection** — list TTS voices and STT models.

The `api/` directory still contains the Python FastAPI service backed by
Chatterbox, XTTS, Piper, and Whisper. The Rust service here is the standalone
Cargo package and is what `cargo build --workspace` produces.

## Running

```bash
# Run the Rust service on port 8001
cargo run -p voice-service

# Run tests
cargo test -p voice-service
```

The service binds to `0.0.0.0:8001` by default.

## API Endpoints

### Health

```bash
GET /health
GET /v1/health
```

### TTS

List voices:

```bash
GET /v1/voices
GET /v1/voices/:id
```

Text-to-speech:

```bash
POST /v1/tts
{
  "text": "Hello world",
  "voice_id": "default"
}
```

Streaming TTS:

```bash
POST /v1/tts/stream
{
  "text": "Hello world"
}
```

### STT

List models:

```bash
GET /v1/stt/models
```

Speech-to-text (multipart):

```bash
POST /v1/stt
Content-Type: multipart/form-data
audio: <audio_bytes>
language: en
```

Streaming STT:

```bash
POST /v1/stt/stream
```

### Sessions

```bash
GET    /v1/sessions
POST   /v1/sessions        { "mode": "tts" }
GET    /v1/sessions/:id
DELETE /v1/sessions/:id
```

### Stats

```bash
GET /v1/stats
```

See [spec/API.md](./spec/API.md) for the full API contract.

## Rust Client

The crate also exposes a small HTTP client for the Python voice service in
`src/client.rs`:

```rust
use voice_service::{VoiceClient, TTSRequest};

let client = VoiceClient::default();
let request = TTSRequest {
    text: "Hello from Rust".to_string(),
    voice: "default".to_string(),
    format: "wav".to_string(),
    use_paralinguistic: true,
};
let response = client.text_to_speech(request).await?;
```

## Testing

```bash
cargo test -p voice-service
```

Integration tests live in `tests/integration.rs` and exercise the router via
Tower's `ServiceExt::oneshot`, so no network port is required.
