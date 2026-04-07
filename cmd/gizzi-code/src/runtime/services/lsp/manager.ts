/**
 * LSP Manager
 */

export interface LspManager {
  start(): Promise<void>
  stop(): Promise<void>
}

export function createLspManager(): LspManager {
  return {
    start: async () => {},
    stop: async () => {},
  }
}
