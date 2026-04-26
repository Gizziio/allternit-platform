/**
 * Vault
 *
 * Main entry point for the Allternit Knowledge Vault.
 * Provides programmatic access to the Obsidian-compatible Markdown vault.
 */

import path from "path"
import { Log } from "@/shared/util/log"
import { Global } from "@/runtime/context/global"
import { Vault } from "./types"
import { VaultIndex } from "./search"
import * as IO from "./io"

const log = Log.create({ service: "vault" })

export { Vault }
export * from "./io"
export { VaultIndex }

export class VaultManager {
  private root: string
  private index: VaultIndex
  private vaultConfig: Vault.VaultConfig

  constructor(config?: Partial<Vault.VaultConfig>) {
    this.vaultConfig = { ...Vault.DEFAULT_CONFIG, ...config }
    this.root = this.vaultConfig.vaultPath || path.join(Global.Path.data, "vault")
    this.index = new VaultIndex(this.root)
  }

  get rootPath(): string {
    return this.root
  }

  get config(): Vault.VaultConfig {
    return this.vaultConfig
  }

  async initialize(): Promise<void> {
    await IO.ensureVaultStructure(this.root)
    await this.rebuildIndex()
    log.info("Vault initialized", { root: this.root })
  }

  async rebuildIndex(): Promise<void> {
    const notes = await IO.listNotes(this.root)
    for (const note of notes) {
      this.index.index(note)
    }
    log.info("Vault index rebuilt", { count: notes.length })
  }

  async getNote(relPath: string): Promise<Vault.Note | null> {
    const absPath = path.join(this.root, relPath)
    return IO.readNote(absPath, this.root)
  }

  async writeNote(relPath: string, content: string, frontmatter?: Vault.Frontmatter): Promise<Vault.Note> {
    const absPath = path.join(this.root, relPath)
    const existing = await IO.readNote(absPath, this.root)
    const mergedFrontmatter = { ...(existing?.frontmatter || {}), ...(frontmatter || {}) }
    if (!mergedFrontmatter.title) {
      mergedFrontmatter.title = path.basename(relPath, ".md")
    }

    await IO.writeNote(absPath, { frontmatter: mergedFrontmatter, content })
    const note = await IO.readNote(absPath, this.root)
    if (!note) throw new Error(`Failed to write note: ${relPath}`)
    this.index.index(note)
    return note
  }

  async createNote(folder: string, title: string, content: string, frontmatter?: Vault.Frontmatter): Promise<Vault.Note> {
    const safeTitle = IO.sanitizeFilename(title)
    const relPath = path.join(folder, `${safeTitle}.md`)
    return this.writeNote(relPath, content, { ...(frontmatter || {}), title })
  }

  async query(q: Vault.Query): Promise<Vault.QueryResult> {
    let notes: Vault.Note[] = []

    if (q.text) {
      const searchResults = this.index.search(q.text, q.limit || 50)
      for (const r of searchResults) {
        const note = await IO.readNote(r.path, this.root)
        if (note) notes.push(note)
      }
    } else if (q.folder) {
      const results = this.index.getByFolder(q.folder)
      for (const r of results) {
        const note = await IO.readNote(r.path, this.root)
        if (note) notes.push(note)
      }
    } else if (q.tags?.length) {
      for (const tag of q.tags) {
        const results = this.index.getByTag(tag)
        for (const r of results) {
          const note = await IO.readNote(r.path, this.root)
          if (note && !notes.find(n => n.path === note.path)) notes.push(note)
        }
      }
    } else {
      const all = await IO.listNotes(this.root)
      notes = all
    }

    // Filter by entity types
    if (q.entityTypes?.length) {
      notes = notes.filter(n => {
        const folderType = n.folder.split("/")[0]?.toLowerCase()
        return q.entityTypes!.some(t => folderType === t || n.frontmatter.entities?.some(e => e.toLowerCase().includes(t)))
      })
    }

    // Filter by date range
    if (q.after) {
      notes = notes.filter(n => n.mtime >= q.after!.getTime())
    }
    if (q.before) {
      notes = notes.filter(n => n.mtime <= q.before!.getTime())
    }

    const total = notes.length
    const limit = q.limit || 20
    const truncated = notes.length > limit
    notes = notes.slice(0, limit)

    return { notes, total, truncated }
  }

  async getBacklinks(relPath: string): Promise<Vault.Note[]> {
    const absPath = path.join(this.root, relPath)
    const links = this.index.getBacklinks(absPath)
    const notes: Vault.Note[] = []
    for (const link of links) {
      const note = await IO.readNote(link.source, this.root)
      if (note) notes.push(note)
    }
    return notes
  }

  async traverse(relPath: string, depth = 1): Promise<Map<string, Vault.Note>> {
    const result = new Map<string, Vault.Note>()
    const visited = new Set<string>()
    let current = [relPath]

    for (let d = 0; d < depth && current.length > 0; d++) {
      const next: string[] = []
      for (const rp of current) {
        if (visited.has(rp)) continue
        visited.add(rp)

        const note = await this.getNote(rp)
        if (!note) continue
        result.set(rp, note)

        for (const link of note.outgoingLinks) {
          const linkedPath = link.endsWith(".md") ? link : `${link}.md`
          if (!visited.has(linkedPath)) next.push(linkedPath)
        }

        const backlinks = await this.getBacklinks(rp)
        for (const bl of backlinks) {
          const blRel = path.relative(this.root, bl.path)
          if (!visited.has(blRel)) next.push(blRel)
        }
      }
      current = next
    }

    return result
  }

  async findNotesWithTrigger(trigger: string): Promise<Vault.Note[]> {
    const all = await IO.listNotes(this.root)
    return all.filter(n => n.content.includes(trigger) || n.frontmatter.tags?.includes(trigger))
  }

  async getDailyNote(date = new Date()): Promise<Vault.Note> {
    const dateStr = date.toISOString().split("T")[0]!
    const relPath = path.join("Daily", `${dateStr}.md`)
    const existing = await this.getNote(relPath)
    if (existing) return existing

    const frontmatter: Vault.Frontmatter = {
      title: dateStr,
      date: dateStr,
      tags: ["daily"],
    }
    return this.writeNote(relPath, `## ${dateStr}\n\n`, frontmatter)
  }

  close(): void {
    this.index.close()
  }
}
