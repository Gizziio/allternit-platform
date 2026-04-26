/**
 * Desktop Connector
 *
 * Connects the CLI to the Allternit Desktop app via Unix socket.
 * Allows the CLI to execute commands in the VM managed by the Desktop app.
 *
 * Protocol: JSON messages over Unix domain socket
 */

import { createConnection, type Socket } from "net"
import { homedir } from "os"
import { join } from "path"
import { access } from "fs/promises"
import { Log } from "@/shared/util/log"

const log = Log.create({ service: "desktop-connector" })

const DEFAULT_SOCKET_PATH = join(homedir(), ".allternit", "desktop-vm.sock")

interface DesktopMessage {
  type: "ping" | "pong" | "execute" | "execute_result" | "status" | "status_result" | "error"
  request_id?: string
  version?: string
  command?: string
  args?: string[]
  working_dir?: string
  env?: Record<string, string>
  stdout?: string
  stderr?: string
  exit_code?: number
  state?: "running" | "stopped" | "error"
  error?: string
}

export class DesktopConnector {
  private socket: Socket | null = null
  private socketPath: string
  private pending = new Map<string, { resolve: (value: any) => void; reject: (reason: Error) => void }>()

  constructor(socketPath: string = DEFAULT_SOCKET_PATH) {
    this.socketPath = socketPath
  }

  async connect(): Promise<void> {
    // Check if socket exists
    try {
      await access(this.socketPath)
    } catch {
      throw new Error(`Desktop app socket not found at ${this.socketPath}. Is the desktop app running?`)
    }

    return new Promise((resolve, reject) => {
      const socket = createConnection(this.socketPath)
      socket.on("connect", () => {
        this.socket = socket
        resolve()
      })
      socket.on("error", reject)
      socket.on("data", (data) => this.handleData(data))
      socket.on("close", () => {
        this.socket = null
      })
    })
  }

  disconnect(): void {
    this.socket?.end()
    this.socket = null
  }

  async ping(): Promise<string> {
    const response = await this.request({ type: "ping" })
    return response.version ?? "unknown"
  }

  async execute(
    command: string,
    args: string[] = [],
    opts?: { workingDir?: string; env?: Record<string, string> },
  ): Promise<{ stdout: string; stderr: string; exitCode: number }> {
    const response = await this.request({
      type: "execute",
      command,
      args,
      working_dir: opts?.workingDir,
      env: opts?.env,
    })

    return {
      stdout: response.stdout ?? "",
      stderr: response.stderr ?? "",
      exitCode: response.exit_code ?? 0,
    }
  }

  async getStatus(): Promise<{ state: string; version?: string }> {
    const response = await this.request({ type: "status" })
    return {
      state: response.state ?? "unknown",
      version: response.version,
    }
  }

  private request(msg: DesktopMessage): Promise<any> {
    return new Promise((resolve, reject) => {
      const requestId = `${Date.now()}-${Math.random()}`
      msg.request_id = requestId

      this.pending.set(requestId, { resolve, reject })

      const timer = setTimeout(() => {
        this.pending.delete(requestId)
        reject(new Error("Desktop connector request timeout"))
      }, 30000)

      try {
        const data = Buffer.from(JSON.stringify(msg) + "\n")
        this.socket?.write(data)
      } catch (err) {
        clearTimeout(timer)
        this.pending.delete(requestId)
        reject(err)
      }
    })
  }

  private handleData(data: Buffer): void {
    const lines = data.toString("utf-8").trim().split("\n")
    for (const line of lines) {
      try {
        const msg = JSON.parse(line) as DesktopMessage
        if (msg.request_id && this.pending.has(msg.request_id)) {
          const { resolve, reject } = this.pending.get(msg.request_id)!
          this.pending.delete(msg.request_id)

          if (msg.type === "error") {
            reject(new Error(msg.error ?? "Desktop app error"))
          } else {
            resolve(msg)
          }
        }
      } catch {
        // Ignore malformed lines
      }
    }
  }
}

export function createDesktopConnector(socketPath?: string): DesktopConnector {
  return new DesktopConnector(socketPath)
}
