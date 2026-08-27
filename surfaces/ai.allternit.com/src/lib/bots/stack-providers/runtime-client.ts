/**
 * Stack Provider Runtime Client
 *
 * External agent providers need to execute commands on the local machine
 * (e.g. `hermes -p <profile> chat ...`). In the browser that is not possible,
 * so providers delegate to a runtime client. The desktop sidecar implements the
 * real client; tests and non-desktop contexts supply a fake or no-op client.
 *
 * @module stack-providers/runtime-client
 */

export interface CommandResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

export interface StackRuntimeClient {
  /** True if the runtime can execute local commands */
  isAvailable(): boolean;

  /** Execute a command and return its output */
  exec(command: string, args: string[], options?: { cwd?: string; env?: Record<string, string> }): Promise<CommandResult>;

  /** Execute a command and stream stdout line-by-line */
  spawn(command: string, args: string[], options?: { cwd?: string; env?: Record<string, string> }): AsyncIterable<string>;

  /** Read a file from the local filesystem (used for memory sync) */
  readFile?(path: string): Promise<string>;

  /** List files in a local directory */
  listDirectory?(path: string): Promise<string[]>;
}

/**
 * No-op runtime client used when no desktop sidecar is available.
 */
export const noopRuntimeClient: StackRuntimeClient = {
  isAvailable: () => false,
  exec: async () => ({ stdout: '', stderr: 'No local runtime available', exitCode: 1 }),
  async *spawn() {
    yield 'No local runtime available';
  },
};

/**
 * Default runtime client: prefers the desktop sidecar, falls back to no-op.
 */
export function getDefaultRuntimeClient(): StackRuntimeClient {
  if (typeof window === 'undefined') {
    return noopRuntimeClient;
  }

  const sidecar = (window as any).allternitSidecar as any;
  if (sidecar && typeof sidecar.stack?.executeCommand === 'function') {
    return new SidecarRuntimeClient(sidecar);
  }

  return noopRuntimeClient;
}

class SidecarRuntimeClient implements StackRuntimeClient {
  constructor(private sidecar: any) {}

  isAvailable(): boolean {
    return true;
  }

  async exec(command: string, args: string[], options?: { cwd?: string; env?: Record<string, string> }): Promise<CommandResult> {
    return this.sidecar.stack.executeCommand({ command, args, cwd: options?.cwd, env: options?.env });
  }

  async *spawn(command: string, args: string[], options?: { cwd?: string; env?: Record<string, string> }): AsyncIterable<string> {
    const stream = await this.sidecar.stack.spawnCommand({ command, args, cwd: options?.cwd, env: options?.env });
    if (!stream || typeof stream[Symbol.asyncIterator] !== 'function') {
      yield 'Runtime did not return a command stream';
      return;
    }
    for await (const line of stream) {
      yield typeof line === 'string' ? line : String(line);
    }
  }

  async readFile(path: string): Promise<string> {
    return this.sidecar.stack.readFile(path);
  }

  async listDirectory(path: string): Promise<string[]> {
    return this.sidecar.stack.listDirectory(path);
  }
}
