/**
 * Worker agent stub
 */

export interface WorkerAgentConfig {
  id: string
  task: string
}
export class WorkerAgent {
  constructor(_config: WorkerAgentConfig) {
    // Stub
  }
  async run(): Promise<any> {
    return null;
  }
}
