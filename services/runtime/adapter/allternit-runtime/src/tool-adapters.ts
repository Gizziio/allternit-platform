import { ToolExecutor } from '@allternit/engine';

export class ToolAdapters {
  constructor(private executor: ToolExecutor) {}

  // This will adapt first-party tool executor to the expected runtime interface
  // which might be used by services.
  async runTool(name: string, args: any, agentId: string) {
    return await this.executor.execute({
      tool: name,
      arguments: args,
      context: { agentId } as any
    });
  }
}
