// Best-effort "what ports has this pty's own process tree opened" detector,
// backing the iOS Code tab's dev-server preview. Computed on demand (per
// `GET /:ptyID/ports` request) rather than via a background interval — the
// client already polls at its own cadence while the ports sheet is open, so
// there's no idle cost to avoid separately.
//
// Scoping is by PID descendant tree from the pty's own shell pid, NOT by
// matching the dev server's cwd against the pty's cwd — an earlier version
// tried cwd-matching and a live test against a running gizzi-code instance
// disproved it immediately: the server's own spawned helpers (its mesh
// node, its tunnel process) inherit the SAME cwd the server itself was
// launched from, which in the normal case IS the project directory — so
// cwd-matching flagged the server's own unrelated subprocesses as if they
// belonged to an arbitrary pty session in that same project. Descendant-pid
// walking doesn't have that false-positive: those helpers are children of
// the server process, never of a pty's shell.
//
// macOS + Linux only for v1 (both have `lsof`/`ps -eo pid=,ppid=`); `wsl` is
// Linux-kernel so it works too. Windows has neither wired up — `detect()`
// short-circuits to `[]` there. A Windows implementation (netstat /
// Get-NetTCPConnection + a WMI/PowerShell process-tree walk) is a clean
// drop-in behind the two platform-specific helpers below when that
// distribution ships; nothing else in this module assumes macOS/Linux.
import { BusEvent } from "@/shared/bus/bus-event"
import { Bus } from "@/shared/bus"
import z from "zod/v4"
import { Log } from "@/shared/util/log"
import { getPlatform } from "@/shared/utils/platform"

export namespace PtyPortWatch {
  const log = Log.create({ service: "pty-port-watch" })

  export const PortInfo = z.object({
    port: z.number(),
    command: z.string().nullable(),
  })
  export type PortInfo = z.infer<typeof PortInfo>

  export const Event = {
    PortOpened: BusEvent.define("pty.port.opened", z.object({ ptyID: z.string(), port: z.number(), command: z.string().nullable() })),
    PortClosed: BusEvent.define("pty.port.closed", z.object({ ptyID: z.string(), port: z.number() })),
  }

  // Last known snapshot per pty, so a repeat `detect()` call (the client's
  // own poll) can diff and publish open/close events without a separate
  // background loop.
  const lastSnapshot = new Map<string, PortInfo[]>()

  /// Detects ports currently held open by descendants of `rootPid` (the
  /// pty's own shell process, `Info.pid`) — a dev server started inside the
  /// pty's shell (directly, or via a detached background job) is always a
  /// descendant of that shell, regardless of what directory it ends up in.
  export async function detect(ptyID: string, rootPid: number): Promise<PortInfo[]> {
    if (getPlatform() === "windows") return []

    let candidates: { pid: number; port: number; command: string | null }[] = []
    try {
      candidates = await listListeningPorts()
    } catch (err) {
      log.warn("lsof unavailable or failed; reporting no open ports", { error: String(err) })
      return []
    }
    if (candidates.length === 0) return []

    let descendants: Set<number>
    try {
      descendants = await descendantPids(rootPid)
    } catch (err) {
      log.warn("ps unavailable or failed; reporting no open ports", { error: String(err) })
      return []
    }

    const scoped = candidates
      .filter((c) => descendants.has(c.pid))
      .map(({ port, command }) => ({ port, command }))
    scoped.sort((a, b) => a.port - b.port)

    diffAndPublish(ptyID, scoped)
    return scoped
  }

  export function forget(ptyID: string) {
    lastSnapshot.delete(ptyID)
  }

  function diffAndPublish(ptyID: string, current: PortInfo[]) {
    const previous = lastSnapshot.get(ptyID) ?? []
    lastSnapshot.set(ptyID, current)

    const previousPorts = new Set(previous.map((p) => p.port))
    const currentPorts = new Set(current.map((p) => p.port))

    for (const port of current) {
      if (!previousPorts.has(port.port)) {
        Bus.publish(Event.PortOpened, { ptyID, port: port.port, command: port.command })
      }
    }
    for (const port of previousPorts) {
      if (!currentPorts.has(port)) {
        Bus.publish(Event.PortClosed, { ptyID, port })
      }
    }
  }

  /// BFS over `ps -eo pid=,ppid=` (portable across macOS/Linux, no headers)
  /// from `rootPid`, returning every descendant pid including the root
  /// itself. One full-process scan, not one `ps` call per candidate.
  async function descendantPids(rootPid: number): Promise<Set<number>> {
    const proc = Bun.spawn(["ps", "-eo", "pid=,ppid="], {
      stdin: "ignore",
      stdout: "pipe",
      stderr: "pipe",
    })
    const [exitCode, stdout] = await Promise.all([proc.exited, new Response(proc.stdout).text()])
    if (exitCode !== 0) throw new Error("ps exited non-zero")

    const childrenOf = new Map<number, number[]>()
    for (const line of stdout.split("\n")) {
      const trimmed = line.trim()
      if (!trimmed) continue
      const [pidStr, ppidStr] = trimmed.split(/\s+/)
      const pid = Number(pidStr)
      const ppid = Number(ppidStr)
      if (!Number.isFinite(pid) || !Number.isFinite(ppid)) continue
      const siblings = childrenOf.get(ppid)
      if (siblings) siblings.push(pid)
      else childrenOf.set(ppid, [pid])
    }

    const result = new Set<number>([rootPid])
    const queue = [rootPid]
    while (queue.length > 0) {
      const current = queue.shift()!
      for (const child of childrenOf.get(current) ?? []) {
        if (!result.has(child)) {
          result.add(child)
          queue.push(child)
        }
      }
    }
    return result
  }

  /// `lsof -iTCP -sTCP:LISTEN -P -n -F pcn` — field-prefixed output, one
  /// block per open file: a `p<pid>` line starts a block, `c<command>` and
  /// `n<name>` lines apply to the most recent `p` line until the next one.
  async function listListeningPorts(): Promise<{ pid: number; port: number; command: string | null }[]> {
    const proc = Bun.spawn(["lsof", "-iTCP", "-sTCP:LISTEN", "-P", "-n", "-F", "pcn"], {
      stdin: "ignore",
      stdout: "pipe",
      stderr: "pipe",
    })
    const [exitCode, stdout] = await Promise.all([proc.exited, new Response(proc.stdout).text()])
    // lsof exits 1 when it finds nothing to report — that's not a failure
    // here, just "no listening TCP sockets right now".
    if (exitCode !== 0 && stdout.trim().length === 0) return []

    const results: { pid: number; port: number; command: string | null }[] = []
    let pid: number | undefined
    let command: string | null = null

    for (const line of stdout.split("\n")) {
      if (line.length === 0) continue
      const field = line[0]
      const value = line.slice(1)
      if (field === "p") {
        pid = Number(value)
        command = null
      } else if (field === "c") {
        command = value
      } else if (field === "n" && pid !== undefined) {
        const port = extractPort(value)
        if (port !== undefined) results.push({ pid, port, command })
      }
    }
    return results
  }

  /// NAME field looks like `*:3000`, `127.0.0.1:3000`, or `[::1]:3000`,
  /// occasionally with a trailing `(LISTEN)` on older lsof versions.
  function extractPort(name: string): number | undefined {
    const cleaned = name.replace(/\s*\([^)]*\)\s*$/, "")
    const match = cleaned.match(/:(\d+)$/)
    if (!match || !match[1]) return undefined
    const port = Number(match[1])
    return Number.isFinite(port) ? port : undefined
  }
}
