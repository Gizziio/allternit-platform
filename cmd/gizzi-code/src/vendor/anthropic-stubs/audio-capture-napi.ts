// @ts-nocheck
// Stub for the optional native `audio-capture-napi` package (voice capture).
// It is only loaded dynamically by the voice service; importing this stub
// throws a loud, actionable error that the voice service's existing fallback
// path catches.

throw new Error(
  'audio-capture-napi is not bundled in this build. Voice capture is unavailable; ' +
    'install the native package to enable it.',
)
