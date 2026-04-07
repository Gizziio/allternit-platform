/**
 * Claude in Chrome MCP Server
 */

export interface ChromeMcpServer {
  start(): Promise<void>
  stop(): Promise<void>
}

export function createChromeMcpServer(): ChromeMcpServer {
  return {
    start: async () => {},
    stop: async () => {},
  }
}
