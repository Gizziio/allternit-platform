// status.mjs — /hello response body. Factored out of index.mjs so the
// stale/frozen reporting is unit-testable with a mocked capture (no screen,
// no server). `dead` on the capture is a string reason once the capture is
// unrecoverable in-process (watchdog tripped twice or the helper is gone),
// null while frames are flowing.

export function helloBody({ capture, captureMode, fps, input, inputDryRun, display }) {
  const dead = capture?.dead ?? null;
  return {
    capture: { mode: capture?.actualMode ?? captureMode, fps, ...((capture?.lastInfo) || {}) },
    input: input ? { enabled: true, dryRun: inputDryRun, accessibilityTrusted: input.ready?.accessibilityTrusted ?? null } : { enabled: false },
    display: display ?? null,
    hasFrame: Boolean(capture?.lastFrame),
    stale: Boolean(dead),
    ...(dead ? { error: dead } : {}),
  };
}
