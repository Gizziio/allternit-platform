# Voice Service API Spec

## Overview

The Rust voice service provides a simulated HTTP API for text-to-speech (TTS),
speech-to-text (STT), voice session management, and service introspection. It
mirrors the shape of the Python/Chatterbox voice service so that callers can
integrate against a stable contract while the heavy inference logic runs in the
Python wrapper or a downstream model host.

## Transport

- HTTP/1.1
- JSON request/response bodies
- Multipart form data for STT audio uploads
- Default bind address: `0.0.0.0:8001`

## Resources

### VoiceModel

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Voice preset identifier |
| `name` | string | Human-readable name |
| `language` | string | Language code |
| `gender` | string | Gender tag |
| `sample_rate` | integer | Output sample rate in Hz |

### SttModel

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Model identifier |
| `name` | string | Human-readable name |
| `language` | string | Supported language |
| `supports_streaming` | boolean | Whether streaming is supported |

### VoiceSession

| Field | Type | Description |
|-------|------|-------------|
| `session_id` | string | UUIDv4 session identifier |
| `created_at` | ISO8601 | Creation timestamp |
| `last_activity` | ISO8601 | Last activity timestamp |
| `mode` | string | `tts`, `stt`, or `both` |
| `language` | string | Session language |

## Endpoints

### `GET /health` / `GET /v1/health`

Service liveness and version.

**Response 200:**

```json
{
  "service": "voice",
  "status": "healthy",
  "version": "0.1.0",
  "timestamp": 1234567890000,
  "features": ["tts", "stt", "streaming"]
}
```

### `GET /v1/voices`

List available TTS voices.

**Response 200:** `[ /* VoiceModel */ ]`

### `GET /v1/voices/:id`

Get a specific voice.

**Response 200:** `VoiceModel`
**Response 404:** Not found

### `GET /v1/stt/models`

List available STT models.

**Response 200:** `[ /* SttModel */ ]`

### `POST /v1/tts`

Convert text to a simulated speech response.

**Request body:**

```json
{
  "text": "string",
  "voice_id": "string?",
  "language": "string?",
  "speed": "number?"
}
```

**Response 200:**

```json
{
  "audio_url": "/v1/audio/<uuid>.wav",
  "duration_secs": 1.5,
  "sample_rate": 24000,
  "format": "wav"
}
```

**Response 400:** Unknown voice id

### `POST /v1/tts/stream`

Simulated streaming TTS endpoint.

**Request body:** same as `POST /v1/tts`

**Response 200:**

```json
{
  "stream_url": "/v1/streams/<uuid>.mp3",
  "duration_secs": 1.5,
  "format": "mp3"
}
```

### `POST /v1/stt`

Transcribe uploaded audio (simulated).

**Request body:** `multipart/form-data` with fields:
- `audio` (required): raw audio bytes
- `language` (optional): language hint

**Response 200:**

```json
{
  "text": "This is a simulated transcription result from the voice service.",
  "confidence": 0.95,
  "language": "en",
  "segments": [
    { "start_time": 0.0, "end_time": 1.0, "text": "...", "confidence": 0.95 }
  ]
}
```

**Response 400:** Missing audio data

### `POST /v1/stt/stream`

Return a simulated WebSocket streaming URL.

**Response 200:**

```json
{
  "websocket_url": "ws://localhost:8001/v1/stt/ws/<uuid>",
  "status": "ready"
}
```

### `GET /v1/sessions`

List active voice sessions.

**Response 200:** `[ /* VoiceSession */ ]`

### `POST /v1/sessions`

Create a new voice session.

**Request body:**

```json
{
  "mode": "tts | stt | both",
  "language": "string?"
}
```

**Response 200:** `VoiceSession`

### `GET /v1/sessions/:id`

Get a session.

**Response 200:** `VoiceSession`
**Response 404:** Not found

### `DELETE /v1/sessions/:id`

Delete a session.

**Response 204:** No content
**Response 404:** Not found

### `GET /v1/stats`

Service metrics.

**Response 200:**

```json
{
  "active_sessions": 0,
  "tts_models": 3,
  "stt_models": 1,
  "total_requests": 0,
  "timestamp": 1234567890000
}
```

## Error Handling

Error responses use standard HTTP status codes. The STT endpoint returns
`400 Bad Request` when the `audio` field is missing; unknown voice ids return
`400 Bad Request`; missing resources return `404 Not Found`.
