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

// Auto-added export


// Merge-by-re-export: complete counterpart (local exports win on conflict)
export * from '../../../cli/ui/ink-app/services/lsp/manager.js'