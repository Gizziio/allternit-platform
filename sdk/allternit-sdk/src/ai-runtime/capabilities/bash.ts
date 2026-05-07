import type { ToolDefinition } from '../tools/types.ts';
import type { IEnvironment } from '../environment/types.ts';

export const BASH_TOOL: ToolDefinition = {
  name: 'bash',
  description: 'Execute shell commands inside the sandboxed environment.',
  input_schema: {
    type: 'object',
    properties: {
      command: { type: 'string', description: 'The shell command to execute' }
    },
    required: ['command']
  },
  metadata: {
    category: 'system',
    isDestructive: true
  }
};

export class BashCapability {
  constructor(private environment: IEnvironment) {}

  public getTool(): ToolDefinition {
    return {
      ...BASH_TOOL,
      execute: async (args: { command: string }) => {
        const result = await this.environment.execute('sh', ['-c', args.command]);
        return result.stdout + result.stderr;
      }
    };
  }
}
