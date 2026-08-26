import { createHash, randomUUID } from "crypto"
import fs from "fs/promises"
import { constants } from "fs"
import path from "path"
import { Global } from "@/runtime/context/global"
import { Instance } from "@/runtime/context/project/instance"
import { ConfigMarkdown } from "@/runtime/context/config/markdown"

export namespace SkillImporter {
  export interface Operation {
    kind: "instruction" | "skill" | "mcp-review"
    source: string
    target: string
    origin: "claude" | "codex"
    scope: "user" | "project"
    digest?: string
    status: "ready" | "skip" | "review"
    reason?: string
    warnings: string[]
  }

  export interface Plan {
    id: string
    categories: Array<"instructions" | "skills" | "mcp">
    operations: Operation[]
    createdAt: string
    appliedAt?: string
  }

  const planDir = () => path.join(Global.Path.data, "skill-imports")

  export async function preview(categories: Plan["categories"]): Promise<Plan> {
    const selected = [...new Set(categories)]
    const operations: Operation[] = []
    if (selected.includes("instructions")) operations.push(...await instructionOperations())
    if (selected.includes("skills")) operations.push(...await skillOperations())
    if (selected.includes("mcp")) operations.push(...await mcpOperations())
    const plan: Plan = { id: randomUUID(), categories: selected, operations, createdAt: new Date().toISOString() }
    await fs.mkdir(planDir(), { recursive: true })
    await atomicWrite(planFile(plan.id), JSON.stringify(plan, null, 2))
    return plan
  }

  export async function apply(id: string): Promise<Plan> {
    const plan = await get(id)
    if (!plan) throw new Error(`Import plan ${id} not found`)
    if (plan.appliedAt) throw new Error(`Import plan ${id} was already applied`)
    for (const operation of plan.operations.filter((item) => item.status === "ready")) {
      const current = await sourceDigest(operation.source)
      if (current !== operation.digest) throw new Error(`Import source changed after preview: ${operation.source}`)
      if (operation.kind === "skill") await copySkill(operation)
      if (operation.kind === "instruction") await appendInstructions(operation)
    }
    plan.appliedAt = new Date().toISOString()
    await atomicWrite(planFile(plan.id), JSON.stringify(plan, null, 2))
    return plan
  }

  export async function get(id: string): Promise<Plan | undefined> {
    return fs.readFile(planFile(id), "utf8").then((raw) => JSON.parse(raw) as Plan).catch(() => undefined)
  }

  async function instructionOperations(): Promise<Operation[]> {
    const project = Instance.worktree
    const candidates = [
      ...instructionCandidates(path.join(Global.Path.home(), ".claude"), path.join(Global.Path.config, "AGENTS.md"), "claude", "user"),
      ...instructionCandidates(path.join(Global.Path.home(), ".codex"), path.join(Global.Path.config, "AGENTS.md"), "codex", "user"),
      ...instructionCandidates(path.join(project, ".claude"), path.join(project, ".gizzi", "AGENTS.md"), "claude", "project"),
      ...instructionCandidates(path.join(project, ".codex"), path.join(project, ".gizzi", "AGENTS.md"), "codex", "project"),
    ] as Array<Omit<Operation, "digest" | "status" | "warnings">>
    const result: Operation[] = []
    for (const item of candidates) {
      const content = await fs.readFile(item.source, "utf8").catch(() => undefined)
      if (content === undefined) continue
      const marker = markerFor(item, content)
      const target = await fs.readFile(item.target, "utf8").catch(() => "")
      result.push({
        ...item,
        digest: digest(content),
        status: content.trim() && !target.includes(marker.start) ? "ready" : "skip",
        reason: !content.trim() ? "empty source" : target.includes(marker.start) ? "already imported" : undefined,
        warnings: [],
      })
    }
    return result
  }

  function instructionCandidates(root: string, target: string, origin: "claude" | "codex", scope: "user" | "project") {
    return ["AGENTS.md", "CLAUDE.md"].map((name) => ({
      kind: "instruction" as const,
      source: path.join(root, name),
      target,
      origin,
      scope,
    }))
  }

  async function skillOperations(): Promise<Operation[]> {
    // The ordering is intentional and is also the collision winner order.
    const roots = [
      { root: path.join(Instance.worktree, ".claude", "skills"), origin: "claude" as const, scope: "project" as const },
      { root: path.join(Instance.worktree, ".codex", "skills"), origin: "codex" as const, scope: "project" as const },
      { root: path.join(Global.Path.home(), ".claude", "skills"), origin: "claude" as const, scope: "user" as const },
      { root: path.join(Global.Path.home(), ".codex", "skills"), origin: "codex" as const, scope: "user" as const },
    ]
    const claimed = new Set<string>()
    const operations: Operation[] = []
    for (const root of roots) {
      for (const source of await topLevelSkills(root.root)) {
        const targetRoot = root.scope === "project"
          ? path.join(Instance.worktree, ".gizzi", "skills")
          : path.join(Global.Path.config, "skills")
        const target = path.join(targetRoot, path.basename(source))
        const warnings = await compatibilityWarnings(source)
        const collision = claimed.has(target) || await exists(target)
        claimed.add(target)
        operations.push({
          kind: "skill",
          source,
          target,
          origin: root.origin,
          scope: root.scope,
          digest: await sourceDigest(source),
          status: collision ? "skip" : "ready",
          reason: collision ? "target collision; existing or higher-priority source wins" : undefined,
          warnings,
        })
      }
    }
    return operations
  }

  async function mcpOperations(): Promise<Operation[]> {
    const candidates = [
      { source: path.join(Global.Path.home(), ".claude.json"), origin: "claude" as const, scope: "user" as const },
      { source: path.join(Global.Path.home(), ".codex", "config.toml"), origin: "codex" as const, scope: "user" as const },
      { source: path.join(Instance.worktree, ".codex", "config.toml"), origin: "codex" as const, scope: "project" as const },
    ]
    const result: Operation[] = []
    for (const item of candidates) {
      if (!(await exists(item.source))) continue
      result.push({
        kind: "mcp-review",
        ...item,
        target: item.scope === "project"
          ? path.join(Instance.worktree, ".gizzi", "gizzi.json")
          : path.join(Global.Path.config, "config.json"),
        status: "review",
        warnings: ["MCP declarations can spawn commands or contact remote services; normalize and approve each server separately."],
      })
    }
    return result
  }

  async function topLevelSkills(root: string) {
    const entries = await fs.readdir(root, { withFileTypes: true }).catch(() => [])
    const result: string[] = []
    for (const entry of entries.toSorted((a, b) => a.name.localeCompare(b.name))) {
      if (entry.name.startsWith(".") || entry.name === "node_modules") continue
      const source = path.join(root, entry.name)
      if (entry.isDirectory() && await exists(path.join(source, "SKILL.md"))) result.push(source)
      if (entry.isFile() && entry.name.endsWith(".md")) result.push(source)
    }
    return result
  }

  async function compatibilityWarnings(source: string) {
    const skillFile = (await isDirectory(source)) ? path.join(source, "SKILL.md") : source
    const md = await ConfigMarkdown.parse(skillFile).catch(() => undefined)
    if (!md) return ["Invalid or unreadable skill frontmatter; catalog validation may reject this skill."]
    const warnings: string[] = []
    for (const field of ["allowed-tools", "disallowed-tools", "context", "agent", "hooks", "paths"]) {
      if (field in md.data) warnings.push(`Tool-specific frontmatter field: ${field}`)
    }
    if (/!`[^`]+`/.test(md.content)) warnings.push("Contains dynamic shell injection syntax; it will be preserved but not executed during import.")
    return warnings
  }

  async function copySkill(operation: Operation) {
    if (await exists(operation.target)) throw new Error(`Refusing to overwrite skill target: ${operation.target}`)
    await fs.mkdir(path.dirname(operation.target), { recursive: true })
    if (await isDirectory(operation.source)) {
      await fs.cp(operation.source, operation.target, {
        recursive: true,
        errorOnExist: true,
        filter: (source) => {
          const name = path.basename(source)
          return name !== "node_modules" && !name.startsWith(".") && !name.endsWith(".cache")
        },
      })
    } else {
      await fs.copyFile(operation.source, operation.target, constants.COPYFILE_EXCL)
    }
  }

  async function appendInstructions(operation: Operation) {
    const content = await fs.readFile(operation.source, "utf8")
    const marker = markerFor(operation, content)
    const existing = await fs.readFile(operation.target, "utf8").catch(() => "")
    if (existing.includes(marker.start)) return
    if (existing) {
      const backup = `${operation.target}.${new Date().toISOString().replaceAll(/[:.]/g, "-")}.bak`
      await fs.copyFile(operation.target, backup, constants.COPYFILE_EXCL)
    }
    const next = `${existing.trimEnd()}${existing ? "\n\n" : ""}${marker.start}\n\n${content.trim()}\n\n${marker.end}\n`
    await atomicWrite(operation.target, next)
  }

  function markerFor(operation: Pick<Operation, "origin" | "source">, _content: string) {
    const brand = operation.origin === "claude" ? "Claude Code" : "Codex"
    return {
      start: `<!-- Imported from ${brand}: ${operation.source} -->`,
      end: `<!-- End imported from ${brand}: ${operation.source} -->`,
    }
  }

  async function sourceDigest(source: string): Promise<string> {
    if (!(await isDirectory(source))) return digest(await fs.readFile(source))
    const entries: Array<{ path: string; digest: string }> = []
    await walk(source, async (file) => {
      entries.push({ path: path.relative(source, file), digest: digest(await fs.readFile(file)) })
    })
    return digest(JSON.stringify(entries.toSorted((a, b) => a.path.localeCompare(b.path))))
  }

  async function walk(root: string, visit: (file: string) => Promise<void>): Promise<void> {
    const entries = await fs.readdir(root, { withFileTypes: true })
    for (const entry of entries.toSorted((a, b) => a.name.localeCompare(b.name))) {
      if (entry.name === "node_modules" || entry.name.startsWith(".")) continue
      const location = path.join(root, entry.name)
      if (entry.isSymbolicLink()) throw new Error(`Symlinks are not imported: ${location}`)
      if (entry.isDirectory()) await walk(location, visit)
      else if (entry.isFile()) await visit(location)
    }
  }

  function planFile(id: string) { return path.join(planDir(), `${id}.json`) }
  function digest(content: string | Buffer) { return createHash("sha256").update(content).digest("hex") }
  async function exists(location: string) { return fs.stat(location).then(() => true).catch(() => false) }
  async function isDirectory(location: string) { return fs.stat(location).then((stat) => stat.isDirectory()).catch(() => false) }
  async function atomicWrite(file: string, content: string) {
    await fs.mkdir(path.dirname(file), { recursive: true })
    const temporary = `${file}.${process.pid}.${randomUUID()}.tmp`
    await fs.writeFile(temporary, content, "utf8")
    await fs.rename(temporary, file)
  }
}
