# Session attestation — session/voice-slash (2026-09-09 01:35)

## What was done

Replaced the crashing pyinstaller voice sidecar (KNOWN-ISSUES #1) with local whisper.cpp STT and shipped a Grok-style `/voice` slash command on Gizzi Code and Allternit Desktop.

- Engine: ggml-org/whisper.cpp (`whisper-cli` + `ggml-tiny.en.bin`, MIT). No Python/torch, no Anthropic `voice_stream`.
- Rust `voice-service` `POST /v1/stt` runs whisper-cli. Model first-run download into `~/.allternit/models/whisper/`.
- Gizzi `/voice` is an always-on builtin. Hold Ctrl+Space or F8. `/doctor` Voice section.
- Desktop VoiceManager spawns the Rust binary, not `launch.py`. Composer `/voice` + same keybinds.
- Packaging requires `allternit-voice-service` + `whisper-cli`.

## How it works

Capture is PCM 16 kHz mono. The sidecar wraps WAV and shells out to `whisper-cli`. Gizzi falls back to spawning whisper-cli if `:8001` is down. Desktop renderer captures via ScriptProcessor, IPC `voice:transcribe` posts to the sidecar.

## Verification evidence

- `cargo test -p voice-service`: 2 unit + 8 integration passed.
- `bun test` wav helper: 2 passed.
- CI on PR #192: Gizzi typecheck, desktop typecheck+build, desktop vitest, smoke tests, gitleaks, secret scan, typography, ts-nocheck ratchet — pass. Vercel checks fail on a pre-existing deploy rate limit (not this change).
- PR #192 merge commit `bfe134675`.

## Incidents / honest deferrals

- Live mic smoke was not run in this session (no whisper-cli binary built here; first `POST /v1/stt` downloads the model).
- TTS / Chatterbox Python tree left in place, unused by desktop spawn.
- ACU uvicorn, port 8014, mesh 502 unchanged.
- Anthropic `VOICE_MODE` / `voice_stream` left gated and unused.
