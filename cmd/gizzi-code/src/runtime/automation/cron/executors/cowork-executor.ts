/**
 * Cowork Job Executor
 * 
 * Production implementation for executing jobs in cowork runtime environments.
 * Supports local, Docker, and VM execution modes.
 */

import { createLogger } from "../utils/logger";
import type { CronJob, CronRun } from "../types";

const log = createLogger("cron-cowork-executor");

export interface CoworkExecutorConfig {
  /** Default working directory */
  defaultCwd: string;
  /** Docker socket path (optional) */
  dockerSocket?: string;
  /** VM driver to use (apple_vf or firecracker) */
  vmDriver?: "apple_vf" | "firecracker";
  /** Cowork runtime endpoint */
  runtimeEndpoint?: string;
}

interface CoworkSession {
  id: string;
  runtime: "local" | "docker" | "vm";
  status: "creating" | "running" | "completed" | "failed";
  startTime: Date;
  endTime?: Date;
  exitCode?: number;
  output: string;
  error?: string;
}

export class CoworkExecutor {
  private config: CoworkExecutorConfig;
  private activeSessions = new Map<string, CoworkSession>();

  constructor(config: CoworkExecutorConfig) {
    this.config = config;
  }

  /**
   * Execute a cowork job
   */
  async execute(job: CronJob, run: CronRun, signal: AbortSignal): Promise<void> {
    const jobConfig = job.config as {
      runtime: "docker" | "vm" | "local";
      image?: string;
      commands: string[];
      env?: Record<string, string>;
      resources?: {
        cpus?: number;
        memory?: string;
        disk?: string;
      };
      timeoutMinutes?: number;
    };

    log.info("Starting cowork job execution", {
      jobId: job.id,
      runId: run.id,
      runtime: jobConfig.runtime,
      commands: jobConfig.commands,
    });

    const sessionKey = `${job.id}-${run.id}`;
    const session: CoworkSession = {
      id: sessionKey,
      runtime: jobConfig.runtime,
      status: "creating",
      startTime: new Date(),
      output: "",
    };
    this.activeSessions.set(sessionKey, session);

    try {
      switch (jobConfig.runtime) {
        case "local":
          await this.executeLocal(jobConfig, session, signal);
          break;
        case "docker":
          await this.executeDocker(jobConfig, session, signal);
          break;
        case "vm":
          await this.executeVM(jobConfig, session, signal);
          break;
        default:
          throw new Error(`Unknown runtime: ${jobConfig.runtime}`);
      }

      // Update run record
      run.output = session.output;
      run.exitCode = session.exitCode;
      run.finishedAt = new Date().toISOString();
      run.durationMs = session.endTime 
        ? session.endTime.getTime() - session.startTime.getTime()
        : undefined;

      if (session.status === "failed") {
        throw new Error(session.error ?? "Cowork execution failed");
      }

      log.info("Cowork job completed", {
        jobId: job.id,
        runId: run.id,
        exitCode: session.exitCode,
        duration: run.durationMs,
      });

    } catch (error) {
      log.error("Cowork job failed", {
        jobId: job.id,
        runId: run.id,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    } finally {
      session.endTime = new Date();
      this.activeSessions.delete(sessionKey);
    }
  }

  /**
   * Execute in local mode (direct shell execution)
   */
  private async executeLocal(
    config: {
      commands: string[];
      env?: Record<string, string>;
      timeoutMinutes?: number;
    },
    session: CoworkSession,
    signal: AbortSignal
  ): Promise<void> {
    session.status = "running";
    const command = config.commands.join("; ");
    
    log.info("Executing local command", { command: command.slice(0, 100) });

    const proc = Bun.spawn({
      cmd: ["bash", "-c", command],
      cwd: this.config.defaultCwd,
      env: { ...process.env, ...config.env },
      signal,
    });

    // Collect output
    const stdout = await new Response(proc.stdout).text();
    const stderr = await new Response(proc.stderr).text();
    
    session.output = stdout;
    if (stderr) {
      session.output += `\n[STDERR]\n${stderr}`;
    }

    const exitCode = await proc.exited;
    session.exitCode = exitCode;
    session.status = exitCode === 0 ? "completed" : "failed";
    
    if (exitCode !== 0) {
      session.error = `Command failed with exit code ${exitCode}`;
    }
  }

  /**
   * Execute in Docker container
   */
  private async executeDocker(
    config: {
      image?: string;
      commands: string[];
      env?: Record<string, string>;
      resources?: { cpus?: number; memory?: string; disk?: string };
      timeoutMinutes?: number;
    },
    session: CoworkSession,
    signal: AbortSignal
  ): Promise<void> {
    session.status = "running";
    
    const image = config.image ?? "ubuntu:22.04";
    const command = config.commands.join(" && ");
    
    log.info("Executing Docker container", { image, command: command.slice(0, 100) });

    // Build docker run arguments
    const args = ["run", "--rm"];
    
    // Resource limits
    if (config.resources?.cpus) {
      args.push("--cpus", String(config.resources.cpus));
    }
    if (config.resources?.memory) {
      args.push("--memory", config.resources.memory);
    }
    
    // Environment variables
    for (const [key, value] of Object.entries(config.env ?? {})) {
      args.push("-e", `${key}=${value}`);
    }
    
    // Working directory mount
    args.push("-v", `${this.config.defaultCwd}:/workspace`);
    args.push("-w", "/workspace");
    
    // Image and command
    args.push(image, "bash", "-c", command);

    const proc = Bun.spawn({
      cmd: ["docker", ...args],
      signal,
    });

    // Collect output
    const stdout = await new Response(proc.stdout).text();
    const stderr = await new Response(proc.stderr).text();
    
    session.output = stdout;
    if (stderr) {
      session.output += `\n[STDERR]\n${stderr}`;
    }

    const exitCode = await proc.exited;
    session.exitCode = exitCode;
    session.status = exitCode === 0 ? "completed" : "failed";
    
    if (exitCode !== 0) {
      session.error = `Docker container failed with exit code ${exitCode}`;
    }
  }

  /**
   * Execute in VM (Apple Virtualization or Firecracker via allternit-api).
   *
   * Priority:
   *   1. GIZZI_SANDBOX_RUNTIME_URL → POST /sandbox/execute on the allternit-api Rust service
   *      (this calls the real Firecracker/Apple VF drivers via ExecutionDriver trait)
   *   2. Configured runtimeEndpoint → generic HTTP runtime API
   *   3. Fallback: bubblewrap sandboxed local execution
   */
  private async executeVM(
    config: {
      image?: string;
      commands: string[];
      env?: Record<string, string>;
      resources?: { cpus?: number; memory?: string; disk?: string };
      timeoutMinutes?: number;
    },
    session: CoworkSession,
    signal: AbortSignal
  ): Promise<void> {
    session.status = "running";

    const driver = this.config.vmDriver ?? (process.platform === "darwin" ? "apple_vf" : "firecracker");
    log.info("Executing in VM", { driver, commands: config.commands.length });

    // ── 1. allternit-api sandbox endpoint (real VM drivers) ────────────────────────
    const sandboxRuntimeUrl = process.env.GIZZI_SANDBOX_RUNTIME_URL ?? this.config.runtimeEndpoint;
    if (sandboxRuntimeUrl) {
      await this.executeViaSandboxAPI(config, session, signal, sandboxRuntimeUrl);
      return;
    }

    // ── 2. Fallback: bubblewrap ───────────────────────────────────────────────
    log.warn("No VM runtime endpoint configured (set GIZZI_SANDBOX_RUNTIME_URL). Falling back to bubblewrap.");
    await this.executeSandboxed(config, session, signal);
  }

  /**
   * Execute via the allternit-api sandbox endpoint.
   *
   * Request shape matches SandboxExecuteRequest in cmd/allternit-api/src/sandbox_routes.rs:
   *   POST /sandbox/execute
   *   { code, language, workdir, env, timeout_secs, resources, network_enabled }
   *
   * Response shape matches SandboxExecuteResponse:
   *   { exit_code, stdout, stderr, duration_ms, session_id }
   */
  private async executeViaSandboxAPI(
    config: {
      image?: string;
      commands: string[];
      env?: Record<string, string>;
      resources?: { cpus?: number; memory?: string; disk?: string };
      timeoutMinutes?: number;
    },
    session: CoworkSession,
    signal: AbortSignal,
    baseUrl: string,
  ): Promise<void> {
    // Join commands into a single shell script so they run sequentially
    const code = config.commands.join("\n");
    const timeoutSecs = (config.timeoutMinutes ?? 30) * 60;

    // Parse memory string like "512m", "2g" into MB
    const parseMemoryMb = (mem?: string): number | undefined => {
      if (!mem) return undefined;
      const n = parseFloat(mem);
      if (mem.endsWith("g") || mem.endsWith("G")) return Math.round(n * 1024);
      if (mem.endsWith("m") || mem.endsWith("M")) return Math.round(n);
      return Math.round(n);
    };

    const body = {
      code,
      language: "shell",
      workdir: this.config.defaultCwd,
      env: config.env ?? {},
      timeout_secs: timeoutSecs,
      network_enabled: true,
      ...(config.resources && {
        resources: {
          cpu_cores: config.resources.cpus,
          memory_mb: parseMemoryMb(config.resources.memory),
        },
      }),
    };

    const url = baseUrl.endsWith("/") ? `${baseUrl}sandbox/execute` : `${baseUrl}/sandbox/execute`;
    log.info("calling allternit-api sandbox", { url, timeoutSecs });

    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal,
    });

    if (!response.ok) {
      const text = await response.text().catch(() => response.statusText);
      throw new Error(`allternit-api sandbox returned ${response.status}: ${text}`);
    }

    const result = await response.json() as {
      exit_code: number;
      stdout: string;
      stderr: string;
      duration_ms: number;
      session_id?: string;
    };

    session.output = result.stdout;
    if (result.stderr) {
      session.output += `\n[STDERR]\n${result.stderr}`;
    }
    session.exitCode = result.exit_code;
    session.status = result.exit_code === 0 ? "completed" : "failed";

    if (result.exit_code !== 0) {
      session.error = `VM execution failed with exit code ${result.exit_code}`;
    }

    log.info("allternit-api sandbox complete", {
      exitCode: result.exit_code,
      durationMs: result.duration_ms,
      vmSessionId: result.session_id,
    });
  }

  /**
   * Execute with bubblewrap sandbox (fallback)
   */
  private async executeSandboxed(
    config: {
      commands: string[];
      env?: Record<string, string>;
      timeoutMinutes?: number;
    },
    session: CoworkSession,
    signal: AbortSignal
  ): Promise<void> {
    log.info("Executing with bubblewrap sandbox");

    const command = config.commands.join("; ");
    
    // Check if bubblewrap is available
    const bwrapCheck = await Bun.spawn({
      cmd: ["which", "bwrap"],
    }).exited;
    
    if (bwrapCheck !== 0) {
      log.warn("Bubblewrap not available, falling back to local execution");
      return this.executeLocal(config, session, signal);
    }

    const proc = Bun.spawn({
      cmd: [
        "bwrap",
        "--ro-bind", "/usr", "/usr",
        "--ro-bind", "/bin", "/bin",
        "--ro-bind", "/lib", "/lib",
        "--ro-bind", "/lib64", "/lib64",
        "--dir", "/tmp",
        "--proc", "/proc",
        "--dev", "/dev",
        "--bind", this.config.defaultCwd, "/workspace",
        "--chdir", "/workspace",
        "--unshare-all",
        "--die-with-parent",
        "bash", "-c", command,
      ],
      env: { ...process.env, ...config.env },
      signal,
    });

    const stdout = await new Response(proc.stdout).text();
    const stderr = await new Response(proc.stderr).text();
    
    session.output = stdout;
    if (stderr) {
      session.output += `\n[STDERR]\n${stderr}`;
    }

    const exitCode = await proc.exited;
    session.exitCode = exitCode;
    session.status = exitCode === 0 ? "completed" : "failed";
    
    if (exitCode !== 0) {
      session.error = `Sandboxed execution failed with exit code ${exitCode}`;
    }
  }

  /**
   * Cancel a running job
   */
  async cancel(jobId: string, runId: string): Promise<void> {
    const sessionKey = `${jobId}-${runId}`;
    const session = this.activeSessions.get(sessionKey);
    
    if (session) {
      session.status = "failed";
      session.error = "Cancelled by user";
      this.activeSessions.delete(sessionKey);
    }
  }

  /**
   * Check if executor is healthy
   */
  async healthCheck(): Promise<boolean> {
    // Check Docker if that's the primary runtime
    try {
      const proc = Bun.spawn(["docker", "version"], { stdout: "ignore", stderr: "ignore" });
      await proc.exited;
      return true;
    } catch {
      // Docker not available, check if we can at least run local commands
      try {
        const proc = Bun.spawn(["bash", "--version"], { stdout: "ignore", stderr: "ignore" });
        await proc.exited;
        return true;
      } catch {
        return false;
      }
    }
  }
}
