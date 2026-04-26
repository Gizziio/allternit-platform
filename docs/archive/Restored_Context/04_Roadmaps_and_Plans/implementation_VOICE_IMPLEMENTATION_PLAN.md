# Voice STT-TTS Backend Implementation Plan

## Files to Create/Modify

### 1. VoiceService.ts (Enhanced)
- Add pluggable provider architecture
- Add Whisper STT provider
- Add ElevenLabs TTS provider
- Add VAD utilities
- Add audio streaming pipeline

### 2. SpeechToText.ts (Enhanced)
- Add Whisper API provider
- Add streaming support
- Add end-of-speech detection

### 3. VoiceOrb.tsx (Minimal Updates)
- Already well-integrated
- May need minor VAD animation improvements

### 4. ChatInterface.tsx (Integration)
- Already has voice integration
- Verify intent routing from voice input

### 5. New Files:
- `config/voice.config.ts` - Configuration management
- `runtime/VoicePipeline.ts` - Audio streaming pipeline
- `runtime/VAD.ts` - Voice Activity Detection utilities
- `types/voice.types.ts` - Type definitions

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                       VoiceOrb UI                           │
│                  (Visual feedback, VAD)                     │
└────────────────────┬────────────────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────────────────┐
│                   VoicePipeline                             │
│         (Audio capture, streaming, buffering)               │
└────────────────────┬────────────────────────────────────────┘
                     │
        ┌────────────┼────────────┐
        │            │            │
┌───────▼────┐ ┌────▼────┐ ┌─────▼──────┐
│ Web Speech │ │ Whisper │ │  VAD Utils │
│    API     │ │   API   │ │            │
└───────┬────┘ └────┬────┘ └─────┬──────┘
        │           │            │
        └───────────┴────────────┘
                    │
┌───────────────────▼─────────────────────────────────────────┐
│                 Intent Router                               │
│          (Voice input → Intent classification)              │
└───────────────────┬─────────────────────────────────────────┘
                    │
┌───────────────────▼─────────────────────────────────────────┐
│              Chat/Brain Session                             │
│          (Response generation, TTS trigger)                 │
└───────────────────┬─────────────────────────────────────────┘
                    │
        ┌───────────┴───────────┐
        │                       │
┌───────▼───────┐      ┌────────▼────────┐
│   Browser     │      │   ElevenLabs    │
│   TTS (Sync)  │      │   TTS (Stream)  │
└───────────────┘      └─────────────────┘
```
