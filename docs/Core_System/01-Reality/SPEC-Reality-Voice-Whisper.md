# Allternit Reality Spec: Voice (OpenAI Whisper)

**Location:** `services/voice/`  
**Status:** ACTIVE / OPERATIONAL  
**Date:** April 14, 2026

## 1. Role
The current "out of the box" voice setup uses OpenAI's Whisper model for speech-to-text transcription. It provides the primary audio input path for agents.

## 2. Implementation
- **API:** Python-based FastAPI service in `services/voice/api/`.
- **Model:** Uses the `whisper-base` model size by default (configurable via `WHISPER_MODEL` env).
- **Core Engine:** Integrated directly into the `services/voice/src/main.rs` Rust gateway.

## 3. Integration
The voice service is mapped to the `whisper-base` ID and provides transcriptions for audio files and streams, ensuring agents can "hear" user intent.

---
*Note: This is the current operational engine. See BLUEPRINT-Voice-Swabble-Daemon.md for the future macOS-native evolution.*
