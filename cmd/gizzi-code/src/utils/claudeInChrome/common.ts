/**
 * Claude in Chrome Common
 */

export interface ChromeConnectionConfig {
  host: string
  port: number
}

export function getChromeConnectionConfig(): ChromeConnectionConfig {
  return { host: 'localhost', port: 9222 }
}
