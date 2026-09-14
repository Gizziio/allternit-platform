import fs from "fs/promises"
import path from "path"
import { strToU8, zipSync } from "fflate"
import { Session } from "@/runtime/session"

// The ambient declaration in src/types/global.d.ts only declares gzip/gunzip
// and shadows fflate's bundled types; augment it with the members used here
// (signatures match fflate 0.8.x).
declare module "fflate" {
  export function strToU8(str: string, latin1?: boolean): Uint8Array
  export function zipSync(data: Record<string, Uint8Array>, options?: { level?: number }): Uint8Array
}
import { SessionTrace } from "@/runtime/session/trace"
import { BackgroundTask } from "@/runtime/session/background-task"
import { Global } from "@/runtime/context/global"
import { Scratchpad } from "@/runtime/session/scratchpad"

const SECRET_KEY = /(?:api[-_]?key|authorization|password|secret|token|cookie|credential|private[-_]?key)/i
const SECRET_VALUE = /\b(?:sk|key|token|Bearer)[-_][A-Za-z0-9._-]{12,}\b/g
const HOME = Global.Path.home

export namespace SessionSupportBundle {
  export async function create(sessionID: string): Promise<Uint8Array> {
    const info = await Session.get(sessionID)
    const messages = await Session.messages({ sessionID })
    const head = SessionTrace.head(sessionID)
    const traces = SessionTrace.list({ sessionID, after: 0, through: head, limit: 5_000 })
    const tasks = await BackgroundTask.list(sessionID)
    const scratchpad = await Scratchpad.list(sessionID).catch(() => undefined)
    const manifest = {
      version: 1,
      createdAt: new Date().toISOString(),
      sessionID,
      traceHead: head,
      traceEntriesIncluded: traces.length,
      traceTruncated: (traces.at(-1)?.sequence ?? 0) < head,
      runtime: { platform: process.platform, arch: process.arch, node: process.version },
      scratchpad: {
        contentIncluded: false,
        entries: scratchpad?.entries ?? [],
      },
      redaction: "Secret-shaped keys and values are removed; home paths are replaced with <HOME>.",
    }
    const logs = await recentLogs()
    const files: Record<string, Uint8Array> = {
      "manifest.json": json(manifest),
      "session.json": json(redact({ info, messages })),
      "trace.json": json(redact(traces)),
      "background-tasks.json": json(redact(tasks)),
      ...Object.fromEntries(logs.map((entry) => [`logs/${entry.name}`, strToU8(redactText(entry.content))])),
    }
    return zipSync(files, { level: 6 })
  }

  export function redact(input: unknown, key = ""): unknown {
    if (SECRET_KEY.test(key)) return "<REDACTED>"
    if (typeof input === "string") return redactText(input)
    if (Array.isArray(input)) return input.map((item) => redact(item))
    if (input && typeof input === "object") {
      return Object.fromEntries(Object.entries(input).map(([name, value]) => [name, redact(value, name)]))
    }
    return input
  }

  function redactText(value: string) {
    return value.replaceAll(HOME, "<HOME>")
      .replace(SECRET_VALUE, "<REDACTED>")
      .replace(/(Authorization\s*[:=]\s*)([^\s,;]+)/gi, "$1<REDACTED>")
      .replace(/((?:api[-_]?key|password|secret|token)\s*[:=]\s*["']?)([^\s,"'}]+)/gi, "$1<REDACTED>")
  }

  async function recentLogs() {
    const names = await fs.readdir(Global.Path.log).catch(() => [])
    const chosen = names.filter((name) => name.endsWith(".log")).toSorted().slice(-3)
    return Promise.all(chosen.map(async (name) => {
      const file = path.join(Global.Path.log, name)
      const content = await fs.readFile(file, "utf8").catch(() => "")
      return { name, content: content.slice(-200_000) }
    }))
  }

  function json(input: unknown) {
    return strToU8(JSON.stringify(input, null, 2))
  }
}
