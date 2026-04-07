/**
 * Monitor MCP Task
 * TEMPORARY SHIM
 */

export type MonitorMcpTaskState = {
  type: 'monitor_mcp'
  id: string
  status: 'running' | 'completed' | 'failed'
  description: string
  notified: boolean
  startTime: number
  endTime?: number
  outputFile: string
  outputOffset: number
  toolUseId?: string
}

export class MonitorMcpTask {
  id: string

  constructor(id: string) {
    this.id = id
  }

  async run(): Promise<void> {
    // TODO: implement
  }
}

// Stub function referenced by BackgroundTasksDialog
export function killMonitorMcp(_id: string, _setAppState?: unknown): void {
  // TODO: implement
}

export default MonitorMcpTask
