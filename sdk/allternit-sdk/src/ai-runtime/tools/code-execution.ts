import type { ToolDefinition } from './types.js';

export type CodeExecutionLanguage = 'python' | 'python3' | 'node' | 'javascript' | 'bash' | 'sh' | 'rust' | string;

export interface CodeExecutionArtifact {
  name: string;
  content_type?: string;
  content: string;
}

export interface CodeExecutionResult {
  stdout: string;
  stderr: string;
  exit_code: number;
  success: boolean;
  artifacts?: CodeExecutionArtifact[];
}

export interface CodeExecutionRequest {
  language: CodeExecutionLanguage;
  code: string;
  timeout_seconds?: number;
  dependencies?: string[];
}

export interface CodeExecutionRunner {
  execute(request: CodeExecutionRequest): Promise<CodeExecutionResult>;
}

export interface CodeExecutionOptions {
  runner?: CodeExecutionRunner;
}

export class CodeExecutionTool {
  private readonly runner: CodeExecutionRunner;

  constructor(options: CodeExecutionOptions = {}) {
    this.runner = options.runner ?? defaultCodeExecutionRunner();
  }

  definition(): ToolDefinition {
    return {
      name: 'code_execution',
      description: 'Execute code in a sandboxed environment. Supports python, node, bash, and rust. Optional dependencies may be requested.',
      input_schema: {
        type: 'object',
        properties: {
          language: {
            type: 'string',
            enum: ['python', 'python3', 'node', 'javascript', 'bash', 'sh', 'rust'],
            description: 'Programming language to execute',
          },
          code: { type: 'string', description: 'Source code to run' },
          timeout_seconds: { type: 'integer', description: 'Timeout in seconds (default: 30)' },
          dependencies: {
            type: 'array',
            items: { type: 'string' },
            description: 'Optional package or dependency names to install before running',
          },
        },
        required: ['language', 'code'],
      },
      metadata: { category: 'system', isDestructive: true },
      execute: async (args: CodeExecutionRequest) => {
        const language = requiredString(args.language, 'language');
        const code = requiredString(args.code, 'code');
        const timeout_seconds = typeof args.timeout_seconds === 'number' && args.timeout_seconds > 0 ? args.timeout_seconds : 30;
        const dependencies = Array.isArray(args.dependencies) ? args.dependencies.filter((d): d is string => typeof d === 'string') : undefined;
        return this.runner.execute({ language, code, timeout_seconds, dependencies });
      },
    };
  }
}

function defaultCodeExecutionRunner(): CodeExecutionRunner {
  return {
    execute: async (request) => {
      const interpreter = resolveInterpreter(request.language);
      const { execFile } = await import('node:child_process');
      const { promisify } = await import('node:util');
      const execAsync = promisify(execFile);

      let finalCode = request.code;
      if (request.dependencies && request.dependencies.length > 0) {
        const installer = dependencyCommand(request.language, request.dependencies);
        if (installer) {
          finalCode = `${installer}\n${finalCode}`;
        }
      }

      const flag = request.language.toLowerCase().startsWith('node') || request.language.toLowerCase() === 'javascript' ? '-e' : '-c';
      try {
        const { stdout, stderr } = await execFile('sh', ['-c', `${interpreter} ${flag} '${finalCode.replace(/'/g, "'\\''")}'`], {
          timeout: request.timeout_seconds * 1000,
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

function resolveInterpreter(language: string): string {
  switch (language.toLowerCase()) {
    case 'python':
    case 'python3':
      return 'python3';
    case 'node':
    case 'javascript':
      return 'node';
    case 'bash':
    case 'sh':
      return 'bash';
    case 'rust':
      return 'rustc';
    default:
      return language;
  }
}

function dependencyCommand(language: string, dependencies: string[]): string | undefined {
  switch (language.toLowerCase()) {
    case 'python':
    case 'python3':
      return `pip install --quiet ${dependencies.join(' ')}`;
    case 'node':
    case 'javascript':
      return `npm install --silent ${dependencies.join(' ')}`;
    default:
      return undefined;
  }
}

function requiredString(value: string | undefined, name: string): string {
  if (typeof value !== 'string' || value.length === 0) throw new Error(`${name} is required`);
  return value;
}
