/**
 * System theme watcher stub
 */

export function watchSystemTheme(_callback: (isDark: boolean) => void): () => void {
  return () => {}
}

export function getSystemTheme(): 'dark' | 'light' {
  return 'dark'
}
