/**
 * Cowork Job Executor
 * 
 * Production implementation for executing jobs in cowork runtime environments.
 * Supports local, Docker, and VM execution modes.
 */

import { Log } from "@/shared/util/log";
import type { CronJob, CronRun } from "../types";

const log = Log.create({ service: "cron-cowork-executor" });

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
   * Execute in VM (Apple Virtualization or Firecracker)
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
    
    // Determine which VM driver to use
    const driver = this.config.vmDriver ?? (process.platform === "darwin" ? "apple_vf" : "firecracker");
    
    log.info("Executing in VM", { driver, commands: config.commands.length });

    // For now, we use the cowork runtime via HTTP API if available
    if (this.config.runtimeEndpoint) {
      await this.executeViaRuntimeAPI(config, session, signal);
    } else {
      // Fallback: Use local execution with bubblewrap for sandboxing
      await this.executeSandboxed(config, session, signal);
    }
  }

  /**
   * Execute via Cowork Runtime HTTP API
   */
  private async executeViaRuntimeAPI(
    config: {
      commands: string[];
      env?: Record<string, string>;
      timeoutMinutes?: number;
    },
    session: CoworkSession,
    signal: AbortSignal
  ): Promise<void> {
    if (!this.config.runtimeEndpoint) {
      throw new Error("Runtime endpoint not configured");
    }

    const response = await fetch(`${this.config.runtimeEndpoint}/execute`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        commands: config.commands,
        env: config.env,
        timeout: (config.timeoutMinutes ?? 30) * 60,
      }),
      signal,
    });

    if (!response.ok) {
      throw new Error(`Runtime API returned ${response.status}: ${await response.text()}`);
    }

    const result = await response.json() as {
      exitCode: number;
      stdout: string;
      stderr: string;
    };

    session.output = result.stdout;
    if (result.stderr) {
      session.output += `\n[STDERR]\n${result.stderr}`;
    }
    session.exitCode = result.exitCode;
    session.status = result.exitCode === 0 ? "completed" : "failed";
    
    if (result.exitCode !== 0) {
      session.error = `VM execution failed with exit code ${result.exitCode}`;
    }
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
      const proc = Bun.spawn({ cmd: ["docker", "version"], stdout: "null", stderr: "null" });
      await proc.exited;
      return true;
    } catch {
      // Docker not available, check if we can at least run local commands
      try {
        const proc = Bun.spawn({ cmd: ["bash", "--version"], stdout: "null", stderr: "null" });
        await proc.exited;
        return true;
      } catch {
        return false;
      }
    }
  }
}
