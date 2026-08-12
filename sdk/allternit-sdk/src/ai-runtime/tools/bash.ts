import type { ToolDefinition } from './types.js';

export interface BashResult {
  stdout: string;
  stderr: string;
  exit_code: number;
  success: boolean;
}

export interface BashRunner {
  run(args: { command: string; timeout?: number; restart?: boolean }): Promise<BashResult>;
}

export interface BashToolOptions {
  runner?: BashRunner;
}

export class BashTool {
  private readonly runner: BashRunner;

  constructor(options: BashToolOptions = {}) {
    this.runner = options.runner ?? defaultBashRunner();
  }

  definition(): ToolDefinition {
    return {
      name: 'bash',
      description: 'Execute a shell command with optional timeout and restart control.',
      input_schema: {
        type: 'object',
        properties: {
          command: { type: 'string', description: 'The shell command to execute' },
          timeout: { type: 'integer', description: 'Timeout in seconds (default: 30)' },
          restart: { type: 'boolean', description: 'Whether to restart a fresh shell environment' },
        },
        required: ['command'],
      },
      metadata: { category: 'system', isDestructive: true },
      execute: async (args: { command: string; timeout?: number; restart?: boolean }) => {
        const command = requiredString(args.command, 'command');
        const timeout = typeof args.timeout === 'number' && args.timeout > 0 ? args.timeout : 30;
        const restart = args.restart === true;
        return this.runner.run({ command, timeout, restart });
      },
    };
  }
}

function defaultBashRunner(): BashRunner {
  return {
    run: async ({ command, timeout = 30 }) => {
      const { execFile } = await import('node:child_process');
      const { promisify } = await import('node:util');
      const execAsync = promisify(execFile);
      try {
        const { stdout, stderr } = await execAsync('sh', ['-c', command], {
          timeout: timeout * 1000,
          killSignal: 'SIGTERM',
        });
        return {
          stdout: stdout ?? '',
          stderr: stderr ?? '',
          exit_code: 0,
          success: true,
        };
      } catch (error: any) {
        return {
          stdout: error.stdout ?? '',
          stderr: error.stderr ?? error.message ?? '',
          exit_code: typeof error.code === 'number' ? error.code : 1,
          success: false,
        };
      }
    },
  };
}

function requiredString(value: string | undefined, name: string): string {
  if (typeof value !== 'string' || value.length === 0) throw new Error(`${name} is required`);
  return value;
}
