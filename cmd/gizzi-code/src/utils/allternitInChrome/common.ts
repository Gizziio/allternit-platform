/**
 * Allternit in Chrome Common
 */

export interface ChromeConnectionConfig {
  host: string
  port: number
}

export function getChromeConnectionConfig(): ChromeConnectionConfig {
  return { host: 'localhost', port: 9222 }
}

// Merge-by-re-export: complete counterpart (local exports win on conflict)
export * from '../../shared/utils/allternitInChrome/common.js'
