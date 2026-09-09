# Desktop — Known Issues

Known issues in the Allternit Desktop packaged app (build + run), observed during a fresh packaging run from latest `main` on 2026-09-08. All four were also present in the prior 2026-09-05 build — they are **pre-existing**, not regressions.

Log evidence lives in `~/Library/Application Support/@allternit/desktop/main.log` (the file rotates; the Sep 8 run's entries shown below were captured from that log during the packaging run).

---

## 1. Voice service binary crashes at startup — **replaced**

- **Was:** The pyinstaller-bundled `allternit-voice-service` crashed on import (`pyexpat` built for macOS 26.0, host 23.6); Voice Mode unavailable.
- **Now:** Desktop spawns the Rust `voice-service` sidecar, which shells out to `whisper-cli` (whisper.cpp, MIT) for local STT. Python/pyinstaller is no longer the primary path. Gizzi Code and the desktop composer expose `/voice` (Ctrl+Space / F8 hold-to-talk). The ggml-tiny.en model downloads on first use into `~/.allternit/models/whisper/` (not git-vendored).
- **Evidence:** Previous packaging-run log still shows the pyexpat ImportError for old builds; current `VoiceManager` resolves `allternit-voice-service` / `voice-service` from `resources/bin` and does not spawn `launch.py`.
- **Remaining:** TTS/Chatterbox is out of scope. First-run needs network once to fetch `ggml-tiny.en.bin` unless the model is already on disk.

## 2. ACU computer-use gateway exits immediately

- **Symptom:** The ACU computer-use gateway process starts and exits right away; the computer-use surface never comes up. Log line:
  ```
  ModuleNotFoundError: No module named 'uvicorn'
  ```
- **Root cause:** The gateway's `launch.py` is executed with the system `python3`, which does not have `uvicorn` installed. The project's dependency-managed python (venv / uv) has it.
- **Evidence:** `~/Library/Application Support/@allternit/desktop/main.log` (gateway spawn followed by immediate non-zero exit).
- **Suggested fix:** Launch the gateway with the project's venv/uv-managed python interpreter instead of system `python3`, or add `uvicorn` to the runtime deps the packaging step guarantees.
- **Pre-existing:** Yes — same failure in the 2026-09-05 build.

## 3. Port 8014 `EADDRINUSE` on app start (orphaned connector sidecar)

- **Symptom:** On app start the bundled connector sidecar fails to bind with:
  ```
  Error: listen EADDRINUSE: address already in use :::8014
  ```
- **Root cause:** A stale `node` sidecar process left over from the shared checkout's `services/open-connector` is still holding port 8014, so the app's own bundled sidecar cannot bind. The app already handles the equivalent problem for the operator API port (8013): `src/main/backend-manager.ts` (`terminateListenerOnPort`) and `src/main/local-engine-manager.ts` SIGTERM whatever listens on the owned port before spawning — but no equivalent cleanup exists for the sidecar port.
- **Evidence:** `~/Library/Application Support/@allternit/desktop/main.log` (EADDRINUSE on the sidecar port at startup); `lsof -i :8014` shows the orphaned node process.
- **Suggested fix / mitigation:** Extend the existing stale-listener cleanup to the sidecar port (detect and terminate a stale listener on 8014 before spawning the bundled sidecar, mirroring `terminateListenerOnPort`), or document the manual workaround: `lsof -ti :8014 | xargs kill`.
- **Pre-existing:** Yes — same conflict in the 2026-09-05 build.

## 4. Mesh fabric enrollment returns 502

- **Symptom:** Fabric enrollment initiated from the desktop app fails with a cloud-side `502` during enrollment (the `mesh-node` binary itself runs fine locally).
- **Root cause:** Server-side error on the fabric enrollment endpoint; the desktop client is not the failing component.
- **Evidence:** `~/Library/Application Support/@allternit/desktop/main.log` (enrollment request → 502 response).
- **Suggested fix:** Server-side investigation of the fabric enrollment endpoint. Desktop-side, the only available mitigation is retry/backoff on enrollment failure.
- **Pre-existing:** Yes — same 502 in the 2026-09-05 build.
