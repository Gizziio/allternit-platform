/**
 * Fullscreen utilities
 */

export function enterFullscreen(): Promise<void> {
  if (typeof process !== 'undefined' && process.stdout) {
    // Terminal fullscreen escape sequence
    process.stdout.write('\x1b[?1049h')
    return Promise.resolve()
  }
  return Promise.reject(new Error('Fullscreen not supported'))
}

export function exitFullscreen(): Promise<void> {
  if (typeof process !== 'undefined' && process.stdout) {
    // Exit terminal fullscreen
    process.stdout.write('\x1b[?1049l')
    return Promise.resolve()
  }
  return Promise.reject(new Error('Fullscreen not supported'))
}

export function isFullscreen(): boolean {
  // In terminal context, we can't reliably detect fullscreen
  return false
}

export function toggleFullscreen(): Promise<void> {
  return isFullscreen() ? exitFullscreen() : enterFullscreen()
}

export function clearScreen(): void {
  if (typeof process !== 'undefined' && process.stdout) {
    process.stdout.write('\x1b[2J\x1b[H')
  }
}

export function hideCursor(): void {
  if (typeof process !== 'undefined' && process.stdout) {
    process.stdout.write('\x1b[?25l')
  }
}

export function showCursor(): void {
  if (typeof process !== 'undefined' && process.stdout) {
    process.stdout.write('\x1b[?25h')
  }
}

export function alternateScreen(): void {
  if (typeof process !== 'undefined' && process.stdout) {
    process.stdout.write('\x1b[?1049h')
  }
}

export function mainScreen(): void {
  if (typeof process !== 'undefined' && process.stdout) {
    process.stdout.write('\x1b[?1049l')
  }
}

export default {
  enterFullscreen,
  exitFullscreen,
  isFullscreen,
  toggleFullscreen,
  clearScreen,
  hideCursor,
  showCursor,
  alternateScreen,
  mainScreen,
}
