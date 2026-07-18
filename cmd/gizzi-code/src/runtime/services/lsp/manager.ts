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

// Merge-by-re-export: complete counterpart (local exports win on conflict)
export { _resetLspManagerForTesting, getInitializationStatus, getLspServerManager, initializeLspServerManager, isLspConnected, reinitializeLspServerManager, shutdownLspServerManager, waitForInitialization } from "../../../cli/ui/ink-app/services/lsp/manager.js";