# Action Plan: Phase 6 Voice Embodiment

## Goal
Implement the Voice interface for the Embodiment Control Plane, enabling the Kernel to "hear" and "speak" via the host system.

## Phase 6: Voice Tasks
1.  **Voice Recording**:
    *   Implement `VoiceRecordTool` in `services/kernel/src/embodiment/desktop.rs`.
    *   Use system binaries (`rec` from SoX or `ffmpeg` if available, but for macOS default `sox` is common, or we can use a mock if binaries are missing).
    *   *Correction*: macOS doesn't have `rec` by default. We should check for `ffmpeg` or just use a mock for now to avoid external dependency hell, OR use `cpal` if we want to be Rust-native.
    *   *Decision*: Let's use `say` for speaking (built-in macOS) and implement a `VoiceSpeakTool`. For recording, without `sox`/`ffmpeg` installed, it's hard. We will implement `VoiceSpeakTool` first as it's guaranteed to work on macOS.

2.  **Voice Speaking**:
    *   Implement `VoiceSpeakTool` using `say` command on macOS.
    *   Parameters: `text`, `voice` (optional).

3.  **Integration**:
    *   Register `VoiceSpeakTool` in `DesktopDevice`.

## Affected Files
*   `services/kernel/src/embodiment/desktop.rs`

## Verification
*   Manual test: `a2 run "speak 'Hello World'"` (once CLI is ready) or via `curl`.
