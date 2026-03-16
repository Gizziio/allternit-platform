# Unified Voice Service

A hybrid voice service that combines backend TTS/STT with browser fallback capabilities.

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        UI Components                             │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐           │
│  │ SpeechInput│ │Persona   │ │AudioPlayer│ │VoiceSelector│         │
│  └────┬─────┘ └────┬─────┘ └────┬─────┘ └────┬─────┘           │
│       └────────────┴────────────┴────────────┘                  │
│                         │                                       │
│                         ▼                                       │
│              ┌─────────────────────┐                           │
│              │   VoiceProvider     │  ← Global state/context    │
│              │   (React Context)   │                           │
│              └──────────┬──────────┘                           │
│                         │                                       │
│       ┌─────────────────┼─────────────────┐                    │
│       ▼                 ▼                 ▼                    │
│  ┌──────────┐    ┌──────────┐    ┌──────────────┐             │
│  │VoiceService│    │SpeechToText│    │ useVoice Hook │             │
│  │ (TTS/TTS) │    │  (STT)    │    │              │             │
│  └────┬─────┘    └────┬─────┘    └──────────────┘             │
│       │               │                                         │
│       ▼               ▼                                         │
│  ┌─────────────────────────────────────┐                       │
│  │      Backend (localhost:8001)        │                       │
│  │   - Chatterbox TTS                   │                       │
│  │   - Voice Cloning                    │                       │
│  │   - Audio Upload                     │                       │
│  └─────────────────────────────────────┘                       │
│       ▲                                                        │
│       │ Fallback                                               │
│       ▼                                                        │
│  ┌─────────────────────────────────────┐                       │
│  │    Browser APIs (Web Speech)        │                       │
│  │   - speechSynthesis (TTS)           │                       │
│  │   - SpeechRecognition (STT)         │                       │
│  │   - MediaRecorder (Fallback)        │                       │
│  └─────────────────────────────────────┘                       │
└─────────────────────────────────────────────────────────────────┘
```

## Services

### VoiceService
Handles Text-to-Speech, voice cloning, and audio playback with energy analysis.

```typescript
import { voiceService } from '@/services/voice';

// Check service health
const isAvailable = await voiceService.checkHealth();

// List available voices
const voices = await voiceService.listVoices();

// Speak text (auto-falls back to browser if backend unavailable)
const result = await voiceService.speak('Hello world', {
  voice: 'default',
  autoPlay: true,
});

// Subscribe to playback events
const unsubscribe = voiceService.onPlayback((event) => {
  if (event.type === 'play') console.log('Started playing');
  if (event.type === 'end') console.log('Finished playing');
});

// Subscribe to audio energy for Persona animation
const unsubscribeEnergy = voiceService.onEnergy((energy) => {
  // energy is 0-1, use for animation intensity
  console.log('Audio energy:', energy);
});
```

### SpeechToText
Handles speech recognition with Web Speech API and backend fallback.

```typescript
import { speechToText } from '@/services/voice';

// Check support
const isSupported = speechToText.isSupported();
const isNative = speechToText.isNativeSupported(); // Web Speech API

// Subscribe to events
const unsubscribe = speechToText.on((event) => {
  switch (event.type) {
    case 'start':
      console.log('Recording started');
      break;
    case 'result':
      if (event.result?.isFinal) {
        console.log('Transcript:', event.result.transcript);
      }
      break;
    case 'end':
      console.log('Recording stopped');
      break;
  }
});

// Start/stop recording
speechToText.setLanguage('en-US');
speechToText.start();
speechToText.stop();
```

## React Integration

### VoiceProvider
Wrap your app with VoiceProvider (already added to ShellApp):

```tsx
import { VoiceProvider } from '@/providers/voice-provider';

function App() {
  return (
    <VoiceProvider>
      <YourApp />
    </VoiceProvider>
  );
}
```

### Hooks

#### useVoice - Full access
```typescript
import { useVoice } from '@/hooks/useVoice';

function MyComponent() {
  const {
    // State
    isPlaying,
    isRecording,
    audioLevel,
    personaState,
    serviceAvailable,
    
    // Settings
    currentVoice,
    autoPlay,
    
    // Actions
    speak,
    stopAudio,
    startRecording,
    stopRecording,
    setVoice,
  } = useVoice();

  return (
    <button onClick={() => speak('Hello!')}>
      Speak
    </button>
  );
}
```

#### useTTS - Text-to-speech only
```typescript
import { useTTS } from '@/hooks/useVoice';

function Speaker() {
  const { speak, stopAudio, isPlaying } = useTTS();
  // ...
}
```

#### useSTT - Speech-to-text only
```typescript
import { useSTT } from '@/hooks/useVoice';

function Listener() {
  const { startRecording, stopRecording, isRecording } = useSTT();
  // ...
}
```

#### usePersonaState - Persona animation
```typescript
import { usePersonaState } from '@/hooks/useVoice';

function MyPersona() {
  const { state, audioLevel, isActive } = usePersonaState();
  
  return <Persona state={state} animateWithEnergy />;
}
```

## Component Integration

### SpeechInput
Already integrated with voice service. Use normally:

```tsx
<SpeechInput
  onTranscriptionChange={(text) => setInput(text)}
  lang="en-US"
/>
```

### Persona
Supports "auto" mode for automatic state sync:

```tsx
// Manual control
<Persona state="listening" />

// Auto-sync with voice service
<Persona state="auto" animateWithEnergy />
```

### AudioPlayer
Works with voice service audio URLs:

```tsx
const { currentAudioUrl } = useVoice();

<AudioPlayer>
  {currentAudioUrl && (
    <AudioPlayerElement src={currentAudioUrl} />
  )}
  <AudioPlayerPlayButton />
</AudioPlayer>
```

### VoiceSelector
Connects to backend voices with browser fallback:

```tsx
const { availableVoices, currentVoice, setVoice } = useVoice();

<VoiceSelector value={currentVoice} onValueChange={setVoice}>
  <VoiceSelectorTrigger>Select Voice</VoiceSelectorTrigger>
  <VoiceSelectorContent>
    <VoiceSelectorList>
      {availableVoices.map((voice) => (
        <VoiceSelectorItem key={voice.id} value={voice.id}>
          <VoiceSelectorName>{voice.label}</VoiceSelectorName>
        </VoiceSelectorItem>
      ))}
    </VoiceSelectorList>
  </VoiceSelectorContent>
</VoiceSelector>
```

## Backend Service

The voice service connects to Chatterbox TTS at `localhost:8001`:

```bash
# Start the voice service
cd /Users/macbook/Desktop/a2rchitech-workspace/a2rchitech
docker-compose up voice-service

# Or manually
cd 4-services/ai/voice-service/api
pip install -r requirements.txt
uvicorn main:app --host 0.0.0.0 --port 8001
```

### API Endpoints

- `GET /health` - Health check
- `GET /v1/voice/voices` - List available voices
- `POST /v1/voice/tts` - Text-to-speech
- `POST /v1/voice/clone` - Voice cloning
- `POST /v1/voice/upload` - Upload reference audio

## Environment Variables

```bash
# Frontend
VITE_VOICE_URL=http://localhost:8001    # Direct voice service
VITE_API_URL=http://localhost:3000      # API proxy (used in prod)

# Backend (API)
A2R_VOICE_URL=http://127.0.0.1:8001     # Voice service URL
```

## Fallback Behavior

### TTS Fallback Chain
1. **Backend Chatterbox** - Best quality, paralinguistic tags
2. **Browser speechSynthesis** - Native, no network needed

### STT Fallback Chain
1. **Web Speech API** - Native, real-time (Chrome/Edge)
2. **MediaRecorder + Backend** - Record audio, send for transcription
3. **Not supported** - Firefox/Safari without backend

## Features

- ✅ **Real-time audio energy** for Persona lip-sync
- ✅ **Paralinguistic tags** support ([laugh], [sigh], etc.)
- ✅ **Voice cloning** from reference audio
- ✅ **Multiple voice engines** (Chatterbox, XTTS, Piper)
- ✅ **Auto health checking** with fallback
- ✅ **Persistent settings** (localStorage)
- ✅ **TypeScript** fully typed
- ✅ **React hooks** for easy integration
