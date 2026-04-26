# Allternitchitech Voice Service

Text-to-Speech and Voice Cloning service powered by Chatterbox (Resemble AI).

## Architecture

This service consists of two parts:
1. **FastAPI Python Service** (`api/main.py`) - Wraps Chatterbox models
2. **Rust Client Library** (`src/`) - Type-safe HTTP client for Rust applications

## Setup

### Prerequisites

- Python 3.10+
- Rust toolchain
- Chatterbox dependencies (will install from requirements.txt)

### Installation

```bash
# Install Python dependencies
cd api
pip install -r requirements.txt

# Build Rust client
cargo build --release
```

## Usage

### Starting the FastAPI Service

```bash
# Using the start script
./start.sh

# Or manually
cd api
uvicorn main:app --host 0.0.0.0 --port 8001
```

### Environment Variables

- `PORT`: Port to listen on (default: 8001)
- `AUDIO_OUTPUT_DIR`: Directory for generated audio files (default: /tmp/voice-service)
- `PRELOAD_MODEL`: Preload Chatterbox model on startup (default: false)
- `VOICE_PRESET_JSON`: Inline JSON manifest of voice presets
- `VOICE_PRESET_PATH`: Path to a JSON voice preset manifest
- `PRELOAD_VOICE_PROMPTS`: Preload all voice preset assets on startup (default: true)
- `XTTS_MODEL_ID`: Override the XTTS model id (default: tts_models/multilingual/multi-dataset/xtts_v2)
- `XTTS_DEVICE`: Force XTTS device (cpu, cuda, mps)
- `PRELOAD_XTTS_MODEL`: Preload XTTS model on startup (default: false)
- `PIPER_BIN`: Absolute path to the `piper` binary (fallback uses `piper` in PATH)
- `PIPER_FALLBACK_MODEL`: URL or local path to a Piper `.onnx` model used as fallback
- `PIPER_FALLBACK_CONFIG`: Optional config path/URL for the Piper fallback voice
- `PRELOAD_PIPER_FALLBACK`: Preload the Piper fallback assets on startup (default: false)

### API Endpoints

#### Health Check
```bash
GET /health
```

#### List Models
```bash
GET /v1/voice/models
```

#### List Voices
```bash
GET /v1/voice/voices
```

#### Text-to-Speech
```bash
POST /v1/voice/tts
{
  "text": "Hello world",
  "voice": "default",
  "format": "wav",
  "use_paralinguistic": true
}
```

#### Voice Cloning
```bash
POST /v1/voice/clone
{
  "text": "Hello world",
  "reference_audio_url": "/v1/voice/audio/ref_audio.wav",
  "format": "wav"
}
```

#### Upload Reference Audio
```bash
POST /v1/voice/upload
Content-Type: multipart/form-data
file: <audio_file>
```

## Voice Preset Manifest

Provide `VOICE_PRESET_JSON` or `VOICE_PRESET_PATH` with entries like:

```json
[
  {
    "id": "calm",
    "label": "Calm (Chatterbox)",
    "engine": "chatterbox",
    "prompt": "https://example.com/voices/calm.wav"
  },
  {
    "id": "narrator",
    "label": "Narrator (XTTS)",
    "engine": "xtts_v2",
    "speaker_wav": "https://example.com/voices/narrator.wav",
    "language": "en"
  },
  {
    "id": "piper-amy",
    "label": "Amy (Piper)",
    "engine": "piper",
    "model": "/models/en_US-amy-medium.onnx",
    "config": "/models/en_US-amy-medium.onnx.json"
  }
]
```

Notes:
- Chatterbox presets use `prompt` audio for voice conditioning.
- XTTS presets use `speaker_wav` for voice cloning.
- Piper presets expect a `.onnx` model and a matching `.json` config (the config should sit next to the model).

## Voice Pack License Checklist

Before shipping voice packs, verify:
- The license permits commercial use and redistribution of derived audio.
- The voice prompt source has consent for synthetic voice generation.
- The dataset or speaker audio terms allow model conditioning or cloning.
- You keep a record of source URLs and licenses alongside the manifest.

## Rust Client Usage

```rust
use voice_service::{VoiceClient, TTSRequest};

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let client = VoiceClient::default();

    let request = TTSRequest {
        text: "Hello from Rust!".to_string(),
        voice: "default".to_string(),
        format: "wav".to_string(),
        use_paralinguistic: true,
    };

    let response = client.text_to_speech(request).await?;
    println!("Audio URL: {}", response.audio_url);
    println!("Duration: {}s", response.duration);

    Ok(())
}
```

## Integration with Kernel

The voice service can be integrated with the Allternitchitech kernel as a tool:

```rust
// In kernel's ToolExecutor
use voice_service::{VoiceClient, TTSRequest};

async fn execute_voice_tts(text: String) -> Result<AudioResult> {
    let client = VoiceClient::default();
    let request = TTSRequest {
        text,
        voice: "default".to_string(),
        format: "wav".to_string(),
        use_paralinguistic: true,
    };

    let response = client.text_to_speech(request).await?;
    Ok(AudioResult {
        url: response.audio_url,
        duration: response.duration,
    })
}
```

## Paralinguistic Tags

Chatterbox Turbo supports paralinguistic tags for more natural speech:
- `[laugh]`
- `[chuckle]`
- `[cough]`

Example:
```json
{
  "text": "Hi there [chuckle], how can I help you today?"
}
```

## Troubleshooting

### Model fails to load
- Ensure all dependencies are installed: `pip install -r requirements.txt`
- Check system memory - Chatterbox Turbo requires ~1-2GB RAM
- XTTS requires `TTS` and will download weights on first use
- Piper requires the `piper` CLI and a valid `.onnx` + `.json` model pair

### Audio generation fails
- Check if the model is loaded: `GET /health`
- Verify input text is not empty
- Check disk space in `AUDIO_OUTPUT_DIR`

### Import errors (Python)
- The language server may show import warnings for `chatterbox` and `torchaudio`
- These are false positives - the modules will be available at runtime
- Verify by running: `python -c "from chatterbox.tts_turbo import ChatterboxTurboTTS"`
