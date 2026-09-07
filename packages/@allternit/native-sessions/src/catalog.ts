import { existsSync, readdirSync, readFileSync, statSync } from "node:fs"
import { homedir } from "node:os"
import { basename, join } from "node:path"
import { fingerprintPath, fingerprintPaths } from "./fingerprint.js"
import { HARNESSES, encodeClaudeCwd, harnessHome } from "./harness.js"
import { asString, parseJsonlText } from "./jsonl.js"
import type { CatalogOptions, HarnessId, NativeSession, ReaderKind } from "./types.js"

function mtimeMs(path: string): number {
  try {
    return Math.trunc(statSync(path).mtimeMs)
  } catch {
    return 0
  }
}

function listFiles(dir: string, predicate: (name: string) => boolean): string[] {
  if (!existsSync(dir)) return []
  try {
    return readdirSync(dir, { withFileTypes: true })
      .filter((e) => e.isFile() && predicate(e.name))
      .map((e) => join(dir, e.name))
  } catch {
    return []
  }
}

function walkDirs(dir: string, maxDepth: number): string[] {
  if (maxDepth < 0 || !existsSync(dir)) return []
  const out: string[] = [dir]
  try {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      if (!e.isDirectory()) continue
      if (e.name.startsWith(".")) continue
      out.push(...walkDirs(join(dir, e.name), maxDepth - 1))
    }
  } catch {
    /* ignore */
  }
  return out
}

function session(partial: Omit<NativeSession, "installed"> & { installed?: boolean }): NativeSession {
  return { installed: true, ...partial }
}

function listClaudeLike(harness: HarnessId, root: string, subdir: string, reader: ReaderKind, nestedChats = false): NativeSession[] {
  const projects = join(root, subdir)
  if (!existsSync(projects)) return []
  const out: NativeSession[] = []
  for (const project of readdirSync(projects, { withFileTypes: true })) {
    if (!project.isDirectory()) continue
    const dir = nestedChats ? join(projects, project.name, "chats") : join(projects, project.name)
    if (!existsSync(dir)) continue
    for (const file of listFiles(dir, (n) => n.endsWith(".jsonl") && !n.includes(".runtime."))) {
      const id = basename(file, ".jsonl")
      out.push(
        session({
          harness,
          sessionId: id,
          path: file,
          cwd: project.name.startsWith("-") ? undefined : project.name,
          updatedAt: mtimeMs(file),
          fingerprint: fingerprintPath(file),
          lastEventId: id,
          reader,
          projectable: true,
        }),
      )
    }
  }
  return out
}

function listCodex(root: string): NativeSession[] {
  const sessions = join(root, "sessions")
  if (!existsSync(sessions)) return []
  const out: NativeSession[] = []
  const re = /^rollout-.*-([0-9a-fA-F-]{36})\.jsonl(?:\.zst)?$/
  for (const dir of walkDirs(sessions, 4)) {
    for (const file of listFiles(dir, (n) => re.test(n))) {
      const match = re.exec(basename(file))
      if (!match) continue
      out.push(
        session({
          harness: "codex",
          sessionId: match[1]!,
          path: file,
          updatedAt: mtimeMs(file),
          fingerprint: fingerprintPath(file),
          lastEventId: match[1],
          reader: "jsonl",
          projectable: true,
        }),
      )
    }
  }
  const archived = join(root, "archived_sessions")
  if (existsSync(archived)) {
    for (const dir of walkDirs(archived, 4)) {
      for (const file of listFiles(dir, (n) => re.test(n))) {
        const match = re.exec(basename(file))
        if (!match) continue
        out.push(
          session({
            harness: "codex",
            sessionId: match[1]!,
            path: file,
            title: "(archived)",
            updatedAt: mtimeMs(file),
            fingerprint: fingerprintPath(file),
            reader: "jsonl",
            projectable: true,
          }),
        )
      }
    }
  }
  return out
}

function listGrok(root: string): NativeSession[] {
  const sessions = join(root, "sessions")
  if (!existsSync(sessions)) return []
  const out: NativeSession[] = []
  for (const cwdDir of readdirSync(sessions, { withFileTypes: true })) {
    if (!cwdDir.isDirectory()) continue
    const cwdPath = join(sessions, cwdDir.name)
    for (const ses of readdirSync(cwdPath, { withFileTypes: true })) {
      if (!ses.isDirectory()) continue
      const dir = join(cwdPath, ses.name)
      const updates = join(dir, "updates.jsonl")
      const summary = join(dir, "summary.json")
      if (!existsSync(updates)) continue
      let title: string | undefined
      let cwd: string | undefined
      if (existsSync(summary)) {
        try {
          const parsed = JSON.parse(readFileSync(summary, "utf8")) as { info?: { id?: string; cwd?: string }; session_summary?: string }
          cwd = parsed.info?.cwd
          title = typeof parsed.session_summary === "string" ? parsed.session_summary.slice(0, 120) : undefined
        } catch {
          /* ignore */
        }
      }
      out.push(
        session({
          harness: "grok",
          sessionId: ses.name,
          path: dir,
          cwd: cwd ?? decodeURIComponent(cwdDir.name),
          title,
          updatedAt: mtimeMs(updates),
          fingerprint: fingerprintPaths([summary, updates].filter(existsSync)),
          lastEventId: ses.name,
          reader: "directory",
          projectable: true,
        }),
      )
    }
  }
  return out
}

function listKimiCode(root: string): NativeSession[] {
  const sessions = join(root, "sessions")
  if (!existsSync(sessions)) return []
  const out: NativeSession[] = []
  for (const wd of readdirSync(sessions, { withFileTypes: true })) {
    if (!wd.isDirectory() || !wd.name.startsWith("wd_")) continue
    const wdPath = join(sessions, wd.name)
    for (const ses of readdirSync(wdPath, { withFileTypes: true })) {
      if (!ses.isDirectory() || !ses.name.startsWith("session_")) continue
      const dir = join(wdPath, ses.name)
      const statePath = join(dir, "state.json")
      const wire = join(dir, "agents", "main", "wire.jsonl")
      let cwd: string | undefined
      let updatedAt = mtimeMs(dir)
      let id = ses.name.replace(/^session_/, "")
      if (existsSync(statePath)) {
        try {
          const state = JSON.parse(readFileSync(statePath, "utf8")) as { id?: string; cwd?: string; updatedAt?: number }
          cwd = state.cwd
          if (typeof state.id === "string") id = state.id.startsWith("session_") ? state.id.slice("session_".length) : state.id
          if (typeof state.updatedAt === "number") updatedAt = state.updatedAt
        } catch {
          /* ignore */
        }
      }
      out.push(
        session({
          harness: "kimi",
          sessionId: id,
          path: dir,
          cwd,
          updatedAt,
          fingerprint: fingerprintPaths([statePath, wire].filter(existsSync)),
          lastEventId: id,
          reader: "directory",
          projectable: true,
        }),
      )
    }
  }
  return out
}

function listKimiCli(root: string): NativeSession[] {
  const sessions = join(root, "sessions")
  if (!existsSync(sessions)) return []
  const out: NativeSession[] = []
  for (const hash of readdirSync(sessions, { withFileTypes: true })) {
    if (!hash.isDirectory()) continue
    const hashDir = join(sessions, hash.name)
    for (const ses of readdirSync(hashDir, { withFileTypes: true })) {
      if (!ses.isDirectory()) continue
      const ctx = join(hashDir, ses.name, "context.jsonl")
      if (!existsSync(ctx)) continue
      out.push(
        session({
          harness: "kimi-cli",
          sessionId: ses.name,
          path: ctx,
          updatedAt: mtimeMs(ctx),
          fingerprint: fingerprintPath(ctx),
          reader: "jsonl",
          projectable: true,
        }),
      )
    }
  }
  return out
}

function listCopilot(root: string): NativeSession[] {
  const dir = join(root, "session-state")
  if (!existsSync(dir)) return []
  const out: NativeSession[] = []
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const events = e.isDirectory() ? join(dir, e.name, "events.jsonl") : e.name.endsWith(".jsonl") ? join(dir, e.name) : ""
    if (!events || !existsSync(events)) continue
    const id = e.isDirectory() ? e.name : basename(e.name, ".jsonl")
    out.push(
      session({
        harness: "copilot",
        sessionId: id,
        path: events,
        updatedAt: mtimeMs(events),
        fingerprint: fingerprintPath(events),
        reader: "jsonl",
        projectable: true,
      }),
    )
  }
  return out
}

function listPiLike(harness: "pi" | "omp", root: string): NativeSession[] {
  const sessions = join(root, "sessions")
  if (!existsSync(sessions)) return []
  const out: NativeSession[] = []
  for (const dir of walkDirs(sessions, 5)) {
    for (const file of listFiles(dir, (n) => n.endsWith(".jsonl"))) {
      const id = basename(file, ".jsonl").replace(/^.*_/, "")
      out.push(
        session({
          harness,
          sessionId: id,
          path: file,
          updatedAt: mtimeMs(file),
          fingerprint: fingerprintPath(file),
          reader: "jsonl",
          projectable: true,
        }),
      )
    }
  }
  return out
}

function listCursor(root: string): NativeSession[] {
  const projects = join(root, "projects")
  if (!existsSync(projects)) return []
  const out: NativeSession[] = []
  for (const project of readdirSync(projects, { withFileTypes: true })) {
    if (!project.isDirectory()) continue
    const transcripts = join(projects, project.name, "agent-transcripts")
    if (!existsSync(transcripts)) continue
    for (const ses of readdirSync(transcripts, { withFileTypes: true })) {
      const file = ses.isDirectory() ? join(transcripts, ses.name, `${ses.name}.jsonl`) : join(transcripts, ses.name)
      if (!file.endsWith(".jsonl") || !existsSync(file)) continue
      const id = ses.isDirectory() ? ses.name : basename(ses.name, ".jsonl")
      out.push(
        session({
          harness: "cursor",
          sessionId: id,
          path: file,
          updatedAt: mtimeMs(file),
          fingerprint: fingerprintPath(file),
          reader: "jsonl",
          projectable: true,
        }),
      )
    }
  }
  return out
}

function listOpenHands(root: string): NativeSession[] {
  if (!existsSync(root)) return []
  const out: NativeSession[] = []
  for (const ses of readdirSync(root, { withFileTypes: true })) {
    if (!ses.isDirectory()) continue
    const dir = join(root, ses.name)
    out.push(
      session({
        harness: "openhands",
        sessionId: ses.name,
        path: dir,
        updatedAt: mtimeMs(dir),
        fingerprint: fingerprintPath(dir),
        reader: "directory",
        projectable: true,
      }),
    )
  }
  return out
}

function listMuse(root: string): NativeSession[] {
  const sessions = join(root, "sessions")
  if (!existsSync(sessions)) return []
  const out: NativeSession[] = []
  for (const dir of walkDirs(sessions, 4)) {
    const file = join(dir, "session.jsonl")
    if (!existsSync(file)) continue
    out.push(
      session({
        harness: "muse",
        sessionId: basename(dir),
        path: file,
        updatedAt: mtimeMs(file),
        fingerprint: fingerprintPath(file),
        reader: "jsonl",
        projectable: true,
      }),
    )
  }
  return out
}

function listVibe(root: string): NativeSession[] {
  const dir = join(root, "logs", "session")
  if (!existsSync(dir)) return []
  const out: NativeSession[] = []
  for (const ses of readdirSync(dir, { withFileTypes: true })) {
    if (!ses.isDirectory()) continue
    const messages = join(dir, ses.name, "messages.jsonl")
    if (!existsSync(messages)) continue
    const id = ses.name.replace(/^session_/, "").replace(/^.*_/, "")
    out.push(
      session({
        harness: "vibe",
        sessionId: id,
        path: join(dir, ses.name),
        updatedAt: mtimeMs(messages),
        fingerprint: fingerprintPath(join(dir, ses.name)),
        reader: "directory",
        projectable: true,
      }),
    )
  }
  return out
}

function listSqliteInventory(harness: HarnessId, dbPath: string, projectable: boolean): NativeSession[] {
  if (!existsSync(dbPath)) return []
  try {
    const { Database } = require("bun:sqlite") as {
      Database: new (path: string, opts?: { readonly?: boolean }) => {
        query: (s: string) => { all: () => Record<string, unknown>[] }
      }
    }
    const db = new Database(dbPath, { readonly: true })
    const tables = db.query(`SELECT name FROM sqlite_master WHERE type='table'`).all().map((r) => String(r.name))
    const table = tables.includes("sessions") ? "sessions" : tables.includes("session") ? "session" : tables.includes("thread") ? "thread" : null
    if (!table) throw new Error("no session table")
    const cols = db.query(`PRAGMA table_info(${table})`).all().map((r) => String(r.name))
    const idCol = ["session_id", "id", "thread_id"].find((c) => cols.includes(c)) ?? "id"
    const titleCol = cols.includes("title") ? "title" : cols.includes("name") ? "name" : idCol
    const cwdCol = cols.includes("cwd") ? "cwd" : cols.includes("directory") ? "directory" : null
    const updatedCol = ["updated_ns", "time_updated", "updated_at", "updated"].find((c) => cols.includes(c))
    const sql = `SELECT ${idCol} AS id, ${titleCol} AS title ${cwdCol ? `, ${cwdCol} AS cwd` : ""} ${updatedCol ? `, ${updatedCol} AS updated` : ""} FROM ${table}`
    const rows = db.query(sql).all()
    return rows.map((row) =>
      session({
        harness,
        sessionId: String(row.id),
        path: `${dbPath}#${row.id}`,
        cwd: asString(row.cwd),
        title: asString(row.title),
        updatedAt: Number(row.updated ?? mtimeMs(dbPath)),
        fingerprint: fingerprintPath(dbPath) + ":" + String(row.id),
        reader: "sqlite",
        projectable,
      }),
    )
  } catch {
    return [
      session({
        harness,
        sessionId: "*",
        path: dbPath,
        title: "SQLite store (open to enumerate identities)",
        updatedAt: mtimeMs(dbPath),
        fingerprint: fingerprintPath(dbPath),
        reader: "sqlite",
        projectable,
      }),
    ]
  }
}

function listOpenCode(root: string): NativeSession[] {
  const dbPath = join(root, "opencode.db")
  const macPath = join(homedir(), "Library", "Application Support", "opencode", "opencode.db")
  const path = existsSync(dbPath) ? dbPath : existsSync(macPath) ? macPath : dbPath
  if (!existsSync(path)) return []
  try {
    // Dynamic so the package still loads outside bun.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { Database } = require("bun:sqlite") as { Database: new (path: string, opts?: { readonly?: boolean }) => { query: (s: string) => { all: () => Record<string, unknown>[] } } }
    const db = new Database(path, { readonly: true })
    const rows = db.query(`SELECT id, directory, title, time_updated, time_created, time_archived FROM session`).all()
    return rows
      .filter((row) => row.time_archived == null)
      .map((row) =>
        session({
          harness: "opencode",
          sessionId: String(row.id),
          path: `${path}#${row.id}`,
          cwd: asString(row.directory),
          title: asString(row.title),
          updatedAt: Number(row.time_updated ?? row.time_created ?? 0),
          createdAt: Number(row.time_created ?? 0) || undefined,
          fingerprint: fingerprintPath(path) + ":" + String(row.id) + ":" + String(row.time_updated ?? 0),
          reader: "sqlite",
          projectable: true,
        }),
      )
  } catch {
    return listSqliteInventory("opencode", path, true)
  }
}

function listGemini(root: string): NativeSession[] {
  const tmp = join(root, "tmp")
  if (!existsSync(tmp)) return []
  const out: NativeSession[] = []
  for (const dir of walkDirs(tmp, 3)) {
    const chats = join(dir, "chats")
    if (!existsSync(chats)) continue
    for (const file of listFiles(chats, (n) => n.endsWith(".json") || n.endsWith(".jsonl"))) {
      out.push(
        session({
          harness: "gemini",
          sessionId: basename(file).replace(/\.(json|jsonl)$/, ""),
          path: file,
          updatedAt: mtimeMs(file),
          fingerprint: fingerprintPath(file),
          reader: "jsonl",
          projectable: true,
        }),
      )
    }
  }
  return out
}

function listFactory(root: string): NativeSession[] {
  const sessions = join(root, "sessions")
  if (!existsSync(sessions)) return []
  return listFiles(sessions, (n) => n.endsWith(".jsonl") || n.endsWith(".json")).map((file) =>
    session({
      harness: "droid",
      sessionId: basename(file).replace(/\.(json|jsonl)$/, ""),
      path: file,
      updatedAt: mtimeMs(file),
      fingerprint: fingerprintPath(file),
      reader: "jsonl",
      projectable: true,
    }),
  )
}

function listAntigravity(root: string): NativeSession[] {
  const dir = join(root, "conversations")
  if (!existsSync(dir)) return []
  return listFiles(dir, (n) => n.endsWith(".db")).map((file) =>
    session({
      harness: "antigravity",
      sessionId: basename(file, ".db"),
      path: file,
      updatedAt: mtimeMs(file),
      fingerprint: fingerprintPath(file),
      reader: "sqlite",
      projectable: false,
    }),
  )
}

export function listHarnesses() {
  return HARNESSES.map((h) => ({
    id: h.id,
    label: h.label,
    reader: h.reader,
    projectable: h.projectable,
    resumeHint: h.resumeHint,
    home: harnessHome(h.id),
    present: existsSync(harnessHome(h.id)),
  }))
}

export function listNativeSessions(opts: CatalogOptions = {}): NativeSession[] {
  const home = opts.home ?? homedir()
  const wanted = opts.harnesses ?? HARNESSES.map((h) => h.id)
  const out: NativeSession[] = []
  for (const id of wanted) {
    const root = harnessHome(id, home)
    const present = existsSync(root)
    if (!present) continue
    switch (id) {
      case "claude":
        out.push(...listClaudeLike("claude", root, "projects", "jsonl"))
        break
      case "gizzi":
        out.push(...listClaudeLike("gizzi", root, "projects", "jsonl"))
        break
      case "qwen":
        out.push(...listClaudeLike("qwen", root, "projects", "jsonl", true))
        break
      case "codex":
        out.push(...listCodex(root))
        break
      case "grok":
        out.push(...listGrok(root))
        break
      case "kimi":
        out.push(...listKimiCode(root))
        break
      case "kimi-cli":
        out.push(...listKimiCli(root))
        break
      case "opencode":
        out.push(...listOpenCode(root))
        break
      case "copilot":
        out.push(...listCopilot(root))
        break
      case "pi":
        out.push(...listPiLike("pi", root))
        break
      case "omp":
        out.push(...listPiLike("omp", root))
        break
      case "cursor":
        out.push(...listCursor(root))
        break
      case "openhands":
        out.push(...listOpenHands(root))
        break
      case "muse":
        out.push(...listMuse(root))
        break
      case "vibe":
        out.push(...listVibe(root))
        break
      case "gemini":
        out.push(...listGemini(root))
        break
      case "droid":
        out.push(...listFactory(root))
        break
      case "antigravity":
        out.push(...listAntigravity(root))
        break
      case "hermes":
        out.push(...listSqliteInventory("hermes", join(root, "state.db"), false))
        break
      case "kilo":
        out.push(...listSqliteInventory("kilo", join(root, "kilo.db"), false))
        break
      case "crush":
        out.push(...listSqliteInventory("crush", join(root, "crush.db"), false))
        break
      case "mastracode":
        out.push(...listSqliteInventory("mastracode", join(root, "mastra.db"), false))
        break
      case "devin":
        out.push(...listSqliteInventory("devin", join(root, "sessions.db"), false))
        break
      default:
        break
    }
  }
  if (opts.cwd) {
    const encoded = encodeClaudeCwd(opts.cwd)
    const grokEnc = encodeURIComponent(opts.cwd)
    return out.filter((s) => {
      if (s.cwd && (s.cwd === opts.cwd || s.cwd.includes(opts.cwd!))) return true
      if (s.path.includes(encoded) || s.path.includes(grokEnc)) return true
      return false
    })
  }
  out.sort((a, b) => b.updatedAt - a.updatedAt)
  return out
}

export function getNativeSession(harness: HarnessId, sessionId: string, opts: CatalogOptions = {}): NativeSession | undefined {
  const matches = listNativeSessions({ ...opts, harnesses: [harness] }).filter((s) => s.sessionId === sessionId || s.sessionId.endsWith(sessionId) || s.path.includes(sessionId))
  if (matches.length === 1) return matches[0]
  if (matches.length === 0) return undefined
  if (opts.cwd) {
    const scoped = matches.filter((s) => s.cwd === opts.cwd || s.path.includes(encodeClaudeCwd(opts.cwd!)))
    if (scoped.length === 1) return scoped[0]
  }
  throw Object.assign(new Error(`ambiguous native session ${harness}:${sessionId}`), { matches })
}

/** Peek first JSONL object for catalog enrichment; never throws. */
export function peekJsonlMeta(path: string): Record<string, unknown> | undefined {
  try {
    const text = readFileSync(path, "utf8")
    const first = text.split(/\r?\n/).find((l) => l.trim())
    if (!first) return undefined
    const { records } = parseJsonlText(first, 1)
    return records[0]
  } catch {
    return undefined
  }
}

export { HARNESS_BY_ID }
