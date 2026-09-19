/**
 * Spinner Types
 * TEMPORARY SHIM
 */

export interface SpinnerState {
  isSpinning: boolean
  message?: string
}

export type SpinnerType = 'default' | 'small' | 'large'

// Spinner stream modes. Recovered from the pre-compilation sources of the
// spinner components (artifact sourcemaps) and the streamMode call sites in
// REPL/messages — the original definition was lost with the shim above.
export type SpinnerMode = 'requesting' | 'responding' | 'thinking' | 'tool-use' | 'tool-input'

export default { }
