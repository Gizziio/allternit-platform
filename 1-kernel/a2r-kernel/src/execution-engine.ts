import { spawn, execFile } from 'node:child_process';
import { promisify } from 'node:util';
import path from 'node:path';

const execFileAsync = promisify(execFile);

export interface ExecutionOptions {
  cwd?: string;
  env?: NodeJS.ProcessEnv;
  timeoutMs?: number;
  maxBuffer?: number;
  sandbox?: boolean;
}

export interface ExecutionResult {
  stdout: string;
  stderr: string;
  exitCode: number | null;
  signal: NodeJS.Signals | null;
  killed: boolean;
}

export class ExecutionEngine {
  /**
   * Resolves a command for platform compatibility.
   */
  private resolveCommand(command: string): string {
    if (process.platform !== 'win32') {
      return command;
    }
    const basename = path.basename(command).toLowerCase();
    const ext = path.extname(basename);
    if (ext) {
      return command;
    }
    const cmdCommands = ['npm', 'pnpm', 'yarn', 'npx'];
    if (cmdCommands.includes(basename)) {
      return command + '.cmd';
    }
    return command;
  }

  /**
   * Executes a command and waits for completion.
   */
  async run(
    command: string,
    args: string[],
    options: ExecutionOptions = {}
  ): Promise<ExecutionResult> {
    const {
      cwd,
      env,
      timeoutMs = 30000,
      maxBuffer = 1024 * 1024 * 10, // 10MB
    } = options;

    try {
      const { stdout, stderr } = await execFileAsync(
        this.resolveCommand(command),
        args,
        {
          cwd,
          env: { ...process.env, ...env },
          timeout: timeoutMs,
          maxBuffer,
          encoding: 'utf8',
        }
      );

      return {
        stdout,
        stderr,
        exitCode: 0,
        signal: null,
        killed: false,
      };
    } catch (error: any) {
      return {
        stdout: error.stdout || '',
        stderr: error.stderr || error.message || '',
        exitCode: error.code || 1,
        signal: error.signal || null,
        killed: !!error.killed,
      };
    }
  }

  /**
   * Spawns a long-running process.
   */
  spawn(
    command: string,
    args: string[],
    options: ExecutionOptions = {}
  ) {
    const { cwd, env, timeoutMs } = options;

    const child = spawn(this.resolveCommand(command), args, {
      cwd,
      env: { ...process.env, ...env },
      stdio: 'pipe',
    });

    if (timeoutMs) {
      setTimeout(() => {
        if (!child.killed) {
          child.kill('SIGKILL');
        }
      }, timeoutMs);
    }

    return child;
  }
}
