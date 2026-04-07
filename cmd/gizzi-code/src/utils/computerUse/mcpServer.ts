/**
 * Computer Use MCP Server
 */

export interface ComputerUseMcpServer {
  start(): Promise<void>
  stop(): Promise<void>
}

export function createComputerUseMcpServer(): ComputerUseMcpServer {
  return {
    start: async () => {},
    stop: async () => {},
  }
}
