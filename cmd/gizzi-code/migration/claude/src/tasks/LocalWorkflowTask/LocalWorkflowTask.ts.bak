/**
 * Local Workflow Task
 * TEMPORARY SHIM
 */

export interface WorkflowTaskConfig {
  name: string
  steps: unknown[]
}

// Types needed by BackgroundTasksDialog
export type LocalWorkflowTaskState = {
  type: 'local_workflow'
  id: string
  status: 'running' | 'completed' | 'failed'
  summary?: string
  description: string
  notified: boolean
  startTime: number
  endTime?: number
  outputFile: string
  outputOffset: number
  toolUseId?: string
}

export class LocalWorkflowTask {
  config: WorkflowTaskConfig

  constructor(config: WorkflowTaskConfig) {
    this.config = config
  }

  async execute(): Promise<unknown> {
    return { success: true }
  }
}

// Stub functions referenced by BackgroundTasksDialog
export function killWorkflowTask(_id: string, _setAppState?: unknown): void {
  // TODO: implement
}

export function skipWorkflowAgent(_id: string, _agentId: string, _setAppState?: unknown): void {
  // TODO: implement
}

export function retryWorkflowAgent(_id: string, _agentId: string, _setAppState?: unknown): void {
  // TODO: implement
}

export default LocalWorkflowTask
