import { $ } from "bun"
import { Flag } from "@/runtime/context/flag/flag"

export interface GitResult {
  exitCode: number
  text(): string | Promise<string>
  stdout: Buffer | ReadableStream<Uint8Array>
  stderr: Buffer | ReadableStream<Uint8Array>
}

export namespace Git {
  /**
   * Run a git command.
   */
  export async function exec(args: string[], opts: { cwd: string; env?: Record<string, string> }): Promise<GitResult> {
    if (Flag.GIZZI_CLIENT === "acp") {
      try {
        const proc = Bun.spawn(["git", ...args], {
          stdin: "ignore",
          stdout: "pipe",
          stderr: "pipe",
          cwd: opts.cwd,
          env: opts.env ? { ...process.env, ...opts.env } : process.env,
        })
        const [exitCode, stdout, stderr] = await Promise.all([
          proc.exited,
          new Response(proc.stdout).arrayBuffer(),
          new Response(proc.stderr).arrayBuffer(),
        ])
        const stdoutBuf = Buffer.from(stdout)
        const stderrBuf = Buffer.from(stderr)
        return {
          exitCode,
          text: () => stdoutBuf.toString(),
          stdout: stdoutBuf,
          stderr: stderrBuf,
        }
      } catch (error) {
        const stderr = Buffer.from(error instanceof Error ? error.message : String(error))
        return {
          exitCode: 1,
          text: () => "",
          stdout: Buffer.alloc(0),
          stderr,
        }
      }
    }

    const env = opts.env ? { ...process.env, ...opts.env } : undefined
    let cmd = $`git ${args}`.quiet().nothrow().cwd(opts.cwd)
    if (env) cmd = cmd.env(env)
    const result = await cmd
    return {
      exitCode: result.exitCode,
      text: () => result.text(),
      stdout: result.stdout,
      stderr: result.stderr,
    }
  }

  export async function status(cwd: string) {
    const result = await exec(["status", "--porcelain"], { cwd });
    const text = await result.text();
    const lines = text.split("\n").filter(Boolean);
    
    const modified: string[] = [];
    const untracked: string[] = [];
    const staged: string[] = [];

    for (const line of lines) {
      const status = line.slice(0, 2);
      const file = line.slice(3);
      if (status === "??") untracked.push(file);
      else if (status[0] !== " " && status[0] !== "?") staged.push(file);
      else modified.push(file);
    }

    return { modified, untracked, staged };
  }
}

// Keep the direct export for compatibility if needed
export const git = Git.exec;
