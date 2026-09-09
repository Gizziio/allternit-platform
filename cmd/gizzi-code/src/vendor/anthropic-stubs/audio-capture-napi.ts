// @ts-nocheck
// Stub for the optional native `audio-capture-napi` package (voice capture),
// bundled by build-production.js when the real native module is absent.
// It must export the full module shape: every caller gates native capture
// behind `isNativeAudioAvailable()`, so reporting "unavailable" routes voice
// to the sox/arecord fallback exactly as a machine without the native module.

export function isNativeAudioAvailable(): boolean {
  return false
}

export function isNativeRecordingActive(): boolean {
  return false
}

export async function startNativeRecording(): Promise<void> {
  throw new Error(
    'audio-capture-napi is not bundled in this build; native capture is unavailable',
  )
}

export async function stopNativeRecording(): Promise<void> {}

export async function captureAudio() {
  throw new Error(
    'audio-capture-napi is not bundled in this build; native capture is unavailable',
  )
}
