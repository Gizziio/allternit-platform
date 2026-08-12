# ChatGPT Voice parity

ChatGPT Voice is a live spoken conversation that can combine microphone input, spoken responses, visual context, and delegated work. Allternit provides self-hosted STT/TTS services and ordinary agent orchestration, but the polished duplex consumer voice UI is still **roadmap**.

## Start talking

Run the optional voice service, then use its STT endpoint. The API gateway proxies voice discovery and streams at `/api/v1/voice/voices`, `/api/v1/voice/stt/stream`, and `/api/v1/voice/tts/stream`; it returns `503` if the voice service is unavailable.

```bash
# Direct voice service example
curl -s -F 'audio=@question.wav' -F 'language=en' \
  http://127.0.0.1:8001/v1/stt

curl -s http://127.0.0.1:8001/v1/tts \
  -H 'Content-Type: application/json' \
  -d '{"text":"Here is the result.","voice_id":"default"}'
```

The Rust service supplies a stable/simulated contract; the Python Chatterbox/Whisper wrapper supplies full inference when deployed. Native microphone capture is optional and is not bundled in every `gizzi-code` build, so a missing `audio-capture-napi` package means capture is unavailable even though HTTP STT remains usable.

## Have a conversation

Feed the transcription into an ordinary chat/session and send assistant text to TTS. The current APIs provide the pieces for turn-based spoken conversation; echo cancellation, interruption, and a polished full-duplex voice client remain roadmap.

## Delegate and coordinate work

Speech is an input/output transport, not a separate agent runtime. Transcribe the request, submit it to an agent/session/workflow, stream run progress, and synthesize the final response. Long-running coordination uses the same agent, task, Cowork, workflow, and swarm surfaces as typed chat; voice does not expand tool permissions.

## Show Allternit what you see

Use a file/image upload or ACI's `computer` screenshot action to add visual context. The SDK returns a base64 PNG image content block:

```typescript
const screenshot = await computer.getTool().execute(
  { action: 'screenshot' },
  { callId: 'voice-screen-1' }
);
```

Live mobile camera or screen-share directly inside a duplex voice conversation is **roadmap**. ACI can observe a configured desktop/browser, but it is not ambient camera access and remains governed by host permissions and human approvals.

See the [ACI guide](../aci/index.md) and [voice service API](../../../services/voice/spec/API.md).
