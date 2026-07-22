import { createHash, randomUUID } from "crypto"
import fs from "fs/promises"
import path from "path"
import { Global } from "@/runtime/context/global"
import { Instance } from "@/runtime/context/project/instance"

export namespace SkillGrowth {
  export type Status = "proposed" | "evaluated" | "approved" | "rejected" | "active" | "rolled_back"
  export interface Record {
    id: string
    name: string
    description: string
    content: string
    scope: "user" | "project"
    status: Status
    version: number
    digest: string
    score?: number
    evaluation?: string
    target?: string
    activatedAt?: string
    createdAt: string
    updatedAt: string
  }

  const root = () => path.join(Global.Path.data, "skill-growth")
  const recordsDir = () => path.join(root(), "proposals")
  const historyDir = (name: string) => path.join(root(), "history", name)

  export async function propose(input: {
    name: string
    description: string
    content: string
    scope: "user" | "project"
  }): Promise<Record> {
    assertName(input.name)
    if (!input.description.trim()) throw new Error("Skill description is required")
    if (!input.content.trim()) throw new Error("Skill content is required")
    const previous = (await list()).filter((item) => item.name === input.name)
    const now = new Date().toISOString()
    const record: Record = {
      ...input,
      id: randomUUID(),
      status: "proposed",
      version: Math.max(0, ...previous.map((item) => item.version)) + 1,
      digest: digest(input.content),
      createdAt: now,
      updatedAt: now,
    }
    await save(record)
    return record
  }

  export async function evaluate(id: string, input: { score: number; report: string }): Promise<Record> {
    const record = await requireRecord(id)
    if (record.status !== "proposed" && record.status !== "evaluated") {
      throw new Error(`Cannot evaluate a ${record.status} proposal`)
    }
    if (!Number.isFinite(input.score) || input.score < 0 || input.score > 1) throw new Error("Score must be between 0 and 1")
    return update(record, { status: "evaluated", score: input.score, evaluation: input.report })
  }

  export async function decide(id: string, decision: "approve" | "reject"): Promise<Record> {
    const record = await requireRecord(id)
    if (record.status !== "evaluated") throw new Error("A proposal must be evaluated before approval")
    if (decision === "approve" && (record.score ?? 0) < 0.7) {
      throw new Error("Evaluation score is below the 0.70 activation threshold")
    }
    return update(record, { status: decision === "approve" ? "approved" : "rejected" })
  }

  export async function activate(id: string): Promise<Record> {
    const record = await requireRecord(id)
    if (record.status !== "approved") throw new Error("Only an approved skill proposal can be activated")
    const targetDir = record.scope === "project"
      ? path.join(Instance.worktree, ".gizzi", "skills", record.name)
      : path.join(Global.Path.config, "skills", record.name)
    const target = path.join(targetDir, "SKILL.md")
    const existing = await fs.readFile(target, "utf8").catch(() => undefined)
    const history = historyDir(record.name)
    await fs.mkdir(history, { recursive: true })
    const snapshot = {
      proposalID: record.id,
      version: record.version,
      target,
      previous: existing ?? null,
      activated: render(record),
      createdAt: new Date().toISOString(),
    }
    await atomicWrite(path.join(history, `${record.version}.json`), JSON.stringify(snapshot, null, 2))
    await fs.mkdir(targetDir, { recursive: true })
    await atomicWrite(target, snapshot.activated)
    return update(record, { status: "active", target, activatedAt: new Date().toISOString() })
  }

  export async function rollback(id: string): Promise<Record> {
    const record = await requireRecord(id)
    if (record.status !== "active" || !record.target) throw new Error("Only an active proposal can be rolled back")
    const raw = await fs.readFile(path.join(historyDir(record.name), `${record.version}.json`), "utf8")
    const snapshot = JSON.parse(raw) as { target: string; previous: string | null; activated: string }
    const current = await fs.readFile(snapshot.target, "utf8").catch(() => undefined)
    if (current !== snapshot.activated) throw new Error("Active skill changed since activation; refusing to overwrite it")
    if (snapshot.previous === null) await fs.rm(snapshot.target)
    else await atomicWrite(snapshot.target, snapshot.previous)
    return update(record, { status: "rolled_back" })
  }

  export async function get(id: string): Promise<Record | undefined> {
    return read(path.join(recordsDir(), `${id}.json`))
  }

  export async function list(): Promise<Record[]> {
    const names = await fs.readdir(recordsDir()).catch(() => [])
    const records = await Promise.all(names.filter((name) => name.endsWith(".json")).map((name) => read(path.join(recordsDir(), name))))
    return records.filter((item): item is Record => Boolean(item)).toSorted((a, b) => b.createdAt.localeCompare(a.createdAt))
  }

  async function requireRecord(id: string) {
    const record = await get(id)
    if (!record) throw new Error(`Skill proposal ${id} not found`)
    return record
  }

  async function update(record: Record, patch: Partial<Record>) {
    const next = { ...record, ...patch, updatedAt: new Date().toISOString() }
    await save(next)
    return next
  }

  async function save(record: Record) {
    await fs.mkdir(recordsDir(), { recursive: true })
    await atomicWrite(path.join(recordsDir(), `${record.id}.json`), JSON.stringify(record, null, 2))
  }

  async function read(file: string): Promise<Record | undefined> {
    return fs.readFile(file, "utf8").then((raw) => JSON.parse(raw) as Record).catch(() => undefined)
  }

  function render(record: Record) {
    return `---\nname: ${record.name}\ndescription: ${JSON.stringify(record.description)}\n---\n\n${record.content.trim()}\n`
  }

  function assertName(name: string) {
    if (!/^[a-z0-9][a-z0-9-]{0,63}$/.test(name)) throw new Error("Skill name must be lowercase kebab-case")
  }

  function digest(content: string) {
    return createHash("sha256").update(content).digest("hex")
  }

  async function atomicWrite(file: string, content: string) {
    await fs.mkdir(path.dirname(file), { recursive: true })
    const temporary = `${file}.${process.pid}.${randomUUID()}.tmp`
    await fs.writeFile(temporary, content, "utf8")
    await fs.rename(temporary, file)
  }
}
