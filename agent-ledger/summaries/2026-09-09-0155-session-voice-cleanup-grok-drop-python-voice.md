# Session attestation — session/voice-cleanup (2026-09-09 01:55)

## What was done

Removed the unused Python voice stack after PR #192 landed the Rust + whisper.cpp sidecar.

Deleted Chatterbox (`services/voice/voice/`), FastAPI (`services/voice/api/`), `launch.py`, `packaged_main.py`, pyinstaller spec, and the Python Dockerfile. `start.sh` now runs `cargo run -p voice-service`. Live dev scripts that still pointed at `4-services/ml-ai-services/voice-service` + a venv now start the Rust crate.

## How it works

`services/voice/` is only the Rust crate, `build-whisper.sh`, spec, and README. Desktop and Gizzi already spawn that crate. Nothing in the runtime path loads Python TTS/STT.

## Verification evidence

- `cargo test -p voice-service` passed after the deletion.
- `git ls-files services/voice` is the Rust tree only.
- PR #194 merge commit `13c331ead`. Desktop vitest and desktop typecheck+build passed. Vercel/Cloudflare failures are pre-existing deploy limits.

## Incidents / honest deferrals

- TTS is still a contract stub (unchanged from #192).
- Historical audits, archive scripts, and ledger entries still mention the old Python path on purpose.
- ACU `launch.py` is a different service and was not touched.
