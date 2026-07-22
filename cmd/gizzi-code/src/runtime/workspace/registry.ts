import path from "node:path"
import fs from "node:fs/promises"
import { createHash, randomUUID } from "node:crypto"
import { Global } from "@/runtime/context/global"

export interface WorkspaceRecord {
  id: string
  path: string
  aliases: string[]
  name?: string
  deletedAt?: number
  updatedAt: number
}

const defaultFile = path.join(Global.Path.data, "workspaces.json")

async function canonical(input: string) {
  const absolute = path.resolve(input)
  const resolved = await fs.realpath(absolute).catch(() => absolute)
  const normalized = resolved.normalize("NFC").replaceAll("\\", "/").replace(/\/$/, "")
  return process.platform === "win32" ? normalized.toLowerCase() : normalized
}

function identity(value: string) {
  return createHash("sha256").update(value).digest("hex").slice(0, 24)
}

async function withLock<T>(file: string, operation: () => Promise<T>): Promise<T> {
  await fs.mkdir(path.dirname(file), { recursive: true })
  const lock = `${file}.lock`
  let handle: Awaited<ReturnType<typeof fs.open>> | undefined
  for (let attempt = 0; attempt < 40; attempt++) {
    handle = await fs.open(lock, "wx", 0o600).catch(() => undefined)
    if (handle) break
    if (attempt === 20) {
      const stale = await fs.stat(lock).then((stat) => Date.now() - stat.mtimeMs > 30_000).catch(() => false)
      if (stale) await fs.unlink(lock).catch(() => {})
    }
    await new Promise((resolve) => setTimeout(resolve, 25 + attempt * 2))
  }
  if (!handle) throw new Error("Workspace registry is busy")
  try {
    return await operation()
  } finally {
    await handle.close().catch(() => {})
    await fs.unlink(lock).catch(() => {})
  }
}

async function read(file: string): Promise<WorkspaceRecord[]> {
  const parsed = await fs.readFile(file, "utf8").then(JSON.parse).catch(() => [])
  return Array.isArray(parsed) ? parsed : []
}

async function write(file: string, records: WorkspaceRecord[]) {
  const temporary = `${file}.${process.pid}.${randomUUID()}.tmp`
  await fs.writeFile(temporary, JSON.stringify(records, null, 2), { mode: 0o600 })
  await fs.rename(temporary, file)
}

export namespace WorkspaceRegistry {
  export async function list(options?: { includeDeleted?: boolean; file?: string }) {
    const records = await read(options?.file ?? defaultFile)
    return options?.includeDeleted ? records : records.filter((record) => record.deletedAt === undefined)
  }

  export async function register(input: { path: string; name?: string; file?: string }) {
    const file = input.file ?? defaultFile
    return withLock(file, async () => {
      const records = await read(file)
      const resolved = await canonical(input.path)
      // Heal legacy duplicate records and path aliases in one locked write.
      const canonicalMatches: WorkspaceRecord[] = []
      for (const record of records) {
        if (await canonical(record.path) === resolved || (await Promise.all(record.aliases.map(canonical))).includes(resolved)) {
          canonicalMatches.push(record)
        }
      }
      const primary = canonicalMatches[0] ?? {
        id: identity(resolved),
        path: resolved,
        aliases: [],
        updatedAt: Date.now(),
      }
      const aliases = new Set([input.path, resolved, ...primary.aliases])
      for (const duplicate of canonicalMatches.slice(1)) {
        aliases.add(duplicate.path)
        duplicate.aliases.forEach((alias) => aliases.add(alias))
      }
      const next: WorkspaceRecord = {
        ...primary,
        path: resolved,
        aliases: [...aliases].filter((alias) => alias !== resolved).sort(),
        name: input.name ?? primary.name,
        deletedAt: undefined,
        updatedAt: Date.now(),
      }
      const duplicateIDs = new Set(canonicalMatches.map((record) => record.id))
      await write(file, [...records.filter((record) => !duplicateIDs.has(record.id)), next])
      return next
    })
  }

  export async function remove(id: string, file = defaultFile) {
    return withLock(file, async () => {
      const records = await read(file)
      const record = records.find((entry) => entry.id === id)
      if (!record) return false
      record.deletedAt = Date.now()
      record.updatedAt = record.deletedAt
      await write(file, records)
      return true
    })
  }
}
