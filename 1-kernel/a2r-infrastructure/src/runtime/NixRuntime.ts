import { spawn } from 'child_process';
import { promisify } from 'util';
import { exec } from 'child_process';
import { Target, Connection, CommandResult } from './EnvironmentEngine';

const execAsync = promisify(exec);

export interface NixConfig {
  experimentalFeatures?: string[];
  substituters?: string[];
  trustedPublicKeys?: string[];
  maxJobs?: number;
  cores?: number;
  useBinaryCache?: boolean;
}

export interface FlakeRef {
  type: 'github' | 'gitlab' | 'path' | 'git' | 'tarball';
  owner?: string;
  repo?: string;
  ref?: string;
  rev?: string;
  dir?: string;
  url?: string;
}

export interface BuildResult {
  drvPath: string;
  outPaths: string[];
  buildTime: number;
  cacheHit: boolean;
}

export interface ShellSession {
  id: string;
  flakeUri: string;
  pid: number;
  storePath: string;
  environment: Record<string, string>;
  packages: string[];
  status: 'active' | 'exited' | 'error';
}

export interface Environment {
  id: string;
  flakeUri: string;
  storePath: string;
  status: 'building' | 'ready' | 'error';
  buildResult?: BuildResult;
  shellSessions: ShellSession[];
}

export interface FlakeOutputs {
  packages?: Record<string, Record<string, unknown>>;
  devShells?: Record<string, Record<string, unknown>>;
  apps?: Record<string, Record<string, unknown>>;
  checks?: Record<string, Record<string, unknown>>;
  templates?: Record<string, { path: string; description: string }>;
  formatter?: Record<string, unknown>;
}

export class NixRuntime {
  private environments: Map<string, Environment> = new Map();
  private shellSessions: Map<string, ShellSession> = new Map();
  private config: NixConfig;

  constructor(config: NixConfig = {}) {
    this.config = {
      experimentalFeatures: ['nix-command', 'flakes'],
      substituters: ['https://cache.nixos.org'],
      trustedPublicKeys: ['cache.nixos.org-1:6NCHdD59X431o0gWypbMrAURkbJ16ZPMQFGspcDShjY='],
      maxJobs: 4,
      cores: 0, // 0 means use all available
      useBinaryCache: true,
      ...config,
    };
  }

  /**
   * Provision a Nix environment from a flake
   */
  async provision(flakeUri: string, target: Target, conn?: Connection): Promise<Environment> {
    const envId = `nix-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    
    const environment: Environment = {
      id: envId,
      flakeUri,
      storePath: '',
      status: 'building',
      shellSessions: [],
    };

    this.environments.set(envId, environment);

    try {
      // Build the flake
      const buildResult = await this.buildFlake(flakeUri, conn);
      environment.buildResult = buildResult;
      environment.storePath = buildResult.outPaths[0];

      // Create initial shell session
      const shellSession = await this.enterShell(flakeUri, conn);
      environment.shellSessions.push(shellSession);

      environment.status = 'ready';
      return environment;
    } catch (error) {
      environment.status = 'error';
      throw error;
    }
  }

  /**
   * Build a Nix flake
   */
  async buildFlake(flakeUri: string, conn?: Connection): Promise<BuildResult> {
    const startTime = Date.now();
    
    // Ensure nix is available
    await this.ensureNix(conn);

    // Parse flake reference
    const parsedFlake = this.parseFlakeRef(flakeUri);
    
    // Build command with proper flags
    const nixFlags = this.buildNixFlags();
    const buildCmd = `nix build ${nixFlags} ${flakeUri} --json --no-link`;

    let output: string;
    if (conn) {
      const result = await conn.execute(buildCmd);
      if (result.exitCode !== 0) {
        throw new Error(`Nix build failed: ${result.stderr}`);
      }
      output = result.stdout;
    } else {
      const { stdout, stderr } = await execAsync(buildCmd);
      output = stdout;
    }

    const buildInfo = JSON.parse(output)[0];
    const buildTime = Date.now() - startTime;

    return {
      drvPath: buildInfo.drvPath,
      outPaths: buildInfo.outputs.out ? [buildInfo.outputs.out] : Object.values(buildInfo.outputs),
      buildTime,
      cacheHit: buildTime < 5000, // Rough heuristic
    };
  }

  /**
   * Enter a Nix shell from a flake
   */
  async enterShell(flakeUri: string, conn?: Connection): Promise<ShellSession> {
    const sessionId = `shell-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    
    // Get the environment info first
    const envInfo = await this.getFlakeInfo(flakeUri, conn);
    
    const nixFlags = this.buildNixFlags();
    
    // Create a detached shell process
    const shellCmd = `nix develop ${nixFlags} ${flakeUri} --command echo "SHELL_READY"`;
    
    let pid: number;
    if (conn) {
      const result = await conn.execute(shellCmd);
      if (result.exitCode !== 0) {
        throw new Error(`Failed to enter shell: ${result.stderr}`);
      }
      pid = 0; // Remote shell, PID not directly accessible
    } else {
      // For local, we can spawn and get PID
      const child = spawn('nix', [
        'develop',
        ...nixFlags.split(' '),
        flakeUri,
        '--command',
        'echo',
        'SHELL_READY'
      ], {
        detached: true,
        stdio: 'pipe',
      });
      
      pid = child.pid || 0;
      
      await new Promise((resolve, reject) => {
        child.on('exit', (code) => {
          if (code === 0) {
            resolve(undefined);
          } else {
            reject(new Error(`Shell exited with code ${code}`));
          }
        });
        child.on('error', reject);
      });
    }

    const session: ShellSession = {
      id: sessionId,
      flakeUri,
      pid,
      storePath: envInfo.storePath,
      environment: envInfo.environment,
      packages: envInfo.packages,
      status: 'active',
    };

    this.shellSessions.set(sessionId, session);
    return session;
  }

  /**
   * Execute a command in a shell session
   */
  async executeCommand(
    shellId: string, 
    command: string, 
    conn?: Connection
  ): Promise<CommandResult> {
    const session = this.shellSessions.get(shellId);
    if (!session) {
      throw new Error(`Shell session not found: ${shellId}`);
    }

    const nixFlags = this.buildNixFlags();
    const fullCmd = `nix develop ${nixFlags} ${session.flakeUri} --command sh -c '${command.replace(/'/g, "'\"'\"'")}'`;
    
    if (conn) {
      return await conn.execute(fullCmd);
    } else {
      const startTime = Date.now();
      try {
        const { stdout, stderr } = await execAsync(fullCmd);
        return {
          stdout,
          stderr,
          exitCode: 0,
          duration: Date.now() - startTime,
        };
      } catch (error) {
        const execError = error as { stdout?: string; stderr?: string; code?: number };
        return {
          stdout: execError.stdout || '',
          stderr: execError.stderr || '',
          exitCode: execError.code || 1,
          duration: Date.now() - startTime,
        };
      }
    }
  }

  /**
   * Destroy a Nix environment
   */
  async destroy(envId: string, conn?: Connection): Promise<void> {
    const environment = this.environments.get(envId);
    if (!environment) {
      throw new Error(`Environment not found: ${envId}`);
    }

    // Stop all shell sessions
    for (const session of environment.shellSessions) {
      await this.destroyShell(session.id, conn);
    }

    // Garbage collect if requested
    // await this.gc(conn);

    this.environments.delete(envId);
  }

  /**
   * Destroy a shell session
   */
  async destroyShell(shellId: string, conn?: Connection): Promise<void> {
    const session = this.shellSessions.get(shellId);
    if (!session) {
      return;
    }

    if (session.pid > 0) {
      try {
        process.kill(session.pid, 'SIGTERM');
      } catch {
        // Process may already be dead
      }
    }

    session.status = 'exited';
    this.shellSessions.delete(shellId);
  }

  /**
   * Check if a shell/forge is healthy
   */
  async isHealthy(shellId: string, conn?: Connection): Promise<boolean> {
    const session = this.shellSessions.get(shellId);
    if (!session) {
      return false;
    }

    try {
      const result = await this.executeCommand(shellId, 'echo "HEALTH_CHECK"', conn);
      return result.exitCode === 0;
    } catch {
      return false;
    }
  }

  /**
   * Get flake metadata
   */
  async getFlakeMetadata(flakeUri: string, conn?: Connection): Promise<{
    description?: string;
    lastModified: number;
    locked: boolean;
    lockedUrl: string;
    originalUrl: string;
    path: string;
    revision?: string;
    url: string;
  }> {
    const cmd = `nix flake metadata ${flakeUri} --json`;
    
    let output: string;
    if (conn) {
      const result = await conn.execute(cmd);
      output = result.stdout;
    } else {
      const { stdout } = await execAsync(cmd);
      output = stdout;
    }

    return JSON.parse(output);
  }

  /**
   * Get flake outputs
   */
  async getFlakeOutputs(flakeUri: string, conn?: Connection): Promise<FlakeOutputs> {
    const cmd = `nix flake show ${flakeUri} --json`;
    
    let output: string;
    if (conn) {
      const result = await conn.execute(cmd);
      output = result.stdout;
    } else {
      const { stdout } = await execAsync(cmd);
      output = stdout;
    }

    return JSON.parse(output);
  }

  /**
   * Update flake inputs
   */
  async updateFlake(flakeUri: string, conn?: Connection): Promise<void> {
    const cmd = `nix flake update ${flakeUri}`;
    
    if (conn) {
      const result = await conn.execute(cmd);
      if (result.exitCode !== 0) {
        throw new Error(`Failed to update flake: ${result.stderr}`);
      }
    } else {
      await execAsync(cmd);
    }
  }

  /**
   * Run garbage collection
   */
  async gc(conn?: Connection): Promise<{ freedBytes: number }> {
    const cmd = 'nix-collect-garbage -d';
    
    if (conn) {
      const result = await conn.execute(cmd);
      if (result.exitCode !== 0) {
        throw new Error(`GC failed: ${result.stderr}`);
      }
    } else {
      await execAsync(cmd);
    }

    return { freedBytes: 0 }; // Parse from output if needed
  }

  /**
   * List all environments
   */
  listEnvironments(): Environment[] {
    return Array.from(this.environments.values());
  }

  /**
   * List all shell sessions
   */
  listShellSessions(): ShellSession[] {
    return Array.from(this.shellSessions.values());
  }

  private async ensureNix(conn?: Connection): Promise<void> {
    const checkCmd = 'which nix';
    
    let result: { exitCode: number };
    if (conn) {
      result = await conn.execute(checkCmd);
    } else {
      try {
        await execAsync(checkCmd);
        result = { exitCode: 0 };
      } catch {
        result = { exitCode: 1 };
      }
    }

    if (result.exitCode !== 0) {
      throw new Error('Nix is not installed on the target system');
    }
  }

  private parseFlakeRef(flakeUri: string): FlakeRef {
    // github:owner/repo/ref
    if (flakeUri.startsWith('github:')) {
      const parts = flakeUri.substring(7).split('/');
      return {
        type: 'github',
        owner: parts[0],
        repo: parts[1],
        ref: parts[2] || 'main',
      };
    }

    // path:/path/to/flake
    if (flakeUri.startsWith('path:')) {
      return {
        type: 'path',
        url: flakeUri.substring(5),
      };
    }

    // Relative path
    if (flakeUri.startsWith('.') || flakeUri.startsWith('/')) {
      return {
        type: 'path',
        url: flakeUri,
      };
    }

    // Default to treating as path
    return {
      type: 'path',
      url: flakeUri,
    };
  }

  private buildNixFlags(): string {
    const flags: string[] = [];

    if (this.config.experimentalFeatures) {
      flags.push(`--extra-experimental-features "${this.config.experimentalFeatures.join(' ')}"`);
    }

    if (this.config.substituters && this.config.useBinaryCache !== false) {
      for (const sub of this.config.substituters) {
        flags.push(`--option substituters "${sub}"`);
      }
    }

    if (this.config.maxJobs !== undefined) {
      flags.push(`--max-jobs ${this.config.maxJobs}`);
    }

    if (this.config.cores !== undefined && this.config.cores > 0) {
      flags.push(`--cores ${this.config.cores}`);
    }

    return flags.join(' ');
  }

  private async getFlakeInfo(
    flakeUri: string, 
    conn?: Connection
  ): Promise<{ storePath: string; environment: Record<string, string>; packages: string[] }> {
    // Get the store path
    const evalCmd = `nix eval ${flakeUri}#devShells.default.outPath --json`;
    
    let storePath: string;
    if (conn) {
      const result = await conn.execute(evalCmd);
      storePath = JSON.parse(result.stdout);
    } else {
      const { stdout } = await execAsync(evalCmd);
      storePath = JSON.parse(stdout);
    }

    // Get packages in the shell
    const packagesCmd = `nix eval ${flakeUri}#devShells.default.buildInputs --json 2>/dev/null || echo "[]"`;
    
    let packages: string[] = [];
    try {
      let output: string;
      if (conn) {
        const result = await conn.execute(packagesCmd);
        output = result.stdout;
      } else {
        const { stdout } = await execAsync(packagesCmd);
        output = stdout;
      }
      packages = JSON.parse(output);
    } catch {
      // Package list not available
    }

    return {
      storePath,
      environment: {},
      packages,
    };
  }
}
